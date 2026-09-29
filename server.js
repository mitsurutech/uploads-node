import { randomUUID } from 'node:crypto';
import express from 'express';
import multer from 'multer';

import { addFile, fileById, listFiles, readFile, removeFile, setUp } from './store.js';
import { page } from './page.js';

/**
 * A file upload, end to end: the browser, S3 and Postgres.
 *
 * Four routes and nothing else, so the whole thing can be read in one sitting:
 *
 *   GET  /                  the page: a form, and a table of what has been uploaded
 *   POST /upload            keep one file
 *   GET  /files/:id         send one back
 *   POST /files/:id/delete  forget one
 *
 * Everything about *how* the two stores work is in `store.js`. This file is about the web.
 */

const app = express();

/**
 * **The file is kept in memory and not on disk**, which is right here and would be wrong
 * for a bigger one. Your app's filesystem does not survive a restart, so writing uploads
 * there would lose them; and the point of this sample is that S3 is where bytes live. Ten
 * megabytes is a limit somebody chose, not a rule: a file larger than this should be
 * streamed straight to S3 rather than held whole.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.get('/', async (_request, response) => {
  response.type('html').send(page(await listFiles()));
});

app.post('/upload', upload.single('file'), async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).type('html').send(page(await listFiles(), 'Choose a file first.'));
      return;
    }

    /**
     * **A uuid for the key, never the name somebody typed.** Two people uploading
     * `notes.txt` must not overwrite each other, and a name that arrived from a browser is
     * not a thing to build a path out of: `../../etc/passwd` is a perfectly good filename
     * as far as a form is concerned. The real name is a column, which is where it is safe.
     */
    await addFile({
      key: randomUUID(),
      name: request.file.originalname,
      bytes: request.file.buffer,
      type: request.file.mimetype,
    });

    // **See the other page, not this one.** A refresh after a POST re-posts it, which is
    // how somebody uploads the same file three times by pressing F5.
    response.redirect(303, '/');
  } catch (why) {
    next(why);
  }
});

app.get('/files/:id', async (request, response, next) => {
  try {
    const file = await fileById(request.params.id);
    if (!file) {
      response.status(404).type('text').send('There is no such file.');
      return;
    }

    /**
     * **Always an attachment, and always `octet-stream`.** Anybody can upload anything
     * here, and an HTML file served inline would run as a page on this app's own address.
     * Saved to disk it is inert. `nosniff` stops a browser guessing a type of its own and
     * undoing the first two.
     */
    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Disposition',
                       `attachment; filename="${file.name.replace(/["\\]/g, '')}"`);

    const body = await readFile(file.s3_key);
    body.pipe(response);
  } catch (why) {
    next(why);
  }
});

app.post('/files/:id/delete', async (request, response, next) => {
  try {
    await removeFile(request.params.id);
    response.redirect(303, '/');
  } catch (why) {
    next(why);
  }
});

/** Anything unhandled, said rather than swallowed: a blank page teaches nobody anything. */
app.use((why, _request, response, _next) => {
  console.error(why);
  response.status(500).type('html').send(page([], `Something went wrong: ${why.message}`));
});

/**
 * **`PORT` comes from the platform and must not be hard-coded.** Your app is one service on
 * a private network and the door in front of it dials the port it was told about.
 */
const port = Number(process.env.PORT) || 8080;

setUp()
  .then(() => {
    app.listen(port, '0.0.0.0', () => console.log(`listening on ${port}`));
  })
  .catch((why) => {
    // **Stop rather than serve a broken app.** An app that starts without its bucket or its
    // table answers every request with the same error, and the logs are the only place that
    // says why; failing at the start puts the reason where somebody is already looking.
    console.error('Could not set up the stores:', why);
    process.exit(1);
  });
