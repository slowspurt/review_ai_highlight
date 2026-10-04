---
name: review-highlight-preview
description: Highlight hard-to-follow passages directly in the web page a user is working on, so they can see where to revise polished but unclear AI-assisted writing. Use when chat feedback is hard to locate on the page or the user asks to see which parts need attention. Preserve wording and layout; support the user's editing decisions without automatically rewriting or detecting AI authorship. Works with Claude Code and Codex.
license: MIT
---

# Review Highlight Preview

Help the user see exactly where reading breaks down in the page they are editing. An AI-assisted draft may look polished yet contain passages that are vague, overloaded, repetitive, or difficult to connect. Explaining those issues only in chat makes the user hunt through the page. Put temporary highlights on the actual passages in the existing web layout, with enough surrounding text to judge them.

The outcome is a shared view of where the user might revise, not an automatic rewrite or an AI-authorship score. Numbers and rectangles support that conversation. Match visible labels and explanations to the user's language and document context.

## What to highlight

- Start with the user's reading difficulties and the findings already discussed. A request to show "where" should locate those findings, not restart the review or invent additional problems.
- When the user also requests a review, use their writing preferences and project instructions. Identify a concrete reading difficulty: an unclear subject, too many ideas compressed together, repetition without new information, or an unexplained shift between ideas.
- Highlight the smallest passage that contains the problem; mark a larger section when its order or repetition is the issue. Keep neighboring text and the page design visible.
- Explain each finding briefly and tie it to its number. Treat it as a judgment the user can accept or reject. Do not label all polished phrasing, technical terms, or regular structure as bad or AI-written.
- Preserve the author's meaning, voice, and factual claims. Marking a passage does not authorize deletion, rewriting, or applying a proposed correction.

## Default presentation

- Use orange solid rectangles and number badges for individual passages, and blue outlines for broader groups under structural review.
- Match numbers to the findings discussed in chat. Preserve existing numbers when adding findings.
- Provide numbered navigation links at the edge of the screen. Wrap them on narrow screens and keep the text readable behind the controls.
- Preserve source text and links. Explain proposed edits in chat; a request to highlight passages does not authorize rewriting them.
- Add annotations only to the temporary preview, never to submitted copies, deployment files, or source styles. Hide outlines, badges, and navigation when printing.

## Workflow

1. Identify the page the user is working on, its preview tab, and source HTML. Locate each target passage or region and associate it with a finding number. Scope repeated phrases to the relevant section. Keep the current page's layout rather than extracting the text into a separate report.
2. Use a local server that reads the source and **adds annotation HTML/CSS only to the response**, or create a review copy in a temporary directory. Bind the server to `127.0.0.1`. Preserve relative asset paths so images and styles continue to load.
3. Wrap individual passages temporarily and add annotation classes to larger regions. Avoid string replacement across HTML tag boundaries. For simple replacements, verify that each target occurs exactly once. Use elements or text ranges for complex nesting.
4. Assign IDs such as `review-1` and link to them with `href="#review-1"`. Leave space between outlines and text, and prevent badges from overlapping preceding sentences. Annotations should follow the content as viewport width or zoom changes.
5. Open the review URL with the host's available browser tools. In Codex desktop, use `open_in_codex` for a side panel when available. In Claude Code or a terminal session, use an already configured browser integration or provide the local URL for the user to open. No particular browser plugin is required. Follow each tool's documented capabilities; do not mutate the DOM through a read-only evaluation API. Add annotation code to the locally served HTML instead.
6. When browser access is available, visually verify outlines, numbering, navigation, and wrapping. Capture a screenshot of the reviewed passage and keep the tab available for continued discussion. Otherwise, check the generated HTML and HTTP response, provide the URL, and state that visual verification is pending. Briefly explain that the source is unchanged.

## Minimal example

A complete fictional example is available in [examples/demo.html](examples/demo.html). It needs no dependencies and contains no user documents.

Insert this only into a temporary response or review copy. Adjust colors for the page background and translate visible labels as appropriate.

```html
<span class="review-box" id="review-1" data-review="1">Original passage under review</span>
<nav class="review-nav" aria-label="Review navigation">
  <span>Review highlights</span><a href="#review-1">1</a>
</nav>
<style>
.review-box {
  display: block; position: relative; margin: 26px 0 16px;
  outline: 2px solid #ff855c; outline-offset: 6px;
  border-radius: 0; scroll-margin-top: 90px;
}
.review-box::before {
  content: attr(data-review); position: absolute; left: -8px; top: -24px;
  min-width: 20px; padding: 0 3px; box-sizing: border-box;
  color: #15251a; background: #ff855c;
  font: 700 12px/20px sans-serif; text-align: center;
}
.review-group { outline-color: #59b7ee; }
.review-group::before { background: #59b7ee; }
.review-nav {
  position: fixed; right: 12px; bottom: 12px; z-index: 999;
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  max-width: calc(100vw - 24px); box-sizing: border-box;
  padding: 8px 12px; background: #fffdf6; color: #153523;
  border: 1px solid #153523; font: 12px/1.4 sans-serif;
}
.review-nav a { padding: 4px 7px; border: 1px solid #6e826e; color: inherit; }
@media print {
  .review-box { outline: none !important; }
  .review-box::before, .review-nav { display: none !important; }
}
</style>
```

## Continuing the review

Reuse the same temporary server and annotation list when possible. Do not chain preview servers by wrapping another review server's output. If source edits are requested, rebuild the preview from the updated source and verify that annotations still target the correct passages. When the review session ends, clean up only servers you started.

For external sites without local source, PDFs, or Word documents, first prepare a suitable review view using tools for that format instead of applying this HTML workflow directly. Do not upload personal information to external services merely to add highlights.
