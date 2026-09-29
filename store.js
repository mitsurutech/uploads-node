import { CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, PutObjectCommand,
         S3Client } from '@aws-sdk/client-s3';
import pg from 'pg';

/**
 * The two stores this app uses, and the one rule about the order they are written in.
 *
 * S3 holds the bytes and Postgres holds everything else: who the file is called, how big it
 * is, when it arrived and which S3 key it is under. Neither knows about the other; this
 * file is the only place that knows about both.
 *
 * **Write S3 first, then the row. Delete the row first, then S3.** That order is the whole
 * of the reliability story here and it is worth understanding before you change anything:
 *
 * - If the upload to S3 works and the insert then fails, you have an object nobody points
 *   at. Nothing is broken; it is a few bytes nobody can see, and a tidy-up job could sweep
 *   it later.
 * - If you wrote the row first and the upload then failed, the page would list a file that
 *   cannot be opened. Somebody clicks it and gets an error, and there is no way to tell
 *   that row from a good one.
 *
 * The first is invisible, the second is a broken page. So always write the thing that can
 * be orphaned harmlessly first, and delete in the opposite order for the same reason.
 */

/**
 * The bucket this app keeps its uploads in.
 *
 * **The app makes its own bucket and is not given one.** The cloud stack in your session
 * starts completely empty, exactly as a real AWS account you just opened would, so
 * `CreateBucket` is your code's job — and it is one of the things worth learning. A name
 * must be lower case and DNS-safe.
 */
const BUCKET = process.env.BUCKET_NAME || 'uploads';

/**
 * The S3 client.
 *
 * **`forcePathStyle` is the one setting you must not miss**, and leaving it out is the
 * mistake almost everybody makes first. By default the SDK addresses a bucket as part of
 * the hostname — `uploads.cloud` — and inside your session there is no such name, so every
 * call fails with a DNS error that says nothing about buckets. Path style asks for
 * `http://cloud:4566/uploads/...` instead, which is a name that exists.
 *
 * Everything else comes from the environment your session already set:
 * `AWS_ENDPOINT_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_REGION`. The
 * SDK reads the last three by itself, which is why they are not mentioned below.
 */
export const s3 = new S3Client({
  endpoint: process.env.AWS_ENDPOINT_URL,
  region: process.env.AWS_REGION || 'us-east-1',
  forcePathStyle: true,
});

/** The database your session started, at the name `db`. `DATABASE_URL` is set for you. */
export const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Make the bucket and the table, if they are not there already.
 *
 * **Run on every start and safe to run again**, which is what `IF NOT EXISTS` and catching
 * "you already own this bucket" are for. An app that only works the first time it starts is
 * an app that breaks the moment it restarts.
 */
export async function setUp() {
  try {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.log(`made the bucket ${BUCKET}`);
  } catch (why) {
    // Already there, and made by us. Any other failure is real and should stop the app,
    // because an app that cannot reach its store has nothing useful to do.
    if (why?.name !== 'BucketAlreadyOwnedByYou' && why?.name !== 'BucketAlreadyExists') {
      throw why;
    }
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS files (
      id          bigserial PRIMARY KEY,
      -- **The key, which is where the bytes are.** A uuid rather than the name somebody
      -- uploaded: two people may upload "notes.txt", and a key built from a name is a
      -- file that quietly replaces another one.
      s3_key      text NOT NULL,
      -- What to call it on the page and in the download. Kept apart from the key for the
      -- reason above.
      name        text NOT NULL,
      size_bytes  bigint NOT NULL,
      uploaded_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  console.log('the files table is ready');
}

/** Every file, newest first. */
export async function listFiles() {
  const { rows } = await db.query(
    'SELECT id, name, size_bytes, uploaded_at FROM files ORDER BY uploaded_at DESC, id DESC');
  return rows;
}

/**
 * Keep one file: the bytes in S3, then the row in Postgres.
 *
 * See this file's own note on why that order and not the other.
 */
export async function addFile({ key, name, bytes, type }) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: bytes,
    ContentType: type || 'application/octet-stream',
  }));

  await db.query(
    'INSERT INTO files (s3_key, name, size_bytes) VALUES ($1, $2, $3)',
    [key, name, bytes.length]);
}

/** One file's row, or undefined. */
export async function fileById(id) {
  const { rows } = await db.query(
    'SELECT id, s3_key, name, size_bytes FROM files WHERE id = $1', [id]);
  return rows[0];
}

/** The bytes back out of S3, as a stream. */
export async function readFile(key) {
  const got = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  return got.Body;
}

/**
 * Forget one file: the row first, then the bytes.
 *
 * **The opposite order from writing, and for the same reason.** Delete the bytes first and
 * a failure between the two leaves a row pointing at nothing, which is a broken download.
 * Delete the row first and the worst case is an object nobody points at.
 */
export async function removeFile(id) {
  const file = await fileById(id);
  if (!file) return false;

  await db.query('DELETE FROM files WHERE id = $1', [id]);
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: file.s3_key }));
  return true;
}
