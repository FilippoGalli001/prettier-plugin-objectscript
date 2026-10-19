# Prettier Plugin for ObjectScript

An opinionated [Prettier 3](https://prettier.io/) plugin for InterSystems ObjectScript class files (`.cls`). Parsing is provided by the UDL grammar from [`tree-sitter-objectscript`](https://github.com/intersystems/tree-sitter-objectscript).

## Features

- canonical command casing and optional abbreviation expansion (`s` → `Set`);
- indentation for classes, methods, blocks, commands and JSON literals;
- formatting for ObjectScript expressions, arguments, types and object references;
- configurable brace position for class and member declarations (`next-line` by default);
- optional strict parsing;
- selective AST debugging on `stderr`;
- regression tests for expected output, valid output syntax and idempotence.

## Requirements

- Node.js 18.14 or newer;
- npm;
- Git when installing directly from GitHub;
- Prettier 3 (installed locally by the commands below);
- a C/C++ build toolchain and Python 3, because the ObjectScript grammar ships no prebuilt binaries and is compiled by [`node-gyp`](https://github.com/nodejs/node-gyp#installation) during `npm install`:
  - Windows: [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the "Desktop development with C++" workload;
  - macOS: Xcode Command Line Tools (`xcode-select --install`);
  - Linux: `make`, `g++` and `python3` (for example the `build-essential` package on Debian/Ubuntu).

If `npm install` fails with a `gyp ERR!` message, the toolchain is missing or not detected.

## Install and try the plugin step by step

The package is not yet published to the npm registry, so it is currently installed directly from GitHub.

### Option A: use it in an existing ObjectScript project

1. Open a terminal in the root of your project. If the project does not have a `package.json` yet, create one:

   ```bash
   npm init -y
   ```

2. Install the workspace-local copy of Prettier and this plugin:

   ```bash
   npm install --save-dev prettier git+https://github.com/FilippoGalli001/prettier-plugin-objectscript.git
   ```

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

### Option B: clone this repository and try it locally

1. Clone and enter the repository:

   ```bash
   git clone https://github.com/FilippoGalli001/prettier-plugin-objectscript.git
   cd prettier-plugin-objectscript
   ```

2. Install the pinned dependencies:

   ```bash
   npm install
   ```

3. Run the complete test suite:

   ```bash
   npm test
   ```

4. Preview the bundled example:

   ```bash
   npm run format:example
   ```

5. Try another fixture without modifying it:

   ```bash
   npx prettier tests/samples/FormatterStress.cls
   npx prettier tests/samples/SQLFormatterStress.cls
   ```

The local `.prettierrc` already loads `./index.js`. The Tree-sitter grammar is pinned to a specific commit and `package-lock.json` is versioned, so every installation uses the same parser.

## Configuration reference

### Options

| Option                       | Default | Description                                                 |
| ---------------------------- | ------- | ----------------------------------------------------------- |
| `objectScriptCommandCase`    | `title` | `title`, `uppercase` or `lowercase` command casing.         |
| `objectScriptExpandCommands` | `true`  | Expands command abbreviations.                              |
| `objectScriptBraceStyle`     | `next-line` | `next-line` or `same-line`: position of the opening brace of classes, methods, `XData`, `Storage`, `Query` and `Trigger`. |
| `objectScriptStrictParsing`  | `false` | Throws when Tree-sitter reports `ERROR` or missing nodes.   |
| `objectScriptDebug`          | `false` | Enables AST diagnostics on `stderr`.                        |
| `objectScriptDebugNodes`     | `""`    | Comma-separated node types to trace. Empty means all types. |
| `objectScriptDebugRange`     | `""`    | Optional source offset range (`start:end`).                 |
| `objectScriptDebugFile`      | `""`    | Only traces paths containing this value.                    |
| `objectScriptDebugMax`       | `200`   | Maximum debug records per formatting run.                   |

Strict parsing is opt-in because the upstream grammar can still report an error for some valid legacy ObjectScript constructs (the pinned version no longer does for `ClientMethod`, macros used as statements, `Property` arguments or `Index ... On` with `ELEMENTS`/`KEYS`). The test suite separately guarantees that every generated fixture parses without errors.

## Limitations

- Only class definition files (`.cls`, UDL format) are supported. Routines (`.mac`, `.int`, `.inc`) are not.
- Control-flow blocks (`If`, `For`, `Try`, ...) always keep the opening brace on the same line. `objectScriptBraceStyle` only affects class and member declarations: `next-line` (default) follows the InterSystems documentation, `same-line` gives `ClassMethod Run() {`.
- The content of `XData`, `Storage` and `Query` blocks, and of triggers or methods written in a language other than ObjectScript (SQL, Python, ...), is preserved verbatim.
- Regions that Tree-sitter cannot parse are left exactly as written instead of being formatted. Enable `objectScriptStrictParsing` to turn them into errors, or use `npm run inspect:ast` to locate them.

## CLI usage

When the plugin is listed in `.prettierrc`, normal Prettier commands are enough:

```bash
npx prettier MyClass.cls
npx prettier --write MyClass.cls
npx prettier --check "src/**/*.cls"
```

When developing the plugin without a configuration file, it can also be loaded explicitly:

```bash
npx prettier --plugin ./index.js example.cls
```

## Selective debugging

Debug output is structured as one JSON record per line, is written only to `stderr`, and never contaminates Prettier's formatted output.

Using Prettier options:

```bash
npx prettier --plugin ./index.js \
  --object-script-debug \
  --object-script-debug-nodes=oref_chain_segment,variable_datatype \
  --object-script-debug-max=20 \
  example.cls 2> objectscript-debug.log
```

The same filters can be supplied through environment variables:

```text
OBJECTSCRIPT_DEBUG=1
OBJECTSCRIPT_DEBUG_NODES=oref_chain_segment,variable_datatype
OBJECTSCRIPT_DEBUG_RANGE=100:500
OBJECTSCRIPT_DEBUG_FILE=Example.cls
OBJECTSCRIPT_DEBUG_MAX=20
```

`OBJECTSCRIPT_DEBUG` can also directly contain a comma-separated node list:

```bash
OBJECTSCRIPT_DEBUG=oref_chain_segment,json_object_literal_pair \
  npx prettier --plugin ./index.js example.cls 2> objectscript-debug.log
```

For a readable Tree-sitter subtree without running Prettier:

```bash
npm run inspect:ast -- example.cls oref_chain_segment variable_datatype
```

Without node types, the inspector prints parse diagnostics and node-type counts:

```bash
npm run inspect:ast -- example.cls
```

## Testing

Run the complete suite:

```bash
npm test
```

For every fixture the suite verifies:

1. the formatted output matches the reviewed file in `tests/expected/`;
2. formatting is idempotent;
3. the generated output has no Tree-sitter diagnostics;
4. command options, strict parsing and selective debug work as expected.

After an intentional formatter change, regenerate expected files only after reviewing the output:

```bash
npm run test:update
git diff -- tests/expected
npm test
```

The update script refuses to write expected files if formatting is non-idempotent or introduces parser diagnostics.

## VS Code setup step by step

The recommended integration uses the official Prettier extension together with the InterSystems ObjectScript extension. Prettier and this plugin remain local dependencies of the workspace; no global npm installation is required.

### Opening this repository in VS Code

1. Clone the repository, install its dependencies and open it:

   ```bash
   git clone https://github.com/FilippoGalli001/prettier-plugin-objectscript.git
   cd prettier-plugin-objectscript
   npm install
   code .
   ```

2. Trust the workspace when VS Code asks. Local Prettier modules and plugins are disabled in untrusted workspaces.

3. Install the recommended extensions when the workspace notification appears:

   - [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) (`esbenp.prettier-vscode`);
   - [InterSystems ObjectScript](https://marketplace.visualstudio.com/items?itemName=intersystems-community.vscode-objectscript) (`intersystems-community.vscode-objectscript`).

   They can also be installed from the terminal:

   ```bash
   code --install-extension esbenp.prettier-vscode
   code --install-extension intersystems-community.vscode-objectscript
   ```

4. Open a `.cls` file and verify that the language mode in the status bar is **ObjectScript Class**. Its VS Code language ID is `objectscript-class`.

5. Run **Format Document With... → Prettier - Code formatter**. If prompted, choose **Set as Default Formatter**.

6. Save the file. This repository already contains `.vscode/settings.json`, so format-on-save is enabled for `.cls` files.

### Enabling it in another ObjectScript workspace

1. Complete **Option A** in the installation section: install the packages and create `.prettierrc`.

2. Install the two VS Code extensions listed above.

3. Create `.vscode/settings.json` in the ObjectScript project:

   ```json
   {
     "[objectscript-class]": {
       "editor.defaultFormatter": "esbenp.prettier-vscode",
       "editor.formatOnSave": true
     },
     "prettier.requireConfig": true
   }
   ```

4. Optionally create `.vscode/extensions.json` so collaborators receive the same recommendations:

   ```json
   {
     "recommendations": [
       "esbenp.prettier-vscode",
       "intersystems-community.vscode-objectscript"
     ]
   }
   ```

5. Reload VS Code and format a `.cls` file. The Prettier extension resolves the workspace-local `prettier` package and `prettier-plugin-objectscript` from `node_modules`.

### VS Code troubleshooting

If formatting is not available:

1. verify that the workspace is trusted;
2. run `npm install` in the workspace root;
3. verify that `.prettierrc` contains `"plugins": ["prettier-plugin-objectscript"]`;
4. check that the current language mode is `ObjectScript Class` (`objectscript-class`);
5. run **Developer: Reload Window**;
6. inspect **View → Output → Prettier** for module-resolution errors.

Setting `prettier.prettierPath` is normally unnecessary and can make the workspace less portable.

## License

MIT
