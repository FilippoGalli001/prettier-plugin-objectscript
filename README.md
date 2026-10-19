# Prettier Plugin for ObjectScript

An opinionated [Prettier 3](https://prettier.io/) plugin for InterSystems ObjectScript class files (`.cls`). Parsing is provided by the UDL grammar from [`tree-sitter-objectscript`](https://github.com/intersystems/tree-sitter-objectscript).

To get started, check the [requirements](#requirements) and follow the [installation](#installation) steps.

## Example

Input (`example.cls`):

```text
Class Demo.Greeter Extends %RegisteredObject {
Property Name As %String [Required];

/// Returns a greeting for the given name.
ClassMethod Greet(name As %String="world",times As %Integer=1) As %String [ Private ]
{
 s result=""
 f i=1:1:times {
 s result=result_"Hello, "_name_"! "
 }
 q:name="" "nobody"
 i times>1 { w "Greeted ",times," times",! }
 q result
}
}
```

Output of `npx prettier --plugin ./index.js example.cls`:

```objectscript
Class Demo.Greeter Extends %RegisteredObject
{
  Property Name As %String [Required];

  /// Returns a greeting for the given name.
  ClassMethod Greet(
    name As %String = "world",
    times As %Integer = 1
  ) As %String [Private]
  {
    Set result = ""
    For i = 1:1:times {
      Set result = result_"Hello, "_name_"! "
    }
    Quit:name="" "nobody"
    If times > 1 {
      Write "Greeted ", times, " times", !
    }
    Quit result
  }
}
```

Abbreviated commands are expanded, braces and indentation are normalized, and binary operators get spaces. Concatenation (`_`) and postconditionals (`Quit:name=""`) stay compact because a space would change their meaning.

## Features

- canonical command casing and optional abbreviation expansion (`s` → `Set`);
- indentation for classes, methods, blocks, commands and JSON literals;
- spaces around binary operators and after commas in arguments;
- formatting for ObjectScript expressions, arguments, types and object references;
- configurable brace position for class and member declarations (`next-line` by default);
- optional strict parsing;
- regression tests that check the expected output, valid output syntax, idempotence and, with Docker, the behavior in InterSystems IRIS.

## Requirements

- Node.js 18.14 or newer;
- npm;
- Prettier 3 (installed locally by the commands below).

The ObjectScript parser, [`tree-sitter-objectscript`](https://www.npmjs.com/package/tree-sitter-objectscript), is installed automatically with prebuilt binaries for Windows, macOS and Linux (x64 and arm64), so no compiler is needed on those systems. It takes about 400 MB of disk space because it bundles the binaries of all platforms.

On other platforms (for example Linux with musl, such as Alpine), npm compiles the parser with [`node-gyp`](https://github.com/nodejs/node-gyp#installation), which requires a C/C++ build toolchain and Python 3:

- Windows: [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the "Desktop development with C++" workload;
- macOS: Xcode Command Line Tools (`xcode-select --install`);
- Linux: `make`, `g++` and `python3` (for example the `build-essential` package on Debian/Ubuntu).

If `npm install` fails with a `gyp ERR!` message, the toolchain is missing or not detected. Python 3.12 or newer requires `node-gyp` 10 or later, which is included in npm 10 and newer.

## Installation

1. Open a terminal in the root of your project. If the project does not have a `package.json` yet, create one:

   ```bash
   npm init -y
   ```

2. Install the workspace-local copy of Prettier and this plugin:

   ```bash
   npm install --save-dev prettier prettier-plugin-objectscript
   ```

   To install from GitHub instead (this requires Git), use `git+https://github.com/FilippoGalli001/prettier-plugin-objectscript.git#v2.0.1`. The suffix selects a [tag](https://github.com/FilippoGalli001/prettier-plugin-objectscript/tags); without it, npm installs the latest commit of `main`.

3. Create `.prettierrc` in the project root:

   ```json
   {
     "plugins": ["prettier-plugin-objectscript"],
     "tabWidth": 2,
     "printWidth": 100,
     "objectScriptCommandCase": "title",
     "objectScriptExpandCommands": true,
     "objectScriptStrictParsing": false
   }
   ```

4. Preview the formatted result without changing the file:

   ```bash
   npx prettier path/to/MyClass.cls
   ```

5. Format one file in place:

   ```bash
   npx prettier --write path/to/MyClass.cls
   ```

6. Format or check all `.cls` files:

   ```bash
   npx prettier --write "src/**/*.cls"
   npx prettier --check "src/**/*.cls"
   ```

A file is considered stable when formatting it a second time produces no further changes. The test suite verifies this idempotence for every fixture.

To work on the plugin itself, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Configuration

Options are set in `.prettierrc` or passed on the command line (for example `--object-script-brace-style=same-line`).

| Option                             | Default     | Description                                                                                                               |
| ---------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| `objectScriptCommandCase`          | `title`     | `title`, `uppercase` or `lowercase` command casing.                                                                       |
| `objectScriptExpandCommands`       | `true`      | Expands command abbreviations.                                                                                            |
| `objectScriptBraceStyle`           | `next-line` | `next-line` or `same-line`: position of the opening brace of classes, methods, `XData`, `Storage`, `Query` and `Trigger`. |
| `objectScriptBreakLongExpressions` | `false`     | Breaks parenthesized expressions longer than `printWidth` after their binary operators. Experimental: see Limitations.    |
| `objectScriptStrictParsing`        | `false`     | Throws when Tree-sitter reports `ERROR` or missing nodes.                                                                 |

Strict parsing is opt-in because the upstream grammar can still report an error for some valid legacy ObjectScript constructs (the pinned version no longer does for `ClientMethod`, macros used as statements, `Property` arguments or `Index ... On` with `ELEMENTS`/`KEYS`). The test suite separately guarantees that every generated fixture parses without errors.

The debugging options (`objectScriptDebug*`) are described in [CONTRIBUTING.md](CONTRIBUTING.md#selective-debugging).

## Limitations

- Only class definition files (`.cls`, UDL format) are supported. Routines and include files (`.mac`, `.int`, `.inc`) are not.
- Control-flow blocks (`If`, `For`, `Try`, ...) always keep the opening brace on the same line. `objectScriptBraceStyle` only affects class and member declarations: `next-line` (default) follows the InterSystems documentation, `same-line` gives `ClassMethod Run() {`.
- Binary operators are surrounded by spaces, and the arguments of function calls and subscripts get a space after each comma (`^Data(x + 1, "a")`). The exceptions are the concatenation `_`, pattern matches and the arguments of macro calls (`$$$ERROR($$$GeneralError,"x")`), which are kept as written because macros are expanded as text.
- Postconditionals (`Quit:x=1 ...`), `For` ranges and timeouts are printed without added whitespace, because a space would end them. A postconditional that is entirely parenthesized, `Quit:(x = 1)`, is spaced like any other expression.
- Subscripts are never broken across lines. Long lines are only wrapped at the commas of function arguments, unless `objectScriptBreakLongExpressions` is enabled, which also breaks parenthesized expressions after their operators. The InterSystems documentation allows line breaks within command arguments and parentheses but does not state the rule for operators, so the option is disabled by default: check the result with the compiler before enabling it.
- The bodies of `XData`, `Storage` and `Query`, and of triggers and methods written in another language (SQL, Python, ...), are copied verbatim; their headers, their keywords and the position of the opening brace are still formatted. Triggers written in ObjectScript are formatted like methods.
- Regions that Tree-sitter cannot parse are left exactly as written instead of being formatted. Enable `objectScriptStrictParsing` to turn them into errors, or use `npm run inspect:ast` to locate them.

## Editor integration

The plugin works with the Prettier extension of VS Code. Once the plugin is installed and `.prettierrc` is configured, this `.vscode/settings.json` formats `.cls` files on save:

```json
{
  "[objectscript-class]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true
  },
  "prettier.requireConfig": true
}
```

The full setup and troubleshooting are in [docs/vscode.md](docs/vscode.md).

## License

MIT
