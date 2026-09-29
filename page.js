/**
 * The one page this app draws: a form, and a table of what has been uploaded.
 *
 * **Plain HTML in a template string, no framework and no build step.** You can read the
 * whole thing, and `npm ci && npm start` is the whole of running it. Swapping this for
 * React or a template engine is a perfectly good exercise; it is left out so that nothing
 * between your code and the page needs explaining first.
 */

/**
 * **Escaped before it goes in, every time.** A filename arrives from somebody's computer
 * and goes back out onto a page, which is the exact shape of a cross-site scripting hole:
 * a file called `<img src=x onerror=alert(1)>` would otherwise run as markup in the next
 * person's browser. There is no clever version of this rule — escape it, always.
 */
const safe = (said) => String(said ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

/** Bytes, said the way a person reads them. */
function saidSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const STYLE = `
  :root { color-scheme: light dark; }
  body { font: 16px/1.5 system-ui, sans-serif; margin: 0; padding: 2rem 1rem; }
  main { max-width: 52rem; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
  p.lead { margin: 0 0 2rem; opacity: .75; }
  form.upload { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center;
                padding: 1rem; border: 1px solid currentColor; border-radius: .5rem;
                margin-bottom: 2rem; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: .5rem .25rem; border-bottom: 1px solid; }
  th { font-size: .8rem; text-transform: uppercase; letter-spacing: .03em; opacity: .7; }
  td.right, th.right { text-align: right; }
  .trouble { padding: .75rem 1rem; border: 1px solid; border-radius: .5rem;
             margin-bottom: 1.5rem; }
  .empty { opacity: .7; padding: 2rem 0; }
  button, input[type=submit] { font: inherit; padding: .4rem .8rem; cursor: pointer; }
`;

export function page(files, trouble = '') {
  const rows = files.map((file) => `
    <tr>
      <td><a href="/files/${safe(file.id)}">${safe(file.name)}</a></td>
      <td class="right">${safe(saidSize(file.size_bytes))}</td>
      <td>${safe(new Date(file.uploaded_at).toLocaleString('en-GB'))}</td>
      <td class="right">
        <form method="post" action="/files/${safe(file.id)}/delete">
          <button type="submit">Delete</button>
        </form>
      </td>
    </tr>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>File uploads</title>
  <style>${STYLE}</style>
</head>
<body>
  <main>
    <h1>File uploads</h1>
    <p class="lead">
      The file goes to S3. Where it went goes to Postgres. Neither store knows about the
      other &mdash; this app is what joins them.
    </p>

    ${trouble ? `<p class="trouble">${safe(trouble)}</p>` : ''}

    <form class="upload" method="post" action="/upload" enctype="multipart/form-data">
      <!-- A visible label, because a control named only by its placeholder is a control
           a screen reader cannot announce. -->
      <label for="file">Choose a file</label>
      <input type="file" name="file" id="file" required>
      <button type="submit">Upload it</button>
    </form>

    ${files.length === 0
      ? '<p class="empty">Nothing uploaded yet. The table will fill in as you add files.</p>'
      : `<table>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col" class="right">Size</th>
          <th scope="col">Uploaded</th>
          <th scope="col" class="right">&nbsp;</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`}
  </main>
</body>
</html>`;
}
