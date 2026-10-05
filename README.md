# Living Industry website

Feedback site for the Living Industry Game Dev Tycoon mod. The mod itself, and the issue tracker this site reads from, live in [mikematt33/gdt-livingindustry](https://github.com/mikematt33/gdt-livingindustry).

## How it works

The page is static. It fetches public GitHub Issues from the mod repo (pull requests are filtered out) and shows them as a board with type and status filters plus a text search. Clicking a row opens the issue in a dialog with a link to the GitHub thread.

The form on the right builds an issue title and body, then opens GitHub's new-issue page with those fields prefilled. The visitor finishes and submits there, so a GitHub account is required. Anything submitted this way shows up on the board next to issues filed directly on GitHub. Press Refresh after submitting; switching back to the tab also refreshes data older than a minute.

Bug reports get a `[Bug]` title prefix and ideas get `[Idea]`. The board also recognizes the GitHub `bug` and `enhancement` labels. Issues matching neither still appear under All.

Each fetch pulls 50 issues, newest first. Load more fetches the next page. Search and filters only apply to what has been loaded.

As the visitor types a title, up to three loaded issues with overlapping title words appear under the field so they can check for an existing report first. It's a word match, so it will miss rephrased duplicates and may surface closed issues.

Bug reports have optional fields for steps to reproduce, expected behavior, and other installed mods. Those go into the body; ideas skip them.

The header shows the latest release tag from GitHub, cached in sessionStorage for 15 minutes. If the request fails, the Release history link is still there. The tag also appears as the placeholder for the version field, but the field itself starts empty.

Choosing a type or preparing a valid draft shows a few floating bug or lightbulb icons. They are decoration and are skipped when `prefers-reduced-motion` is set.

There is no token, backend, database, or build step. sessionStorage holds a short-lived copy of the last fetch; GitHub Issues is the source of truth.

## Deploy with GitHub Pages

1. Create the public repository `mikematt33/living-industry-site` and put these files at its root, including `.github/workflows/pages.yml`.
2. In **Settings → Pages**, set the source to **GitHub Actions**.
3. Push to `main`, or run **Deploy website to GitHub Pages** from the Actions tab.
4. GitHub shows the published URL when the deployment finishes.

Branch-based publishing from `main` at `/ (root)` also works if you'd rather skip the workflow.

The site is at `https://mikematt33.github.io/living-industry-site/` once a deployment has succeeded.

## Where things are

- `index.html`: page content, download and roadmap links, and the form.
- `styles.css`: layout, type, and colors.
- `app.js`: board loading, filters, the issue dialog, and form behavior.
- `feedback.mjs`: repo constants, issue classification, validation, and building the GitHub new-issue URL.

The download button points at the mod repo's latest release. Add a Steam Workshop link to the header when there is one.

## Local preview

Serve the directory over HTTP; `file:` URLs won't load the module script. The server has to send `feedback.mjs` as `text/javascript`. Python's `http.server` on Windows sends `.mjs` as `text/plain`, so use something like `npx serve .` instead. GitHub Pages gets the type right.

## Progress labels

Progress is tracked with labels on the mod repo's issues. The site recognizes these names, case-insensitive:

| GitHub label | Website badge |
| --- | --- |
| `under review` or `status: under review` | Under review |
| `planned` or `status: planned` | Planned |
| `in progress` or `status: in progress` | In progress |
| `fixed in: v0.1.2` (replace with the actual version) | Fixed in v0.1.2, on closed issues |

If an open issue has more than one of these, In progress wins over Planned, which wins over Under review. Closed issues only get the Fixed in badge, and only when the label is present. Issues without any of these labels just show Open or Closed. Nothing applies labels automatically.

## Rate limits and long reports

GitHub allows 60 anonymous API requests per hour per IP. The site caches the last fetch for a minute, waits at least five seconds between refreshes, and shows a direct GitHub link when a request fails. It does not poll in the background.

If a prepared report is too long for a URL (around 7,000 characters after encoding), the site shows the full body in a copyable text area and opens GitHub with just the title. Screenshots and logs can be attached on GitHub before submitting. Reports are public, so leave private information out.