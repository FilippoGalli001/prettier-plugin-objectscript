# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [2.1.0] - 2026-11-05

### Added

- Include files (`.inc`) are formatted with the routine grammar of `tree-sitter-objectscript`. The `ROUTINE` header and the preprocessor directives (`#Define`, `#Def1Arg`, `#IfDef`, `#If`, `#Include`, ...) are formatted; comments and lines of code are copied as written, with their indentation, because a command in column 1 of a routine becomes a label.
- The Prettier parser `objectscript-include-parser`, chosen automatically for `.inc` files, and the VS Code language ID `objectscript-macros`.
- `Macros.inc` fixture; the IRIS check also formats `CheckMac.inc` and runs code that uses its macros.

### Changed

- Directive names in `#If` branches that the grammar keeps as text get the same casing as the parsed directives (`#define` → `#Define`).
- The class language no longer claims the VS Code language ID `objectscript`, which belongs to `.mac` routines: these were formatted with the class grammar.
- The README installs the plugin from the `v2.1.0` tag; its examples cover `.cls` and `.inc` files.

## [2.0.3] - 2026-11-05

### Fixed

These produced code that does not compile, that behaves differently, or that changes again when formatted a second time:

- A legacy `If`, `Else` or `For` without braces is kept on one line. Wrapping a long `Set` after it moved the rest of the line out of its scope, and IRIS rejected the result.
- A postconditional is never broken across lines, even when it is parenthesized (`Set:($Piece(...) = ...) x = 1`).
- `#If`, `#IfDef`, `#IfNDef`, `#ElseIf`, `#Else` and `#EndIf` stay on their own lines, and the statements of every branch are kept. Before, the block was joined on one line and the `#Else` branch was lost.
- `#Define` and `#Def1Arg` keep the macro name next to its parameters (`#Define Add(%a, %b)`) and `#Def1Arg` is no longer turned into `#Define`.
- Parenthesized values in JSON arrays (`[1, (x + 1)]`) are kept intact.
- Line comments inside call arguments, JSON literals and between `}` and `Catch` no longer swallow the code that follows them.
- An argumentless `h` followed by a comment stays `Halt` instead of becoming `Hang`.
- `Do { } While` keeps every condition and comment after `While`.
- `If` and `For` without arguments (`If  Write 1`, `For  Quit:x`) keep the two spaces before the next command.
- The body of a trigger with `Language = sql` (or another language other than ObjectScript) is copied as written instead of being formatted as ObjectScript.
- `objectScriptBreakLongExpressions` no longer breaks subscripts (`^Data(a + b)`).

### Changed

- `objectScriptExpandCommands: false` also applies to block commands (`I x {`, `F i = 1:1:3 {`).
- A list of conditions (`If a, b {`, `While a, b {`) breaks only when it does not fit.
- Formatted: class keywords (`[Abstract, Final]`), `Relationship`, `ForeignKey` and `Projection`; `Else`, `Print`, `ZBreak`, `ZLoad`, `ZSave`, `ZTrap` and `ZQuit` commands; the arguments of `##super`, `##expression`, name indirection and `Xecute`; `Include`, `IncludeGenerator` and `Import` lists; `Catch (ex)`.
- The README installs the plugin from the `v2.0.3` tag, shows the logo, and explains how to check the style in CI and before each commit.

### Added

- `tests/samples/Regressions.cls` and new checks in `tests/iris/Ops.cls` cover these cases; `npm run test:iris -- --verbose` prints the output of the IRIS check.

## [2.0.2] - 2026-11-01

### Changed

- Node.js 22 or newer is required (`engines.node` is `>=22`). With Node.js 18 and 20 the prebuilt binary of the `tree-sitter` runtime crashes when it is loaded, so npm compiles it from source, which fails without a C/C++ toolchain. With Node.js 22 and 24 the prebuilt binaries load and no compiler is needed.
- The README installs the plugin from the `v2.0.2` tag.

## [2.0.1] - 2026-10-19

### Changed

- `tree-sitter-objectscript` is now installed from the npm registry (version `1.10.2`, the same grammar as before) instead of a GitHub archive. The registry package ships prebuilt binaries for Windows, macOS and Linux (x64 and arm64), so a C/C++ compiler and Python are no longer needed on those platforms and the install takes seconds instead of minutes.
- The README installation steps install the plugin from a GitHub tag (`git+https://github.com/FilippoGalli001/prettier-plugin-objectscript.git#v2.0.1`). The plugin is not published to npm.

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
