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
