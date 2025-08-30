# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2025-01-27

### 📝 Documentation
- Updated package references from `site-comparator` to `@akukral/site-comparator` in README.md
- Fixed programmatic usage examples to use correct scoped package name
- Updated PACKAGE_SUMMARY.md with proper package references
- Ensured all documentation reflects the correct npm package installation path

### 🔧 Maintenance
- Standardized package name references across all documentation files
- Improved clarity for users installing via npm

## [1.2.1] - 2025-01-30

### 🔧 Maintenance
- Version bump for npm patch release
- Updated user agent string to reflect new version
- Minor documentation updates

## [1.2.0] - 2025-08-29

### ✨ Added
- New `maxDiscovery` option to cap unique links discovered during crawling (default: 500)
- CLI flag `--max-discovery <number>` to configure discovery cap

### 🔧 Changed
- Default `maxPages` reduced from 50 to 20 to favor quicker, focused comparisons
- Discovery loop now caps based on pages actually crawled rather than URLs discovered
- Progress logging updated to reflect pages crawled

### 📝 Documentation
- README updated with new defaults and `maxDiscovery` option (CLI and programmatic examples)
- Help text updated to show `--max-discovery` and revised defaults

### 🐛 Fixes
- Improved alignment between discovered pages and compared common paths by capping on crawled pages

## [1.1.0] - 2025-08-29

### 🔒 Security
- **BREAKING CHANGE**: Completely redesigned password input system
- Password keystrokes are now completely invisible during interactive authentication
- Replaced custom terminal manipulation with professional `readline-sync` library
- Enhanced security by eliminating any visual feedback during password entry

### ✨ Added
- New dependency: `readline-sync` for secure CLI password input
- Professional-grade authentication prompts
- Better cross-platform compatibility for password input

### 🔧 Changed
- Simplified authentication code from ~40 lines to ~3 lines
- Improved reliability of password input across different terminal environments
- Better error handling in authentication flow

### 🐛 Fixed
- Fixed password input showing asterisks between keystrokes
- Resolved terminal compatibility issues with password hiding
- Eliminated potential security vulnerabilities in custom terminal manipulation

### 📦 Dependencies
- Added `readline-sync@^1.4.10`

## [1.0.4] - Previous Release

### ✨ Features
- Intelligent content analysis between websites
- Offset-aware comparison detection
- HTTP Basic Authentication support
- Automatic crawling and page discovery
- Comprehensive HTML and JSON reporting
- Spurious difference filtering
- Flexible configuration options

### 🔧 Technical
- Built with Node.js 16+ compatibility
- Uses Puppeteer for web scraping
- Cheerio for HTML parsing and analysis
- Longest Common Subsequence (LCS) algorithm for content comparison

---

## Version History Summary

- **1.1.0**: Enhanced security with completely hidden password input
- **1.0.4**: Stable release with core functionality
- **1.0.0**: Initial release with intelligent content comparison

For detailed information about each version, see the [README.md](README.md) file.
