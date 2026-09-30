# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-09-30

First public release.

### Added

- Prettier 3 parser and printer for InterSystems ObjectScript class files (`.cls`), based on the UDL grammar of `tree-sitter-objectscript`.
- Command casing (`title`, `uppercase`, `lowercase`) and optional expansion of the official command abbreviations, including the `H` Halt/Hang distinction.
- Indentation of classes, members, block commands, legacy dotted blocks, expressions, argument lists and JSON literals.
- Verbatim preservation of `XData`, `Storage`, `Query` and non-ObjectScript trigger or method bodies.
- Optional strict parsing and selective AST debugging on `stderr`.
- Regression suite checking expected output, idempotence and parser diagnostics of the generated code.
