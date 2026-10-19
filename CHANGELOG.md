# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `objectScriptBraceStyle` option (`next-line` or `same-line`) for the position of the opening brace of classes, methods, `XData`, `Storage`, `Query` and `Trigger`. Control-flow blocks (`If`, `For`, `Try`, ...) are not affected.
- `ClientMethod` support.
- `GrammarUpdate.cls` fixture with constructs that the previous grammar reported as syntax errors.

### Changed

- **Breaking:** the default brace style is now `next-line`, following the InterSystems documentation. Use `"objectScriptBraceStyle": "same-line"` to keep the previous output.
- `tree-sitter-objectscript` updated from `6ee63cf` (27 July 2026) to `a1a5d7a` (9 October 2026). It removes the syntax errors previously reported for `ClientMethod`, macros used as statements, `Property` arguments, `Index ... On (A As EXACT, B(ELEMENTS))`, `ForeignKey ... References X()` and empty method bodies.
- Member keywords (`[ ... ]`) of methods, `XData`, `Query` and `Trigger` are printed by one helper as `[Kw1, Kw2]` and no longer break the line before the closing bracket.
- `Index ... On (A, B)` no longer has spaces inside the parentheses.
- A method with an empty body is printed as `{` and `}` on consecutive lines.

### Fixed

- Macro call arguments (`$$$ERROR($$$GeneralError, "x")`) are formatted again after the grammar update (`macro_func_args`).
- Missing space between the return type and `[ Language = python ]`.

## [1.0.0] - 2026-09-30

First public release.

### Added

- Prettier 3 parser and printer for InterSystems ObjectScript class files (`.cls`), based on the UDL grammar of `tree-sitter-objectscript`.
- Command casing (`title`, `uppercase`, `lowercase`) and optional expansion of the official command abbreviations, including the `H` Halt/Hang distinction.
- Indentation of classes, members, block commands, legacy dotted blocks, expressions, argument lists and JSON literals.
- Verbatim preservation of `XData`, `Storage`, `Query` and non-ObjectScript trigger or method bodies.
- Optional strict parsing and selective AST debugging on `stderr`.
- Regression suite checking expected output, idempotence and parser diagnostics of the generated code.
