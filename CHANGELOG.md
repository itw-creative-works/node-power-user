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
