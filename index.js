/**
 * @file index.js
 * @description Entry point of the Prettier plugin for ObjectScript.
 *              Declares the supported languages and registers the parser
 *              and the printer used by Prettier.
 */

const { objectScriptParser } = require("./src/parser");
const { printObjectScript } = require("./src/printer");

// Tells Prettier which files this plugin handles.
const languagesDef = [
  {
    name: "ObjectScript",
    extensions: [".cls"],
    // Must match a key of `parsers` below.
    parsers: ["objectscript-parser"],
    // Language IDs used by editors such as VS Code.
    vscodeLanguageIds: ["objectscript", "cls", "objectscript-class"],
  },
];

const parsers = {
  "objectscript-parser": objectScriptParser,
};

// "objectscript-ast" is the `astFormat` declared by the parser.
const printers = {
  "objectscript-ast": {
    print: printObjectScript,
  },
};

const options = {
  // Option for command casing
  objectScriptCommandCase: {
    type: "choice",
    category: "ObjectScript",
    default: "title",
    choices: [
      {
        value: "title",
        description: "Use Canonical format (e.g., Set, Write)",
      },
      {
        value: "lowercase",
        description: "All lowercase (e.g., set, write)",
      },
      {
        value: "uppercase",
        description: "All uppercase (e.g., SET, WRITE)",
      },
    ],
    description: "Defines the casing for ObjectScript commands.",
  },
  // Option to expand abbreviations (s -> Set)
  objectScriptExpandCommands: {
    type: "boolean",
    category: "ObjectScript",
    default: true,
    description: "If true, expands abbreviations (e.g., 's' becomes 'Set').",
  },
  // Option for the position of the opening brace of declarations
  objectScriptBraceStyle: {
    type: "choice",
    category: "ObjectScript",
    default: "next-line",
    choices: [
      {
        value: "next-line",
        description: "Opening brace on its own line (InterSystems style)",
      },
      {
        value: "same-line",
        description: "Opening brace at the end of the declaration line",
      },
    ],
    description:
      "Position of the opening brace of classes, methods, XData, Storage, Query and Trigger.",
  },
  objectScriptBreakLongExpressions: {
    type: "boolean",
    category: "ObjectScript",
    default: false,
    description:
      "Break parenthesized expressions that exceed printWidth after their binary operators.",
  },
  objectScriptStrictParsing: {
    type: "boolean",
    category: "ObjectScript",
    default: false,
    description:
      "Fail instead of formatting when Tree-sitter reports syntax errors.",
  },
  objectScriptDebug: {
    type: "boolean",
    category: "ObjectScript Debug",
    default: false,
    description: "Write selective AST diagnostics to stderr.",
  },
  objectScriptDebugNodes: {
    type: "string",
    category: "ObjectScript Debug",
    default: "",
    description: "Comma-separated AST node types to trace.",
  },
  objectScriptDebugRange: {
    type: "string",
    category: "ObjectScript Debug",
    default: "",
    description:
      "Optional source offset range to trace, formatted as start:end.",
  },
  objectScriptDebugFile: {
    type: "string",
    category: "ObjectScript Debug",
    default: "",
    description: "Only trace files whose path contains this value.",
  },
  objectScriptDebugMax: {
    type: "int",
    category: "ObjectScript Debug",
    default: 200,
    description: "Maximum number of debug records emitted per formatting run.",
  },
};

module.exports = {
  languages: languagesDef,
  parsers,
  printers,
  options,
};
