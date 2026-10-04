# Static HTML runtime

Use the bundled runtime instead of writing another server or injecting replacement wrappers. Requirements: Python 3.10+ and a modern browser with JavaScript. No Python packages, separate paid API, or browser plugin are required.

## Run

Resolve `SKILL_DIR` to the directory containing the loaded `SKILL.md`. Keep the findings JSON in a private working directory outside the served root and public repositories.

```sh
python3 "$SKILL_DIR/scripts/preview.py" /absolute/path/site/page.html \
  --findings /absolute/path/private/findings.json \
  --root /absolute/path/site --port 8793
```

`--root` defaults to the HTML file's parent. Select the smallest static directory that contains the page and its assets; the server makes non-hidden files in this root locally accessible. Use `--port 0` for a free port, then read the printed URL. Do not stop another server to claim its port. Keep the process alive with the host's terminal/background mechanism and retain its process/session identifier for cleanup.

Accepted inputs:

- An existing UTF-8 `.html` or `.htm` file, relative or absolute.
- A local `file:///.../page.html` URL.
- A loopback `http://localhost:PORT/path/page.html` URL **with `--root`**. This maps `/path/page.html` to `ROOT/path/page.html`; it never fetches or proxies the existing server. Confirm that this is the corresponding static source. Query-driven pages and app routes are rejected. A URL fragment does not select findings.

Relative/root-relative styles, images, and links retain their paths under the new local origin. Only the selected source page receives the overlay. Navigation to another HTML page stays unannotated. A `<base>` tag or absolute link still points at its original destination; this runtime does not rewrite it. Do not claim the original live tab or original origin was modified.

## Findings format

```json
{
  "language": "en",
  "findings": [
    {
      "id": 1,
      "selector": "#introduction p.lead",
      "quote": "The exact passage under discussion.",
      "reason": "The reader cannot tell which action this refers to.",
      "kind": "passage"
    }
  ]
}
```

`language` is `en` (default) or `ko`. Write `reason` in the user's language. With `ko`, the controls read **원본에서 갱신**, **표시 제거**, and **검토 이유와 상태**; use those visible labels when explaining the workflow. Each finding has a stable integer `id` (1–9999), a CSS `selector`, exact `quote`, and a concise `reason`. `kind` is `passage` (orange, default) or `group` (blue). Maximum 100 findings.

The selector must match **one existing element**. Prefer stable IDs or semantic context over positional selectors. Do not add IDs to the source just to mark it. The quote must occur **exactly once within that element** after whitespace normalization. Case, punctuation, and words must still match. Inline markup such as `shared <em>reading</em> list` is supported. Use visible text, not HTML entities: `&`, not `&amp;`. For a group, use a unique identifying quote within the selected region (typically its heading); the whole element receives a blue outline.

No fuzzy match, first-occurrence fallback, or numeric occurrence index is used. Missing, repeated, invalid, nonunique, or hidden targets are withheld with a status in the navigation panel. Narrow the selector or re-examine the current source before updating a finding; do not silently redirect it to a different passage. A group anchor confirms identity, not that every sentence in the group is unchanged.

## Edit, refresh, remove

1. Open the printed review URL. Numbers jump to passages; **Findings and status** explains each mark and any withheld target.
2. After the user edits and saves the original HTML, choose **Refresh source**. This reloads both source and findings from disk. There is no file watcher or automatic rewrite.
3. If the old quote changed, its mark disappears. Re-read the revision, then update or remove the finding only as appropriate to the user's request. Keep IDs of surviving findings.
4. **Remove** reloads the same source at `?review=off`, with no overlay script. Reloading that URL remains unannotated. Open the original printed review URL to restore annotations. Ctrl+C stops only this preview server.

The overlay uses DOM ranges and a separate shadow-root layer, without wrapping source text or changing source styles. It follows scrolling and resizing and is hidden by print CSS. It never writes the source. Refresh also rereads external static assets with caching disabled by this server.

## Boundaries and troubleshooting

This release is for static, ordinary HTML text. React/Next.js development servers, hydration, client-side routing, login pages, remote URLs, PDFs, Word, iframes, shadow-root text, canvas, CSS-generated text, animated/transformed layouts, and clipped/nested scrolling content are not validated targets. Export suitable static HTML first when practical. Scripts already in the source still execute; use a trusted static source. This runtime does not upload documents, but existing external page resources retain their normal network behavior.

If the panel does not appear, check that JavaScript runs and inspect browser errors. A page CSP that blocks the external overlay script or its styles, or scripts that replace the document, is unsupported: report the limitation rather than weakening its policy. Browser automation is optional. Without a browser tool, verify HTTP and manifest loading, provide the URL, and explicitly leave visual placement unverified.

Controls float above the page without adding layout space. Collapse details while reading near the bottom. Dense layouts may leave little room for badges; visually verify the actual page before describing the placement as correct.

## Short-lived terminal sessions

Some noninteractive agent hosts terminate background tool processes when their turn/session exits. Do not promise that the URL will remain available just because an in-session HTTP request succeeded. Prefer a persistent user terminal. If the host permits a detached local server, this standard-library launcher works without a shell-specific `nohup` dependency (replace the paths):

```python
import subprocess
import sys
from pathlib import Path

log_path = Path("/absolute/path/private/preview.log")
with log_path.open("ab") as log:
    process = subprocess.Popen(
        [sys.executable, "/absolute/path/skill/scripts/preview.py",
         "/absolute/path/site/page.html", "--findings", "/absolute/path/private/findings.json",
         "--port", "0"],
        stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True,
    )
print("Preview PID:", process.pid)
```

Read the printed URL from that log, verify HTTP after the launcher exits, and retain the PID and command for scoped cleanup. If detachment is disallowed or the host still reaps it, give the user the foreground command for a persistent terminal and state the limitation. Do not weaken host permissions to keep a server alive.
