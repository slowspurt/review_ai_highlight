---
name: review-highlight-preview
description: Highlight hard-to-follow passages directly in a local HTML page so the user can find where polished AI-assisted writing needs attention. Use when chat feedback is hard to locate or the user asks to see which parts need revision. Preserve the source; preview requested revisions in place by finding number, without unsolicited rewriting or AI-authorship detection. Shared runtime for Claude Code and Codex.
license: MIT
---

# Review Highlight Preview

Help the user see where reading breaks down in the page they are editing. A polished AI-assisted draft can still be vague, overloaded, repetitive, or hard to connect. Put temporary numbered rectangles on the actual passages, with the surrounding text and design visible so the user can decide what to revise.

## Choose the findings

- Start with the user's reading difficulties and findings already discussed. A request to show “where” locates those findings; it does not authorize a fresh review or additional problems.
- When a review is requested, identify a concrete difficulty using the user's writing preferences and project instructions: an unclear subject, too many ideas compressed together, repetition without new information, or an unexplained transition.
- Mark the smallest relevant passage in orange. Use a blue group outline when the section's order or repetition is the issue. Preserve existing finding numbers.
- Explain each finding briefly in the user's language. It is a judgment to discuss, not an authorship verdict. Do not treat all polished phrasing, technical terms, or regular structure as bad.
- Keep meaning, voice, claims, wording, styles, and links intact. Highlighting does not authorize rewriting or applying suggestions.

## Show the passages

1. Identify the user's source HTML and preview. The bundled runtime supports local static UTF-8 HTML. A page URL alone is insufficient unless it can be mapped to that source. Read [references/runtime.md](references/runtime.md) for accepted inputs, findings format, and lifecycle commands.
2. Read the latest source and create a private findings JSON outside the public skill repository and served root. Each finding needs a unique existing CSS scope, an exact visible quote, a stable number, and a reason. Do not inject IDs into the source. For repeated wording, narrow the scope rather than choosing the first occurrence.
3. Run the bundled `scripts/preview.py` using its absolute installed path, the source, and the findings file. Use the smallest appropriate static asset root and an unused loopback port. Reuse a server from this review when possible; do not wrap another preview server or disturb unrelated servers/tabs.
4. Open the printed local review URL in a new tab/panel. In Codex desktop use the available browser/open-panel tool; in Claude Code use an available browser integration or provide the URL. The server serves a new local origin; the source and original live tab remain unchanged. No paid API or plugin installation is required.
5. Verify actual outlines, numbering, navigation, line wrapping, relative assets, links, and any withheld targets. Capture only suitable review material. If no browser tool is available, check HTTP responses and state that visual placement is unverified. Keep the review available for the user; check the runtime reference on short-lived terminal sessions if the host reaps background processes.

## Preview requested revisions by number

When the user asks to revise or see a proposed edit, use the existing finding numbers. Accept simple instructions such as “Change #1 to …”, “Make #2 shorter”, or several numbered lines. Use supplied wording exactly; when asked to propose wording, draft only for the requested numbers and preserve meaning and factual claims. Do not add findings or invent facts. Ask only when the number or intended scope is ambiguous.

Put each requested plain-text proposal in that finding's optional `replacement` field. Keep `quote` anchored to the original text and keep its `id`, selector, and reason. Refresh the preview to show the changed words **in their original location**, with green outlines. Do not overwrite `quote` with the proposal just to make it match. Use the runtime reference for overlap/markup limits.

The page also has numbered replacement fields under **Findings and revisions** and a **Preview #N** button. **Show original / Show revisions** compares the two states. In Korean these are **수정 문구 #N**, **미리보기 #N**, **원문 보기 / 수정안 보기**. Explain that browser field edits last only in that tab; refresh reloads the JSON. Chat-driven proposals saved in the private JSON survive refresh.

After showing findings, briefly invite the user to say “Change #1 to …” or “Suggest a shorter version of #2” so they know they can revise by number. Do not generate proposals before a request. A request to preview a revision authorizes this temporary view, not a source-file write. When the user explicitly asks to save a chosen revision to the original, edit the actual source with the host's file tools, preserve links/markup deliberately, then update or retire the affected findings and verify the result. The browser controls never save source files.

## Continue or finish

After a user edit, **Refresh source** rereads the latest HTML and JSON. Changed, missing, or duplicated targets must remain unmarked until re-examined. Do not change the quote just to make a mark appear. If the user asks to revise findings, update the JSON while keeping surviving IDs.

**Remove** opens the unannotated response. Returning to the printed review URL restores the marks; Ctrl+C stops the server. Clean up only processes started for this review. Marks also disappear when printing.

Use [examples/demo.html](examples/demo.html) with [examples/findings.json](examples/findings.json) for fictional testing. Dynamic frameworks, remote sites, and other document formats are outside the validated runtime scope; do not claim support based on an untested preview.
