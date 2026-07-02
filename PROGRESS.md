# Project Progress Tracker
> Agents and maintainers should update this file regularly to reflect the current state of the project.

## Current Focus
* **Goal:** Make the npu/sfw wrapper system trustworthy — live output, honest failure reporting, exit codes, full flag pass-through, correct npm routing
* **Current Phase:** Phase 2 — complete (round 2 included)
* **Priority:** High
* **Last Updated:** 2026-07-01
* **Notes:** Rounds 1+2 done: 216 npu tests green; dotfiles suite 32/33 (the 1 failure is the pre-existing Time Machine sparsebundle check — volume not mounted). Verified live: shim fast path + failure path, `npm create --help` routing, install `--dry-run --no-fund` pass-through. Companion dotfiles changes: .zshrc npm() + .local/bin/npm shim route exec|create|init → `npu npm` (no rewrite); zshrc.test.zsh assertion updated. Both repos uncommitted; npu version bump on ship. Somiibo has 1 pre-existing failing test (`device() still throws a clear not-available error`) — likely mid-stream Phase 6 work, NOT touched; it's what made `npx mgr test` exit non-zero (the trigger of the original false "blocked" report).

## Active Task List
* [x] Phase 2: `npu npx` overhaul — streaming, block detection, exit codes, pass-through
  * [x] Task 2.1: Tests first — red run reproducing all four bugs (buffered output, false "blocked", exit 0 on failure, eaten flags)
  * [x] Task 2.2: `lib/npx-args.js` — pure raw-argv parsing (`parseNpxArgs`, `firstPositional`, `buildCommand` with shell quoting)
  * [x] Task 2.3: `lib/socket.js` — wrap() streams output live (echo-through + FORCE_COLOR on TTY), classifies failures via sfw block markers (`isBlockOutput`), exposes `err.reason` ('sfw-blocked' | 'command-failed') + `err.code`
  * [x] Task 2.4: `commands/npx.js` — local-binary fast path (skip sfw when `node_modules/.bin/<bin>` exists), raw flag pass-through, `npu --force npx <cmd>` prefix form, `process.exitCode` propagation
  * [x] Task 2.5: `bin/node-power-user` — expose `argv.raw`, disable yargs `--help`/`--version` interception, `boolean('force')`
  * [x] Task 2.6: `commands/install.js` + `commands/outdated.js` — new failure classification ('command-failed'), install exit codes
  * [x] Task 2.7: Full suite green — 205 tests (29 new)
  * [x] Task 2.8: Real-world verify via `~/.local/bin/npx` shim: fast path streams + exit 0 on pass; failing child → exit 1 + "Command failed", no false block
  * [x] Task 2.9: Doc parity — README "Run Packages (npx)" section, CHANGELOG [Unreleased], PROGRESS
  * [x] Task 2.10: Round 2 — fast-path hole closed (`--package`/`-p` never skips the firewall; `forcesDownload` guard)
  * [x] Task 2.11: Round 2 — `install.js` raw flag pass-through (whitelist dropped; `npu --force i` prefix grammar)
  * [x] Task 2.12: Round 2 — new `npu npm <args>` sfw-wrapped passthrough command
  * [x] Task 2.13: Round 2 — bare `npx --version`/`--help` silent passthrough (fixes noisy dotfiles activation test honestly)
  * [x] Task 2.14: Round 2 — dotfiles: .zshrc + npm shim route `npm exec|create|init` → `npu npm` (`npm create X` no longer misruns package X)
  * [x] Task 2.15: Round 2 — suites green: npu 216, dotfiles 32/33 (1 pre-existing TM env failure); live verifies (create routing, install dry-run pass-through)
  * [x] Task 2.16: Round 2 — doc parity: README install/npx/npm sections (incl. sfw drift + phantom post-install audit), CHANGELOG, PROGRESS

## Completed Task List
* [x] Phase 1: Add "Released" column + `--min-age` auto-skip to `npu out` / `npu update`
  * [x] Task 1.1: Fetch publish dates from npm registry in parallel via `npm view <pkg> time --json`
  * [x] Task 1.2: Add "Released" column showing `YYYY-MM-DD (Xd)` format
  * [x] Task 1.3: Show magenta ⚠ on dates < `--min-age` threshold (default 7 days)
  * [x] Task 1.4: Auto-skip too-new packages during patch/minor/major updates (unless already installed)
  * [x] Task 1.5: Log skipped packages with clear message + `--min-age 0` hint
  * [x] Task 1.6: Pass reject list to ncu.run upgrade to prevent writing skipped packages to package.json
  * [x] Task 1.7: Update legend to show both major ⚠ and age ⚠
  * [x] Task 1.8: Test: default (7d), --min-age 0 (no filter), --min-age 30 (aggressive), all-skipped edge case
  * [x] Task 1.9: All 141 existing tests pass
  * [x] Task 1.10: Add 35 new tests (minAge parsing, tooNew filtering, display logic, daysSincePublish calc, integration)
  * [x] Task 1.11: Full suite passes — 176 tests
