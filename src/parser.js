/**
 * @file parser.js
 * @description ObjectScript parser based on the Tree-sitter UDL grammar.
 */

const Parser = require("tree-sitter");
const ObjectScript = require("tree-sitter-objectscript/udl");

const parser = new Parser();
parser.setLanguage(ObjectScript);

function getParseDiagnostics(rootNode, limit = 100) {
  const diagnostics = [];

  function visit(node) {
    if (diagnostics.length >= limit) return;
    if (node.type === "ERROR" || node.isMissing) {
      diagnostics.push({
        type: node.type,
        missing: Boolean(node.isMissing),
        startIndex: node.startIndex,
        endIndex: node.endIndex,
        startPosition: node.startPosition,
        endPosition: node.endPosition,
        text: node.text.slice(0, 160),
      });
    }
    for (const child of node.children || []) visit(child);
  }

  visit(rootNode);
  return diagnostics;
}

function createParseError(diagnostics) {
  const first = diagnostics[0];
  const line = first.startPosition.row + 1;
  const column = first.startPosition.column + 1;
  const kind = first.missing ? `missing ${first.type}` : first.type;
  const error = new SyntaxError(
    `ObjectScript parse error at ${line}:${column} (${kind}): ${JSON.stringify(first.text)}`,
  );
  error.name = "ObjectScriptParseError";
  error.diagnostics = diagnostics;
  return error;
}

const objectScriptParser = {
  parse(text, options = {}) {
    // The grammar emits ERROR nodes for "\r\n" after an argumentless command
    // (e.g. "Quit\r\n"). Prettier already normalizes to "\n"; this covers direct use.
    const tree = parser.parse(text.replace(/\r\n?/g, "\n"));
    const rootNode = tree.rootNode;

    if (options.objectScriptStrictParsing) {
      const diagnostics = getParseDiagnostics(rootNode);
      if (diagnostics.length > 0) throw createParseError(diagnostics);
    }

    return rootNode;
  },
  astFormat: "objectscript-ast",
  locStart: (node) => node.startIndex,
  locEnd: (node) => node.endIndex,
};

module.exports = { objectScriptParser, getParseDiagnostics };
