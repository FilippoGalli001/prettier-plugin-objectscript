#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { objectScriptParser, getParseDiagnostics } = require("../src/parser");

const [inputFile, ...requestedTypes] = process.argv.slice(2);
if (!inputFile) {
  console.error(
    "Usage: npm run inspect:ast -- <file.cls> [node_type ...]\n" +
      "Without node types, prints diagnostics and node-type counts.",
  );
  process.exit(1);
}

const filePath = path.resolve(inputFile);
const source = fs.readFileSync(filePath, "utf8");
const root = objectScriptParser.parse(source);
const typeCounts = new Map();

function printNode(node, depth = 0) {
  const flags = [
    node.isNamed ? "named" : "anonymous",
    node.isMissing ? "missing" : "",
    node.hasError ? "has-error" : "",
  ].filter(Boolean);
  const snippet = node.text
    .slice(0, 160)
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
  console.log(
    `${"  ".repeat(depth)}${node.type} ` +
      `[${node.startPosition.row + 1}:${node.startPosition.column + 1}-` +
      `${node.endPosition.row + 1}:${node.endPosition.column + 1}] ` +
      `${flags.join(",")} ${JSON.stringify(snippet)}`,
  );
  for (const child of node.children || []) printNode(child, depth + 1);
}

function visit(node) {
  typeCounts.set(node.type, (typeCounts.get(node.type) || 0) + 1);
  if (requestedTypes.includes(node.type)) {
    console.log(
      `\n=== ${node.type}; parent=${node.parent?.type || "<root>"} ===`,
    );
    printNode(node);
  }
  for (const child of node.children || []) visit(child);
}

visit(root);
const diagnostics = getParseDiagnostics(root);
console.log(
  `\n${path.relative(process.cwd(), filePath)}: ` +
    `${root.endPosition.row + 1} lines, ${diagnostics.length} parse diagnostics`,
);

if (requestedTypes.length === 0) {
  for (const diagnostic of diagnostics) console.log(JSON.stringify(diagnostic));
  console.log("\nNode types:");
  for (const [type, count] of [...typeCounts].sort((a, b) => b[1] - a[1])) {
    console.log(`${type}: ${count}`);
  }
}
