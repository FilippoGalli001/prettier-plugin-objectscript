# Contributing

## Working on the plugin locally

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

Without a `.prettierrc`, the plugin can be loaded explicitly:

```bash
npx prettier --plugin ./index.js example.cls
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

### Checking the behavior against IRIS

`npm run test:iris` starts a throwaway [InterSystems IRIS Community](https://hub.docker.com/r/intersystems/iris-community) container (Docker is required, the first run downloads about 3.5 GB) and checks that formatting does not change what the code does:

1. the fixtures in `tests/samples` are compiled as written and after formatting with `next-line`, `same-line` and `objectScriptBreakLongExpressions`; the compilation messages must be the same (some fixtures use classes that do not exist in a clean IRIS, so only differences count);
2. `tests/iris/Ops.cls` is executable: `Check.Ops.Run()` must print exactly the same output before and after formatting.

Set `IRIS_IMAGE` to use another image. Pass `-- --keep` to keep the container for inspection.

After an intentional formatter change, regenerate expected files only after reviewing the output:

```bash
npm run test:update
git diff -- tests/expected
npm test
```

The update script refuses to write expected files if formatting is non-idempotent or introduces parser diagnostics.

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

The debug options are:

| Option                   | Default | Description                                                 |
| ------------------------ | ------- | ----------------------------------------------------------- |
| `objectScriptDebug`      | `false` | Enables AST diagnostics on `stderr`.                        |
| `objectScriptDebugNodes` | `""`    | Comma-separated node types to trace. Empty means all types. |
| `objectScriptDebugRange` | `""`    | Optional source offset range (`start:end`).                 |
| `objectScriptDebugFile`  | `""`    | Only traces paths containing this value.                    |
| `objectScriptDebugMax`   | `200`   | Maximum debug records per formatting run.                   |

The editor setup for this repository is described in [docs/vscode.md](docs/vscode.md).
