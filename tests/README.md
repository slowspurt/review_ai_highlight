# Validation notes

All fixtures and captured examples are fictional. No private user document is required.

## Automated coverage

`python3 -m unittest discover -s tests -v` runs five standard-library server tests:

- Source bytes stay unchanged; edits are read on the next request; the remove URL returns exact source bytes.
- Static styles and linked pages remain available; directory listings are rejected.
- Hidden files, root traversal, escaping symlinks, and foreign Host headers are rejected.
- Findings reload from disk; invalid JSON and duplicate finding IDs fail visibly.
- Local paths (including spaces), file URLs, and mapped loopback URLs resolve; remote URLs, query routes, and app routes are rejected.

`node tests/browser.cjs` uses Playwright Chromium with a disposable fixture and a free port. It checks original DOM, geometry and computed style preservation; relative assets and working links; inline tags, entities, normalized whitespace, explicit line breaks, block boundaries and Korean; withheld duplicate/missing/hidden/invalid targets; numbered navigation; 1100px and 375px wrapping and alignment; print CSS; source edit → refresh → withheld obsolete quote → deliberately updated finding; a new duplicate; invalid manifest; removal and an unannotated reload. It closes only its own browser/server and removes only its fixture directory.

Playwright is developer-only tooling. Install it as described in the repository README. Runtime users do not need Node, npm, or Playwright.

## Host checks

Checked on macOS on 2026-10-04:

- Python server tests and the Chromium lifecycle test passed.
- Skill frontmatter validation passed with the skill-creator validator.
- Codex desktop: the bundled runtime was used in this implementation session. The fictional page was visually inspected in the in-app browser at its regular width and 375px, including numbered navigation. The published screenshot comes from that runtime.
- Claude Code 2.1.281: a fresh noninteractive session read the candidate skill and runtime reference, created exactly the requested finding #7 with Korean UI/reason, kept source bytes unchanged, and verified HTML/script/manifest/remove HTTP responses. It correctly left visual placement unverified. The host reaped its background tool server when the session exited; the runtime reference now documents persistent-terminal and detached-launch handling. This candidate check used an explicit skill path rather than automatic discovery.

This does not establish cross-browser/platform compatibility, real production-site compatibility, or support for dynamic frameworks. Print hiding was checked through Chromium's print media emulation, not a physical printer. The automated fixture covers ordinary document scrolling; clipped nested scroll regions and transforms remain outside the supported scope.
