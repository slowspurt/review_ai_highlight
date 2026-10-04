# Review Highlight Preview

A small, open-source skill for **Claude Code and Codex**. Turn review findings into numbered outlines on a temporary local HTML preview, so you and your agent can discuss the same passage.

![Fictional document with numbered review highlights](examples/preview.jpg)

## What it does

- Orange outlines identify individual passages; blue outlines identify broader sections.
- Numbered links jump to the corresponding finding.
- Original text, links, and source files stay intact.
- Highlights are added only to a temporary copy or local server response and hidden when printing.

This is an **instruction-only skill**, not a browser extension, MCP server, or AI-text detector. Your agent creates the preview using the tools available in its environment. It does not decide which writing is good or bad: your review criteria stay in control.

## Install

Install the same files in either tool's personal skills directory. These commands require Git and a terminal. Choose a destination that does not already exist; review or back up an existing installation before replacing it.

### Claude Code

```sh
mkdir -p "$HOME/.claude/skills"
git clone https://github.com/slowspurt/review_ai_highlight.git \
  "$HOME/.claude/skills/review-highlight-preview"
```

Then ask:

```text
/review-highlight-preview Mark the passages we discussed in this local HTML document.
Keep the original unchanged and add numbered navigation.
```

### Codex

```sh
mkdir -p "$HOME/.agents/skills"
git clone https://github.com/slowspurt/review_ai_highlight.git \
  "$HOME/.agents/skills/review-highlight-preview"
```

Then ask:

```text
Use $review-highlight-preview to show these review findings beside the document.
Keep the source unchanged and preserve the finding numbers.
```

If your existing Codex installation already discovers skills in a different directory, such as `$CODEX_HOME/skills`, use that configured directory instead. Avoid installing duplicate copies under multiple discovered paths. Start a new session if the skill does not appear.

For project-only installation, use `.claude/skills/review-highlight-preview/` for Claude Code or `.agents/skills/review-highlight-preview/` for Codex.

Installation paths and invocation syntax follow the official [Claude Code skills documentation](https://code.claude.com/docs/en/skills) and [Codex skills documentation](https://learn.chatgpt.com/docs/build-skills). Desktop and terminal environments may offer different browser tools.

## How it works

1. The agent maps review numbers to the passages you want marked.
2. It creates a temporary HTML copy or serves the original with annotation markup added only to the response.
3. It adds solid outlines, number badges, and navigation links.
4. It opens a local preview and checks it when browser access is available.

In Codex desktop, a supported browser panel can show the preview beside the chat. In Claude Code or another terminal environment, the agent can use an existing browser integration or give you the local URL. Browser automation is optional; without it, the agent reports that visual verification remains pending. Visible labels follow your language, even though the skill instructions are in English.

## Try the example

Open [examples/demo.html](examples/demo.html) locally in a browser, or serve only the example directory from the repository root:

```sh
python3 -m http.server 8790 --bind 127.0.0.1 --directory examples
```

Open `http://127.0.0.1:8790/demo.html`. Use buttons 1–3 to jump between annotations, resize the window to check wrapping, and open print preview to see the annotations disappear. Stop this example server with Ctrl+C when finished.

The example is fictional and self-contained. Python is optional and only used for this example server; the skill does not require a specific server runtime.

## Scope and privacy

The initial workflow targets local HTML documents and previews. PDF, Word, and remote websites need an appropriate local review view first. Preview servers bind to `127.0.0.1`; source documents are not uploaded by this skill. Keep private documents, screenshots, temporary previews, and contact details out of this public repository.

## Updates and contributions

Inside a Git-cloned installation, run `git pull --ff-only` to update. Review local changes before updating; do not discard them automatically.

Keep the skill small and portable. To propose a change, open an issue or pull request with a fictional example and describe which host environment you checked. Browser presentation was checked in Codex desktop; a full Claude Code agent run has not been performed for the initial release.

## License

[MIT](LICENSE).
