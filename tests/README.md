# Validation notes

All fixtures and captured examples are fictional. No private user document is required.

## Automated coverage

`python3 -m unittest discover -s tests -v` runs six standard-library server tests:

- Source bytes stay unchanged; edits are read on the next request; the remove URL returns exact source bytes.
- Static styles and linked pages remain available; directory listings are rejected.
- Hidden files, root traversal, escaping symlinks, and foreign Host headers are rejected.
- Findings reload from disk; invalid JSON and duplicate finding IDs fail visibly.
- Optional replacement strings, including empty deletion previews, validate; non-string replacements are rejected.
- Local paths (including spaces), file URLs, and mapped loopback URLs resolve; remote URLs, query routes, and app routes are rejected.

`node tests/browser.cjs` uses Playwright Chromium with a disposable fixture and a free port. It checks original DOM, geometry and computed style preservation; relative assets and working links; inline tags, entities, normalized whitespace, explicit line breaks, block boundaries and Korean; withheld duplicate/missing/hidden/invalid targets; numbered navigation; 1100px and 375px wrapping and alignment; print CSS; source edit → refresh → withheld obsolete quote → deliberately updated finding; a new duplicate; invalid manifest; removal and an unannotated reload. It closes only its own browser/server and removes only its fixture directory.

Playwright is developer-only tooling. Install it as described in the repository README. Runtime users do not need Node, npm, or Playwright.

## Host checks

Checked on macOS on 2026-10-04:

- Python server tests passed on Python 3.10 and 3.14. The Chromium lifecycle test passed, including from a clean Git clone.
- Skill frontmatter validation passed with the skill-creator validator.
- Codex desktop: the bundled runtime was used in this implementation session. The fictional page was visually inspected in the in-app browser at its regular width and 375px, including numbered navigation. The published screenshot comes from that runtime.
- Claude Code 2.1.281: a fresh noninteractive session read the candidate skill and runtime reference, created exactly the requested finding #7 with Korean UI/reason, kept source bytes unchanged, and verified HTML/script/manifest/remove HTTP responses. It correctly left visual placement unverified. The host reaped its background tool server when the session exited; the runtime reference now documents persistent-terminal and detached-launch handling. This candidate check used an explicit skill path rather than automatic discovery.
- Installed Claude Code skill: after fast-forwarding the personal installation, a second fresh session invoked `/review-highlight-preview`, loaded the installed runtime reference, and produced exactly requested finding #12. A detached launch remained reachable after that session exited. An external check confirmed source SHA-256 preservation and exact unannotated-response bytes. Its generated page was then visually inspected in the Codex browser: only #12 was marked, with Korean controls. This verifies one installed invocation; it does not claim Claude had browser automation.

This does not establish cross-browser/platform compatibility, real production-site compatibility, or support for dynamic frameworks. Print hiding was checked through Chromium's print media emulation, not a physical printer. The automated fixture covers ordinary document scrolling; clipped nested scroll regions and transforms remain outside the supported scope.

## Numbered revision extension (2026-10-05)

The Chromium lifecycle test also covers manifest-loaded proposals, numbered text fields, multiple edits in the same text node and exact outline offsets, edits spanning inline emphasis, repeated original/revision toggling with exact DOM restoration, Korean labels, deletion previews, literal HTML-like input, untouched source/manifest bytes, refresh discarding field-only edits, stale/duplicate original quotes, protected links and block ranges, overlapping revisions, and removal restoring the original wording.

A fresh Claude Code candidate check loaded the updated skill by explicit path and received a request to replace #1 verbatim, shorten #2, and leave #3 alone. It added only the two requested `replacement` fields, preserved all original finding data and source bytes, and explained numbered follow-up input. The supervising check parsed and validated its JSON; Claude itself had no browser and did not claim visual verification. In Codex's browser, direct field editing and original/revision comparison were visually checked on the fictional example. This does not claim an additional installed slash-command test for the revision extension.
