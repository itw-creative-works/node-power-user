# CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## Changelog Categories

- `BREAKING` for breaking changes.
- `Added` for new features.
- `Changed` for changes in existing functionality.
- `Deprecated` for soon-to-be removed features.
- `Removed` for now removed features.
- `Fixed` for any bug fixes.
- `Security` in case of vulnerabilities.

---
## [2.1.6] - 2026-06-17
### Fixed
- `npu outdated` no longer falsely flags minor-only version bumps as breaking changes (e.g. `electron-builder` 26.8.1 → 26.15.3 was incorrectly showing ⚠). The check now compares actual semver major version numbers instead of relying on ncu tier comparison, which silently broke when ncu omitted a package from its minor tier.
- "Major" menu option in `npu out` no longer appears when all available upgrades are minor bumps — same root cause fix applied to the menu visibility logic.

### Added
- Comprehensive test suite: 132 tests across 7 files covering CLI routing, outdated version classification, `lib/npm` helpers (with temp fixture directories), bump logic, version command, and wait command. The notifly-desktop false-positive scenario is a dedicated fixture test.

---
## [2.1.5] - 2026-06-11
### Fixed
- `npu outdated` installs (Sync and Patch/Minor/Major) now remove the targeted `node_modules` copies before installing — the same stale-lockfile fix applied to `npu install` in 2.1.4. Previously, when `node_modules` was physically stale but the lockfiles already recorded the new versions (e.g. after a Socket-blocked install), `npm install pkg@version` reported "up to date" without installing anything, trapping projects in an endless Reconcile ↔ Update loop where every action "succeeded" but `node_modules` never changed.
- `npu out -r` (Reconcile) is now strictly ahead-only. It no longer falls back to downgrading `package.json` to match a stale install when no packages are ahead — instead it points you at Sync.
- Sync now handles Socket risk-blocks gracefully: it lists the flagged packages, suggests `socket npm update <pkg>` for fixable CVEs in transitive deps pinned by `package-lock.json`, and offers `npu out --sync --force` — instead of crashing with an unhandled rejection.
- The CLI bin now exits with code 1 on command failure instead of crashing with an unhandled rejection (which dumped bundled npm-check-updates source to the terminal).
- `npm test` script invokes `mocha` from PATH — mocha ≥9 ships `bin/mocha.js`, so the hardcoded `./node_modules/mocha/bin/mocha` path no longer exists.

### Added
- Integrity check on every `npu outdated` run: npu compares what `node_modules/.package-lock.json` claims is installed against the packages physically on disk — including transitive deps the table can't show — and warns about desynced copies (the silent-no-op corruption left behind by interrupted or Socket-blocked installs). Platform-skipped optional packages (e.g. `@esbuild/*`, `fsevents`) are correctly ignored.
- **Heal** action for `npu outdated` (menu option + `--heal` flag): removes desynced copies and reinstalls under Socket so node_modules matches the lockfile again, then re-verifies. Runs even when the version table itself is clean.
- Post-install verification for `npu outdated`: after Sync or Patch/Minor/Major installs, npu confirms the requested versions physically landed in `node_modules` and errors loudly if npm silently did nothing.
- `--sync` shortcut flag for `npu out` to install behind packages without the interactive menu.
- Shared `lib/npm.js` helpers (`removeInstalledCopies`, `removeLocations`, `findDesynced`, `verifyInstalled`) used by both `install` and `outdated`.

### Changed
- Failed or Socket-blocked installs in `npu outdated` now restore `package-lock.json` alongside `package.json`. Previously only `package.json` was restored, which could leave the lockfile advanced past the physical files — the exact desync that mints silent no-op installs. Blocked installs deliberately do NOT auto-reinstall the removed copies (that would bypass the Socket block); they stay removed and are reported as missing until resolved.

---
## [2.1.4] - 2026-06-09
### Added
- `--cwd` / `-C` flag to run npu against a different directory (e.g. `npu -C /path/to/project out`).

### Fixed
- `npu install pkg@latest` now actually installs the latest version. Previously npm would report "up to date" due to stale lockfile caching — npu now removes the existing `node_modules` copy before re-installing when an explicit version or tag is specified.
- `npu outdated` discrepancy handling now distinguishes direction: **Sync** installs packages where `node_modules` is behind `package.json`, while **Reconcile** updates `package.json` where `node_modules` is ahead. Previously, Reconcile would always downgrade `package.json` to match an older installed version.

---
## [2.1.3] - 2026-05-18
### Changed
- Bumped `@inquirer/prompts` 8.3.2 → 8.4.3.
- Bumped `npm-check-updates` 20.0.0 → 22.2.0. Verified `ncu.run()` return shape and target filtering (patch/minor/latest) are unchanged from ncu@20 for our usage.
- Bumped `prepare-package` 2.0.7 → 2.1.0.

---
## [2.1.2] - 2026-05-18
### Fixed
- Socket wrap no longer mislabels npm subprocess failures (ERESOLVE, peer-dep conflicts, network errors) as supply chain risk-blocks. The thrown error now carries a `reason` of either `socket-blocked` or `npm-failed`, and `npu install` / `npu outdated` show an honest "npm install failed" message with proper next-step advice instead of misleading Socket bypass instructions.
- Removed `warning` and `alert` from the Socket risk-marker regex to eliminate false positives from unrelated npm output.
- Applied the same exit-code-vs-output discrimination to `socket.audit` so audit subprocess failures aren't mislabeled as risk findings.

---
## [2.1.1] - 2026-04-02
### Added
- Standalone `npu audit` command for running Socket supply chain audit on current dependency tree

---
## [2.1.0] - 2026-04-02
### Added
- Socket CLI supply chain protection for `npu install` and `npu outdated` commands
- New `npu install` (`npu i`) command with Socket wrapping and post-install audit
- `--ignore` flag for outdated command to exclude packages (e.g. `--ignore mocha`)
- `--force` flag to bypass Socket protection with `SOCKET_CLI_ACCEPT_RISKS=1`
- Trace flagged transitive dependencies back to their parent packages
- Suggested retry commands when Socket blocks an install
- Development section in README

### Changed
- Outdated command backs up and restores package.json when installs fail
- Installs target specific package versions instead of generic `npm install`
- Graceful Ctrl+C handling instead of dumping stack traces

### Removed
- `.npmignore` in favor of `package.json` `files` field

### Security
- All installs wrapped with Socket CLI to detect malicious packages before installation

---
## [2.0.1] - 2026-03-15
### Fixed
- Fixed outdated command shortcut flags and options parsing
- Updated tests

---
## [2.0.0] - 2026-02-24
### BREAKING
- Upgraded yargs v16 to v18: updated CLI entry point to use `parseSync()` API
- Upgraded chalk v4 to v5: requires Node 22+ for ESM `require()` support
- Upgraded @inquirer/prompts v7 to v8

### Changed
- Updated all `require('chalk')` to `require('chalk').default` for chalk v5 ESM compatibility
- Improved outdated command menu: Minor/Major options only show when relevant updates exist
- Made breaking changes legend conditional on actual major updates being present
- Updated npm-check-updates to v19.5 and itwcw-package-analytics to v1.0.8

---
## [1.0.0] - 2024-06-19
### Added
- Initial release of the project 🚀
