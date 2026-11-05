#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const prettier = require("prettier");
const plugin = require("../index");
const { parserForFile, getParseDiagnostics } = require("../src/parser");

const samplesDir = path.resolve(__dirname, "../tests/samples");
const expectedDir = path.resolve(__dirname, "../tests/expected");

function diagnostics(source, file) {
  return getParseDiagnostics(parserForFile(file).parser.parse(source));
}

async function main() {
  fs.mkdirSync(expectedDir, { recursive: true });
  const files = fs
    .readdirSync(samplesDir)
    .filter((file) => /\.(cls|inc)$/.test(file))
    .sort();

  for (const file of files) {
    const input = fs.readFileSync(path.join(samplesDir, file), "utf8");
    const output = await prettier.format(input, {
      parser: parserForFile(file).name,
      plugins: [plugin],
      filepath: file,
    });
    const outputAgain = await prettier.format(output, {
      parser: parserForFile(file).name,
      plugins: [plugin],
      filepath: file,
    });
    const inputDiagnostics = diagnostics(input, file);
    const outputDiagnostics = diagnostics(output, file);

    if (output !== outputAgain) {
      throw new Error(
        `${file}: output is not idempotent; expected files not updated`,
      );
    }
    if (outputDiagnostics.length > inputDiagnostics.length) {
      throw new Error(
        `${file}: introduced parse diagnostics (${inputDiagnostics.length} -> ${outputDiagnostics.length})`,
      );
    }

    fs.writeFileSync(path.join(expectedDir, file), output, "utf8");
    console.log(
      `${file}: updated; diagnostics ${inputDiagnostics.length} -> ${outputDiagnostics.length}`,
    );
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
