/**
 * @file parser.js
 * @description ObjectScript parsers based on the Tree-sitter grammars: UDL
 *              for class files (.cls), the routine grammar for routines
 *              (.mac, .int) and include files (.inc).
 */

const Parser = require("tree-sitter");
const ObjectScript = require("tree-sitter-objectscript");

function createTreeSitterParser(language) {
  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}

const udlParser = createTreeSitterParser(ObjectScript.objectscript_udl);
const routineParser = createTreeSitterParser(ObjectScript.objectscript_routine);

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

function createPrettierParser(treeSitterParser) {
  return {
    parse(text, options = {}) {
      // The grammar emits ERROR nodes for "\r\n" after an argumentless command
      // (e.g. "Quit\r\n"). Prettier already normalizes to "\n"; this covers direct use.
      const tree = treeSitterParser.parse(text.replace(/\r\n?/g, "\n"));
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
}

// Class definition files (`.cls`).
const objectScriptParser = createPrettierParser(udlParser);
// Include files (`.inc`): macro definitions and preprocessor directives.
const objectScriptIncludeParser = createPrettierParser(routineParser);
// Routines (`.mac`, `.int`). Same grammar as include files, but their code
// is formatted.
const objectScriptRoutineParser = createPrettierParser(routineParser);

// Prettier parser name and parser for a file, chosen by its extension.
function parserForFile(filePath) {
  if (/\.inc$/i.test(filePath)) {
    return { name: "objectscript-include-parser", parser: objectScriptIncludeParser };
  }
  if (/\.(mac|int)$/i.test(filePath)) {
    return { name: "objectscript-routine-parser", parser: objectScriptRoutineParser };
  }
  return { name: "objectscript-parser", parser: objectScriptParser };
}

module.exports = {
  objectScriptParser,
  objectScriptIncludeParser,
  objectScriptRoutineParser,
  parserForFile,
  getParseDiagnostics,
};
