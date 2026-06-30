# Project Progress Tracker
> Agents and maintainers should update this file regularly to reflect the current state of the project.

## Current Focus
* **Goal:** Add release date column to outdated table
* **Current Phase:** Phase 1 — complete
* **Priority:** Low
* **Last Updated:** 2026-06-29
* **Notes:** Feature implemented and tested. Ready for commit.

## Active Task List
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

## Completed Task List
