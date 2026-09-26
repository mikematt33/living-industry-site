# Living Industry website

A small public feedback hub for the Living Industry Game Dev Tycoon mod.

This repository contains the website. The mod and the shared feedback board remain in [mikematt33/gdt-livingindustry](https://github.com/mikematt33/gdt-livingindustry).

## How feedback works

- The website reads public GitHub Issues from the mod repository. Pull requests are excluded.
- People can browse, filter, and read feedback on the website or go directly to GitHub.
- The form prepares an issue title and description, then opens GitHub for the final submission. A GitHub account is required. The site never says a draft has been submitted.
- Reports created through either route appear on the same board, with the same open/closed status. Click Refresh after submitting; returning to the tab also refreshes data older than a minute.
- Bug reports use a `[Bug]` title prefix, and suggestions use `[Idea]`. Existing GitHub `bug` and `enhancement` labels are recognized too. Unclassified issues still appear under All.
- The website requests the latest 50 entries at a time. Load more includes older entries. Search and filters apply to loaded entries.
- As players type a title, up to three similar loaded reports appear. These are title matches, not a guarantee that a report is a duplicate. Open and closed reports can match.
- Optional bug details (steps, expected behavior, other mods) are included in the prepared report. They are omitted from feature requests.
- The current published release is fetched from GitHub and cached for 15 minutes. If unavailable, the direct Release history link stays visible. The version is a hint, never an automatically filled claim about the player's installation.
- Brief orange bug bubbles and cyan idea bubbles appear when changing type or preparing a valid draft. They do not mean an issue has been submitted, do not delay GitHub navigation, and are disabled for reduced-motion preferences.
- No API token, private credentials, database, build process, or external hosting is required. Browser session caching is temporary; GitHub Issues is the source of truth.

## Deploy with GitHub Pages

1. Create the public repository `mikematt33/living-industry-site` and put these files at its root, including `.github/workflows/pages.yml`.
2. In the repository, open **Settings → Pages** and choose **GitHub Actions** as the source.
3. Push to `main`, or run **Deploy website to GitHub Pages** from the Actions tab.
4. GitHub will show the published URL when deployment finishes.

Alternatively, GitHub Pages can publish these static files directly from `main` at `/ (root)` if you choose branch-based publishing instead of the included workflow.

The expected project URL is `https://mikematt33.github.io/living-industry-site/`; it becomes live only after a successful Pages deployment.

## Update links or content

- `index.html`: page content, download link, roadmap link, and form.
- `styles.css`: responsive layout, typography, and colors.
- `app.js`: board loading, filters, issue details, and form behavior.
- `feedback.mjs`: mod repository, classification, validation, and GitHub draft preparation.

The download button always goes to the mod repository's latest release. Add a Steam Workshop link to the header when it is available.

## Local preview

Serve this directory using any static HTTP server, then open its local URL. Modules need HTTP; opening `index.html` as a local `file:` URL is not sufficient.

## Operational notes

### Progress labels

Manage progress on the mod repository's GitHub Issues. The site recognizes these label names (case-insensitive):

| GitHub label | Website badge |
| --- | --- |
| `under review` or `status: under review` | Under review |
| `planned` or `status: planned` | Planned |
| `in progress` or `status: in progress` | In progress |
| `fixed in: v0.1.2` (replace with the actual version) | Fixed in v0.1.2, on closed issues |

If multiple open progress labels exist, In progress takes precedence over Planned, then Under review. Closed issues never display a planned/review badge. Closing an issue alone does not claim it was fixed. These labels are not created or assigned automatically; unlabeled issues still show Open or Closed.

GitHub's anonymous API limits are shared per visitor IP. The site briefly caches fetched public data and provides a direct GitHub link if loading fails. It performs no background polling loop and does not send feedback on the visitor's behalf.

Long reports that would exceed a conservative URL-size limit are preserved in a copyable field and handed off without truncation. Logs and screenshots can be added on GitHub before submission. Public reports should not contain private information.
