# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [2.0.1] - 2026-10-19

### Changed

- `tree-sitter-objectscript` is now installed from the npm registry (version `1.10.2`, the same grammar as before) instead of a GitHub archive. The registry package ships prebuilt binaries for Windows, macOS and Linux (x64 and arm64), so a C/C++ compiler and Python are no longer needed on those platforms and the install takes seconds instead of minutes.
- The README installation steps use `npm install --save-dev prettier prettier-plugin-objectscript`.

### Added

- A workflow that publishes the package to npm when a `v*` tag is pushed.

## [2.0.0] - 2026-10-19

### Added

- `objectScriptBraceStyle` option (`next-line` or `same-line`) for the position of the opening brace of classes, methods, `XData`, `Storage`, `Query` and `Trigger`. Control-flow blocks (`If`, `For`, `Try`, ...) are not affected.
- `objectScriptBreakLongExpressions` option (default `false`) to break long parenthesized expressions after their binary operators.
- `npm run test:iris`: compiles and runs the fixtures against an IRIS Community container, as written and formatted, and fails if the behavior changes.
- `ClientMethod` support.
- `Operators.cls` fixture covering every binary operator and the contexts where spacing must be preserved.
- `GrammarUpdate.cls` fixture with constructs that the previous grammar reported as syntax errors.

### Changed

- **Breaking:** the default brace style is now `next-line`, following the InterSystems documentation. Use `"objectScriptBraceStyle": "same-line"` to keep the previous output.
- `tree-sitter-objectscript` updated from `6ee63cf` (27 July 2026) to `a1a5d7a` (9 October 2026). It removes the syntax errors previously reported for `ClientMethod`, macros used as statements, `Property` arguments, `Index ... On (A As EXACT, B(ELEMENTS))`, `ForeignKey ... References X()` and empty method bodies.
- Member keywords (`[ ... ]`) of methods, `XData`, `Query` and `Trigger` are printed by one helper as `[Kw1, Kw2]` and no longer break the line before the closing bracket.
- `Index ... On (A, B)` no longer has spaces inside the parentheses.
- A method with an empty body is printed as `{` and `}` on consecutive lines.

### Fixed

- Binary operators are now surrounded by spaces (`a*b+c` becomes `a * b + c`, `If x=1` becomes `If x = 1`). Concatenation (`_`), pattern matches (`?`), postconditionals (`Do:x=1`) and `For` ranges stay compact, because a space would change their meaning or is not conventional.
- The operands of subscripts (`x(i + 1, j)`, `^Data(x + 1, "a")`), extrinsic functions (`$$Func^Rtn(x + 1)`), unary expressions (`'(x < y)`) and `$Select`/`$Case` pairs are formatted instead of being copied from the source.
- Arguments of macro calls are kept as written, because macros are expanded as text and the community style guide warns that extra spaces can break the result.
- No whitespace is added inside a postconditional, unless the whole expression is parenthesized, as the InterSystems documentation requires. `Quit:$Piece(a, ",", 1)="" x` was printed with spaces that end the postconditional.
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
