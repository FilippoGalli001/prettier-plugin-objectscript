/**
 * @file printer.js
 * @description Core printing (formatting) logic for ObjectScript code.
 */

const {
  doc: {
    builders: {
      concat,
      hardline,
      indent,
      join,
      group,
      line,
      literalline,
      markAsRoot,
      softline,
      trim,
    },
  },
} = require("prettier");

const {
  inSpaceSensitiveContext,
  endsWithArgumentlessCommand,
  printCommandArgs,
  printArgumentsList,
  printMethodArgs,
  printSmartType,
  printConditionList,
} = require("./utils");
const { traceNode } = require("./debug");

// =================================================================
// CONSTANTS
// =================================================================

const COMMAND_MAP = {
  set: "Set",
  write: "Write",
  read: "Read",
  kill: "Kill",
  new: "New",
  do: "Do",
  quit: "Quit",
  return: "Return",
  if: "If",
  else: "Else",
  try: "Try",
  catch: "Catch",
  elseif: "ElseIf",
  for: "For",
  while: "While",
  break: "Break",
  continue: "Continue",
  hang: "Hang",
  halt: "Halt",
  job: "Job",
  lock: "Lock",
  open: "Open",
  close: "Close",
  use: "Use",
  view: "View",
  xecute: "Xecute",
  throw: "Throw",
  tstart: "TStart",
  tcommit: "TCommit",
  trollback: "TRollback",
  zwrite: "ZWrite",
  zkill: "ZKill",
  znspace: "ZNspace",
  merge: "Merge",
  goto: "Goto",
  print: "Print",
  zbreak: "ZBreak",
  zload: "ZLoad",
};

// Official ObjectScript command abbreviations. `h` is missing because it depends
// on the arguments: Halt without arguments, Hang with arguments.
const COMMAND_ABBREVIATIONS = {
  b: "break",
  c: "close",
  cont: "continue",
  d: "do",
  e: "else",
  f: "for",
  g: "goto",
  i: "if",
  j: "job",
  k: "kill",
  l: "lock",
  m: "merge",
  n: "new",
  o: "open",
  p: "print",
  q: "quit",
  r: "read",
  ret: "return",
  s: "set",
  tc: "tcommit",
  th: "throw",
  tro: "trollback",
  ts: "tstart",
  u: "use",
  v: "view",
  w: "write",
  x: "xecute",
  zb: "zbreak",
  zk: "zkill",
  zl: "zload",
  zn: "znspace",
  zw: "zwrite",
};

const ATOMIC_TYPES = new Set([
  "intrinsic_function",
  "storage_body_content",
  "sql_statement",
  "class_name",
  "package_name",
  "dotted_identifier_strict_token_immediate",
  "identifier_segment_immediate",
  "tag",
  "label",
  "comment",
  "line_comment",
  "line_comment_1",
  "line_comment_2",
  "line_comment_3",
  "documatic_line",
  "///",
  "//",
  ";",
  "#;",
  "#",
  "system_variable",
  "objectscript_identifier",
  "method_name",
  "property_name",
  "parameter_name",
  "dollar_system_keyword",
  "namespace_token",
  "keyword_class",
  "keyword_classmethod",
  "keyword_method",
  "keyword_parameter",
  "keyword_property",
  "keyword_try",
  "keyword_catch",
  "keyword_if",
  "keyword_else",
  "keyword_elseif",
  "keyword_for",
  "keyword_while",
  "keyword_quit",
  "keyword_return",
  "keyword_set",
  "keyword_do",
  "keyword_write",
  "keyword_kill",
  "keyword_new",
  "keyword_zn",
  "keyword_dim",
  "keyword_as",
  "keyword_output",
  "'[",
  "||",
  "'=",
  ">",
  "<",
  "_",
  "!",
  "&",
]);

// =================================================================
// PRINTING HELPERS
// =================================================================

function rawNodeText(node, options) {
  return options.originalText.slice(node.startIndex, node.endIndex).trim();
}

function printSystemFunction(path, node, parts, options) {
  if (node.children.length === 0) return rawNodeText(node, options);

  const prefix = options.originalText.slice(
    node.startIndex,
    node.children[0].startIndex,
  );
  const output = [];
  const compact = inSpaceSensitiveContext(path);
  node.children.forEach((child, index) => {
    if (child.type === ",") {
      output.push(",");
      if (node.children[index + 1]?.type !== "," && !compact) output.push(line);
    } else {
      output.push(parts[index]);
    }
  });
  // When the commas belong to a child (e.g. `method_args`), the child indents.
  const hasOwnCommas = node.children.some((child) => child.type === ",");
  return group(
    concat([prefix, hasOwnCommas ? indent(concat(output)) : concat(output)]),
  );
}

// The content of XData, Storage, Query and non-ObjectScript methods (e.g.
// Python) is a payload whose whitespace can be significant (YAML, Python
// indentation): it is copied line by line without re-indenting it.
function printVerbatimBody(openBrace, closeBrace, options) {
  const raw = options.originalText.slice(
    openBrace.endIndex,
    closeBrace.startIndex,
  );
  const lines = raw.split("\n");
  if (lines.length === 1) return concat(["{", raw, "}"]);

  const firstLine = lines.shift();
  const lastLine = lines.pop();
  return concat([
    "{",
    firstLine.trim() ? firstLine : "",
    ...lines.map((lineText) => concat([literalline, lineText])),
    lastLine.trim()
      ? concat([literalline, lastLine, "}"])
      : concat([hardline, "}"]),
  ]);
}

// Separator between a declaration header and its opening brace: a space or,
// with `objectScriptBraceStyle: "next-line"`, a line break.
function braceSeparator(options) {
  return options.objectScriptBraceStyle === "next-line" ? hardline : " ";
}

// `a + b * c` is parsed as `a + (b * c)` nested to the right: the head of the
// chain is the outermost expression.
function chainHead(node) {
  let head = node;
  while (
    head.parent?.type === "expression" &&
    head.previousSibling?.type === "binary_operator"
  ) {
    head = head.parent;
  }
  return head;
}

// A line break inside parentheses (function arguments, parenthesized
// expressions) is plain whitespace for ObjectScript.
function isInsideParentheses(head) {
  const parent = head.parent;
  return (
    parent?.type === "method_arg" ||
    parent?.type === "dollar_arg_pair" ||
    (parent?.type === "expression" && head.previousSibling?.type === "(")
  );
}

// Binary operators are surrounded by spaces, except the concatenation (`_`)
// and the bare `'`, which stay attached to their operands.
function isSpacedOperator(node) {
  if (node.type !== "binary_operator") return false;
  const op = node.text;
  return op !== "_" && op !== "'" && op !== ".";
}

// Header of a class member (`Query Name(args) As Type [ Kw ]`) or method,
// up to (excluding) the child at `endIndex`.
function printMemberHeader(node, parts, endIndex) {
  const output = [];
  for (let i = 0; i < endIndex; i++) {
    if (i > 0 && node.children[i].type !== "arguments") output.push(" ");
    output.push(parts[i]);
  }
  return group(concat(output));
}

// `[Kw1, Kw2]`: the keywords of a member in square brackets. Each keyword is
// copied as written.
function printKeywordList(node, parts) {
  const content = [];
  node.children.forEach((child, index) => {
    if (!["[", "]", ","].includes(child.type)) content.push(parts[index]);
  });
  return concat(["[", join(", ", content), "]"]);
}

// Method with a body between braces. Shared by `method_definition` and by
// `clientmethod`, whose header is flattened in the node itself.
function printMethodLike(node, parts, options) {
  const openBraceIdx = node.children.findIndex((c) => c.type === "{");
  const closeBraceIdx = node.children.findLastIndex((c) => c.type === "}");

  // Rare: a method without a body (e.g. abstract or odd legacy declarations).
  if (openBraceIdx === -1 || closeBraceIdx === -1) {
    return printMemberHeader(node, parts, node.children.length);
  }

  const head = printMemberHeader(node, parts, openBraceIdx);
  // All the nodes between the braces (comments, body_content, ...), printed
  // in their original order, keeping blank lines.
  const childrenInside = node.children.slice(openBraceIdx + 1, closeBraceIdx);
  const partsInside = parts.slice(openBraceIdx + 1, closeBraceIdx);

  if (childrenInside.some((child) => child.type.endsWith("_body_content"))) {
    return concat([
      head,
      braceSeparator(options),
      printVerbatimBody(
        node.children[openBraceIdx],
        node.children[closeBraceIdx],
        options,
      ),
    ]);
  }

  if (childrenInside.length === 0) {
    return concat([head, braceSeparator(options), "{", hardline, "}"]);
  }

  const bodyDoc = printStatementsWithGaps(
    childrenInside,
    partsInside,
    options.originalText,
  );
  return group(
    concat([
      head,
      braceSeparator(options),
      "{",
      indent(concat([hardline, bodyDoc])),
      hardline,
      "}",
    ]),
  );
}

// Lines after the first keep their indentation relative to the line where
// the comment starts, so the internal alignment survives.
function printBlockComment(node, options) {
  const rawText = options.originalText.slice(node.startIndex, node.endIndex);
  const lines = rawText.split("\n");
  if (lines.length === 1) return rawText;

  const lineStart =
    options.originalText.lastIndexOf("\n", node.startIndex - 1) + 1;
  const baseIndent = indentWidth(
    options.originalText.slice(lineStart, node.startIndex),
    options.tabWidth,
  );
  const [firstLine, ...rest] = lines;
  return join(hardline, [
    firstLine.trimEnd(),
    ...rest.map((lineText) => {
      const leading = lineText.match(/^[\t ]*/)[0];
      const extra = indentWidth(leading, options.tabWidth) - baseIndent;
      return (
        " ".repeat(Math.max(0, extra)) + lineText.slice(leading.length).trimEnd()
      );
    }),
  ]);
}

// Visual width of the leading indentation, with tabs expanded to tabWidth.
function indentWidth(text, tabWidth) {
  let width = 0;
  for (const char of text.match(/^[\t ]*/)[0]) {
    width = char === "\t" ? width + tabWidth - (width % tabWidth) : width + 1;
  }
  return width;
}

// Prints the children of a node and puts back the source text that the parser
// does not expose between them (`$$`, `|"ns"|`...): only the operands are
// reformatted.
function printChildrenWithGaps(node, parts, options) {
  const output = [];
  let last = node.startIndex;
  node.children.forEach((child, i) => {
    const gap = options.originalText.slice(last, child.startIndex).trim();
    if (gap) output.push(gap);
    output.push(parts[i]);
    last = child.endIndex;
  });
  const tail = options.originalText.slice(last, node.endIndex).trim();
  if (tail) output.push(tail);
  return concat(output);
}

function printNodeWithOmittedPrefix(node, parts, options) {
  if (node.children.length === 0) return rawNodeText(node, options);
  const prefix = options.originalText.slice(
    node.startIndex,
    node.children[0].startIndex,
  );
  return concat([prefix, concat(parts)]);
}

function printEmbeddedSql(node, options) {
  const raw = options.originalText.slice(node.startIndex, node.endIndex);
  if (!/\r|\n/.test(raw)) return raw.trim();

  const openParen = raw.indexOf("(");
  const closeParen = raw.lastIndexOf(")");
  if (openParen === -1 || closeParen <= openParen) return raw.trim();

  const lines = raw
    .slice(openParen + 1, closeParen)
    .replace(/\r\n?/g, "\n")
    .split("\n");
  while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  while (lines.length > 0 && lines.at(-1).trim() === "") lines.pop();
  if (lines.length === 0) return `${raw.slice(0, openParen + 1).trim()})`;

  const nonEmptyLines = lines.filter((lineText) => lineText.trim() !== "");
  const commonIndent = Math.min(
    ...nonEmptyLines.map(
      (lineText) => lineText.match(/^[\t ]*/)?.[0].length || 0,
    ),
  );
  const bodyLines = lines.map((lineText) =>
    lineText.slice(commonIndent).trimEnd(),
  );

  return concat([
    raw.slice(0, openParen + 1).trim(),
    indent(concat([hardline, join(hardline, bodyLines)])),
    hardline,
    raw.slice(closeParen).trim(),
  ]);
}

function formatKeyword(keywordRaw, options, hasArguments = false) {
  const lower = keywordRaw.toLowerCase();
  const expansion =
    lower === "h" ? (hasArguments ? "hang" : "halt") : COMMAND_ABBREVIATIONS[lower];
  const keyword =
    options.objectScriptExpandCommands && expansion ? expansion : lower;

  switch (options.objectScriptCommandCase) {
    case "lowercase":
      return keyword;
    case "uppercase":
      return keyword.toUpperCase();
    case "title":
    default:
      // An unexpanded abbreviation stays uppercase (`ZW`, not `Zw`).
      if (expansion && keyword === lower) return keyword.toUpperCase();
      return (
        COMMAND_MAP[keyword] ||
        keyword.charAt(0).toUpperCase() + keyword.slice(1)
      );
  }
}

function printStatementsWithGaps(nodes, parts, originalText) {
  const validItems = [];
  nodes.forEach((child, index) => {
    if (child.type === "ERROR") {
      const rawErrorText = originalText.slice(child.startIndex, child.endIndex);
      if (rawErrorText.trim()) {
        validItems.push({ node: child, part: rawErrorText });
      }
      return;
    }
    const part = parts[index];
    if (
      part === undefined ||
      part === null ||
      (typeof part === "string" && part.trim() === "")
    )
      return;
    validItems.push({ node: child, part: part });
  });

  if (validItems.length === 0) return "";

  const result = [];
  for (let i = 0; i < validItems.length; i++) {
    const current = validItems[i];
    // The dotted lines of a statement align to its column. Only for
    // statements: elsewhere the root would shift verbatim payloads.
    result.push(
      current.node.type === "statement"
        ? markAsRoot(current.part)
        : current.part,
    );

    if (i < validItems.length - 1) {
      const next = validItems[i + 1];
      const endRow = current.node.endPosition.row;
      const startRow = next.node.startPosition.row;
      const diff = startRow - endRow;

      if (
        ["else_block", "elseif_block"].includes(next.node.type) &&
        !current.node.type.includes("comment")
      ) {
        result.push(" ");
        continue;
      }

      const nextText = originalText
        .slice(next.node.startIndex, next.node.endIndex)
        .trim();

      if (diff === 0) {
        if (endsWithArgumentlessCommand(current.node)) {
          result.push("  ");
          continue;
        }

        // A comment on the same line is always preceded by a single space
        // (line_comment, block_comment, line_comment_3 (;), ...).
        const isNextComment = next.node.type.toLowerCase().includes("comment");

        if (isNextComment) {
          result.push(" ");
          continue;
        }

        const isNextDot =
          nextText.startsWith(".") ||
          (next.node.type === "binary_operator" && nextText === ".");

        // ";" is not in this list, otherwise it would stick to the previous token.
        const noSpaceBefore = [".", ",", ")", "]"];
        const noSpaceAfter = ["(", "[", "."];

        const currLastChar = originalText.slice(
          current.node.endIndex - 1,
          current.node.endIndex,
        );
        const nextFirstChar = nextText.charAt(0);

        const gapText = originalText.slice(
          current.node.endIndex,
          next.node.startIndex,
        );
        const isErrorTouching =
          (current.node.type === "ERROR" || next.node.type === "ERROR") &&
          gapText.length === 0;

        if (
          isErrorTouching ||
          isNextDot ||
          noSpaceBefore.includes(nextFirstChar) ||
          noSpaceAfter.includes(currLastChar)
        ) {
          result.push("");
        } else {
          if (gapText.includes("\n") || /[\r\n]/.test(gapText)) {
            result.push(hardline);
          } else {
            result.push(" ");
          }
        }
      } else if (diff === 1) {
        result.push(hardline);
      } else {
        result.push(concat([hardline, hardline]));
      }
    }
  }
  return concat(result);
}

function printBlock(nodes, parts, originalText) {
  if (!nodes || nodes.length === 0) return "";
  return indent(
    concat([hardline, printStatementsWithGaps(nodes, parts, originalText)]),
  );
}

function printGenericCommand(keywordRaw, path, parts, node, options) {
  const postCondIdx = node.children.findIndex(
    (c) => c.type === "post_conditional",
  );
  let postCondDoc = "";
  if (postCondIdx !== -1) postCondDoc = parts[postCondIdx];

  const argsDoc = printCommandArgs(path, parts, node);
  const keyword = formatKeyword(keywordRaw, options, argsDoc !== "");

  // --- Trailing comment recovery ---
  let trailingDoc = "";
  if (node.children.length > 0) {
    const lastChild = node.children[node.children.length - 1];

    // Text after the last child (e.g. a comment) is not exposed as a node.
    if (lastChild.endIndex < node.endIndex) {
      const gap = options.originalText.slice(lastChild.endIndex, node.endIndex);
      // Keep the original gap, not its trimmed version, to preserve the
      // alignment of the comment; whitespace-only gaps are dropped.
      if (gap.trim().length > 0) {
        trailingDoc = gap;
      }
    }
  }
  // -----------------------------------

  // One space before the arguments; the trailing comment keeps its
  // original spacing.
  if (argsDoc) {
    // `Do  Write x`: an argumentless Do needs two spaces before the command.
    const separator = node.children.some(
      (child) => child.type === "do_statement_after",
    )
      ? "  "
      : " ";
    return group(
      concat([keyword, postCondDoc, separator, argsDoc, trailingDoc]),
    );
  }

  return group(concat([keyword, postCondDoc, trailingDoc]));
}

// =================================================================
// MAIN PRINTER FUNCTION
// =================================================================

function printObjectScript(path, options, print) {
  const node = path.getValue();
  traceNode(node, options);

  if (ATOMIC_TYPES.has(node.type)) {
    return options.originalText.slice(node.startIndex, node.endIndex).trimEnd();
  }

  if (Array.isArray(node)) return concat(path.map(print));

  let parts = [];
  if (node.children && node.children.length > 0) {
    parts = path.map(print, "children");
  }

  switch (node.type) {
    case "source_file":
      return concat([
        printStatementsWithGaps(node.children, parts, options.originalText),
        hardline,
      ]);

    case "macro":
      return concat(parts);

    // A label must start in column 1: when indented it becomes a command.
    case "tag_statement":
      return concat([trim, rawNodeText(node, options)]);

    case "class_statement":
      return concat(parts);

    case "core_method_body_content":
    case "statements":
    case "dotted_statement": {
      if (node.children.some((c) => c.type === "ERROR")) {
        return rawNodeText(node, options);
      }
      const dots = node.children.filter((c) => c.type === ".");
      const bodyNodes = node.children.filter((c) => c.type !== ".");
      const bodyParts = parts.filter((_, i) => node.children[i].type !== ".");
      const bodyDoc = printStatementsWithGaps(
        bodyNodes,
        bodyParts,
        options.originalText,
      );
      return concat([
        join(" ", dots.map(() => ".")),
        bodyNodes.length > 0 ? " " : "",
        bodyDoc,
      ]);
    }

    case "statement":
      if (node.children?.some((c) => c.type === "ERROR")) {
        return options.originalText
          .slice(node.startIndex, node.endIndex)
          .trim();
      }
      return printStatementsWithGaps(
        node.children,
        parts,
        options.originalText,
      );

    case "json_object_literal": {
      const properties = [];
      const legacyParts = [];
      node.children.forEach((child, i) => {
        if (["{", "}", ",", ":"].includes(child.type) || !parts[i]) return;
        if (
          child.type === "json_object_literal_pair" ||
          child.type.includes("comment")
        ) {
          properties.push(parts[i]);
        } else {
          legacyParts.push(parts[i]);
        }
      });
      for (let i = 0; i < legacyParts.length; i += 2) {
        if (legacyParts[i + 1]) {
          properties.push(concat([legacyParts[i], ": ", legacyParts[i + 1]]));
        }
      }
      if (properties.length === 0) return "{}";
      return group(
        concat([
          "{",
          indent(concat([softline, join(concat([",", line]), properties)])),
          softline,
          "}",
        ]),
      );
    }
    case "json_object_literal_pair": {
      const colonIndex = node.children.findIndex((child) => child.type === ":");
      if (colonIndex <= 0 || colonIndex >= parts.length - 1) {
        return rawNodeText(node, options);
      }
      return concat([
        concat(parts.slice(0, colonIndex)),
        ": ",
        concat(parts.slice(colonIndex + 1)),
      ]);
    }
    case "json_array_literal": {
      const elements = [];
      node.children.forEach((child, i) => {
        // Skip the brackets and commas of the original AST;
        if (child.type !== "[" && child.type !== "]" && child.type !== ",") {
          // only the values are kept.
          if (parts[i]) {
            elements.push(parts[i]);
          }
        }
      });

      if (elements.length === 0) return "[]";

      return group(
        concat([
          "[",
          indent(concat([softline, join(concat([",", line]), elements)])),
          softline,
          "]",
        ]),
      );
    }

    case "set_target_list":
    case "kill_target_list": {
      const elements = [];
      node.children.forEach((child, i) => {
        // Drop parentheses and commas and rebuild them with Prettier.
        if (child.type !== "(" && child.type !== ")" && child.type !== ",") {
          if (parts[i]) elements.push(parts[i]);
        }
      });
      return group(
        concat([
          "(",
          indent(concat([softline, join(concat([",", line]), elements)])),
          softline,
          ")",
        ]),
      );
    }

    // --- COMMANDS ---
    case "command_set":
    case "command_write":
    case "command_read":
    case "command_kill":
    case "command_new":
    case "command_do":
    case "command_quit":
    case "command_return":
    case "command_hang":
    case "command_halt":
    case "command_job":
    case "command_lock":
    case "command_open":
    case "command_close":
    case "command_use":
    case "command_break":
    case "command_continue":
    case "command_throw":
    case "command_tstart":
    case "command_tcommit":
    case "command_trollback":
    case "command_zwrite":
    case "command_zkill":
    case "command_view":
    case "command_xecute":
    case "command_zn":
    case "command_merge":
    case "command_goto":
    case "command_halt_or_hang":
      return printGenericCommand(
        options.originalText.slice(
          node.children[0].startIndex,
          node.children[0].endIndex,
        ),
        path,
        parts,
        node,
        options,
      );

    case "set_argument":
    case "merge_argument": {
      const eqIdx = node.children.findIndex((c) => c.type === "=");
      if (eqIdx !== -1) {
        const lhs = join(" ", parts.slice(0, eqIdx));
        const rhs = join(" ", parts.slice(eqIdx + 1));

        let spacer = "";
        // Recover text skipped by the parser between '=' and the value (e.g. "..").
        if (eqIdx + 1 < node.children.length) {
          const eqNode = node.children[eqIdx];
          const valNode = node.children[eqIdx + 1];
          const gap = options.originalText.slice(
            eqNode.endIndex,
            valNode.startIndex,
          );
          if (gap.trim()) {
            spacer = gap.trim();
          }
        }

        return concat([lhs, " = ", spacer, rhs]);
      }
      return join(" ", parts);
    }
    case "post_conditional":
      return concat(parts);

    case "command_if": {
      const keyword = formatKeyword("if", options);
      const openBraceIndex = node.children.findIndex((c) => c.type === "{");

      // Legacy If without braces.
      if (openBraceIndex === -1) {
        return printGenericCommand(
          options.originalText.slice(
            node.children[0].startIndex,
            node.children[0].endIndex,
          ),
          path,
          parts,
          node,
          options,
        );
      }

      // Condition and main body.
      const conditionsParts = parts.slice(1, openBraceIndex);
      const conditionsNodes = node.children.slice(1, openBraceIndex);
      const conditionDoc = printConditionList(conditionsParts, conditionsNodes);

      const closeBraceIndex = node.children.findIndex((c) => c.type === "}");
      const bodyNodes = node.children.slice(
        openBraceIndex + 1,
        closeBraceIndex,
      );
      const bodyParts = parts.slice(openBraceIndex + 1, closeBraceIndex);
      const bodyDoc = printBlock(bodyNodes, bodyParts, options.originalText);

      const ifBlock = group(
        concat([keyword, " ", conditionDoc, " {", bodyDoc, hardline, "}"]),
      );

      // Following Else/ElseIf blocks.
      const tailNodes = node.children.slice(closeBraceIndex + 1);
      if (tailNodes.length > 0) {
        const tailParts = parts.slice(closeBraceIndex + 1);

        // Gap between the } and the next item (e.g. ElseIf or a comment).
        const gapStart = node.children[closeBraceIndex].endIndex;
        const gapEnd = tailNodes[0].startIndex;
        const gapText = options.originalText.slice(gapStart, gapEnd);

        // `} Else {` even when the Else was on its own line in the source; a
        // comment on its own line stays where it was.
        let separator = " ";
        if (gapText.trim()) {
          separator = concat([" ", gapText.trim(), hardline]);
        } else if (
          gapText.includes("\n") &&
          !["else_block", "elseif_block"].includes(tailNodes[0].type)
        ) {
          separator = hardline;
        }

        return group(
          concat([
            ifBlock,
            separator,
            // Print the rest of the ElseIf chain keeping the comments
            // between one block and the next.
            printStatementsWithGaps(tailNodes, tailParts, options.originalText),
          ]),
        );
      }

      return ifBlock;
    }

    case "else_block":
    case "elseif_block": {
      const isElseIf = node.type === "elseif_block";
      const keyword = formatKeyword(isElseIf ? "elseif" : "else", options);
      const openBraceIndex = node.children.findIndex((c) => c.type === "{");
      const closeBraceIndex = node.children.findIndex((c) => c.type === "}");
      if (openBraceIndex === -1) return join(" ", parts);

      const bodyNodes = node.children.slice(
        openBraceIndex + 1,
        closeBraceIndex,
      );
      const bodyParts = parts.slice(openBraceIndex + 1, closeBraceIndex);
      const bodyDoc = printBlock(bodyNodes, bodyParts, options.originalText);

      let conditionDoc = "";
      if (isElseIf) {
        const condParts = parts.slice(1, openBraceIndex);
        const condNodes = node.children.slice(1, openBraceIndex);
        conditionDoc = concat([" ", printConditionList(condParts, condNodes)]);
      }
      return group(
        concat([keyword, conditionDoc, " {", bodyDoc, hardline, "}"]),
      );
    }

    case "command_for": {
      const keyword = formatKeyword("for", options);
      const openBraceIdx = node.children.findIndex((c) => c.type === "{");
      if (openBraceIdx !== -1) {
        const closeBraceIdx = node.children.findIndex((c) => c.type === "}");
        const paramIndices = [];
        for (let i = 1; i < openBraceIdx; i++) {
          if (node.children[i].type === "for_parameter") paramIndices.push(i);
        }
        let paramsDoc =
          paramIndices.length > 0
            ? concat([
                " ",
                join(
                  ", ",
                  paramIndices.map((i) => parts[i]),
                ),
              ])
            : "";

        const bodyNodes = node.children.slice(openBraceIdx + 1, closeBraceIdx);
        const bodyParts = parts.slice(openBraceIdx + 1, closeBraceIdx);
        const bodyDoc = printBlock(bodyNodes, bodyParts, options.originalText);
        return group(
          concat([keyword, paramsDoc, " {", bodyDoc, hardline, "}"]),
        );
      }
      return printGenericCommand(
        options.originalText.slice(
          node.children[0].startIndex,
          node.children[0].endIndex,
        ),
        path,
        parts,
        node,
        options,
      );
    }

    case "command_while": {
      const keyword = formatKeyword("while", options);
      const openBraceIdx = node.children.findIndex((c) => c.type === "{");

      if (openBraceIdx !== -1) {
        const closeBraceIdx = node.children.findIndex((c) => c.type === "}");

        // The condition is everything between the While keyword and the {.
        const conditionParts = parts.slice(1, openBraceIdx);
        const conditionDoc = join(" ", conditionParts);

        const bodyNodes = node.children.slice(openBraceIdx + 1, closeBraceIdx);
        const bodyParts = parts.slice(openBraceIdx + 1, closeBraceIdx);
        const bodyDoc = printBlock(bodyNodes, bodyParts, options.originalText);

        return group(
          concat([keyword, " ", conditionDoc, " {", bodyDoc, hardline, "}"]),
        );
      }

      // Legacy While without braces.
      return printGenericCommand(
        options.originalText.slice(
          node.children[0].startIndex,
          node.children[0].endIndex,
        ),
        path,
        parts,
        node,
        options,
      );
    }

    case "command_dowhile": {
      const keywordDo = formatKeyword("do", options);
      const keywordWhile = formatKeyword("while", options);

      const openBraceIdx = node.children.findIndex((c) => c.type === "{");
      const closeBraceIdx = node.children.findIndex((c) => c.type === "}");
      // Index of the `while` keyword (keyword_while, or plain `while` text).
      const whileNodeIdx = node.children.findIndex(
        (c) => c.type === "keyword_while" || c.type === "while",
      );

      // Body of Do { ... }.
      const bodyNodes = node.children.slice(openBraceIdx + 1, closeBraceIdx);
      const bodyParts = parts.slice(openBraceIdx + 1, closeBraceIdx);
      const bodyDoc = printBlock(bodyNodes, bodyParts, options.originalText);

      // Condition after While.
      let conditionDoc = "";
      if (whileNodeIdx !== -1 && parts[whileNodeIdx + 1]) {
        conditionDoc = parts[whileNodeIdx + 1];
      }

      return group(
        concat([
          keywordDo,
          " {",
          bodyDoc,
          hardline,
          "} ",
          keywordWhile,
          " ",
          conditionDoc,
        ]),
      );
    }

    case "for_parameter":
      return concat(
        parts.map((part, i) => {
          if (i === 0) return part;
          if (node.children[i].type === ",") return ",";
          return concat([" ", part]);
        }),
      );
    case "for_parameter_arg":
      return concat(parts);

    case "pound_dim": {
      const output = [];
      node.children.forEach((child, i) => {
        const part = parts[i];
        if (i === 0) {
          output.push(part);
          return;
        }
        const prev = node.children[i - 1];

        // Space after #dim.
        if (prev.type === "keyword_dim" || prev.type === "#dim") {
          output.push(" ");
        }
        // Insert " As " between the variable and the type.
        else {
          // What counts as a variable.
          const isPrevVar = [
            "lvn",
            "identifier",
            "local_variable",
            "glvn",
            "objectscript_identifier",
          ].includes(prev.type);

          // What counts as a type (classes, %String, ...).
          // `oref_set_target` covers names like %Exception.SystemException.
          const isCurrType = [
            "typename",
            "class_name",
            "oref_set_target",
            "package_name",
            "identifier",
          ].includes(child.type);

          // A variable directly followed by a type has no "As" node between
          // them among the direct children, so " As " is inserted.
          if (isPrevVar && isCurrType) {
            output.push(" As ");
          }
          // Otherwise, standard spacing.
          else if (child.type === "keyword_as" || prev.type === "keyword_as") {
            output.push(" ");
          }
          // Space unless it is punctuation.
          else if (
            child.type !== "." &&
            prev.type !== "." &&
            child.type !== "," &&
            child.type !== ")"
          ) {
            output.push(" ");
          }
        }
        output.push(part);
      });
      return group(concat(output));
    }

    case "pound_define":
      return group(concat(["#Define ", join(" ", parts.slice(1))]));
    case "pound_def1arg":
      return group(concat(["#Def1Arg ", join(" ", parts.slice(1))]));
    case "pound_include":
      return group(concat(["#Include ", join(" ", parts.slice(1))]));
    case "pound_import":
      return group(concat(["#Import ", join(" ", parts.slice(1))]));
    case "pound_if":
      return group(concat(["#If ", join(" ", parts.slice(1))]));
    case "pound_ifdef":
      return group(concat(["#IfDef ", join(" ", parts.slice(1))]));
    case "pound_ifndef":
      return group(concat(["#IfNDef ", join(" ", parts.slice(1))]));
    case "pound_else":
      return "#Else";
    case "pound_endif":
      return "#EndIf";

    // --- CLASSES ---
    case "class_definition": {
      const headerParts = [];
      let bodyDoc = "";
      node.children.forEach((child, index) => {
        if (child.type === "class_body") bodyDoc = parts[index];
        else headerParts.push(parts[index]);
      });
      return group(
        concat([join(" ", headerParts), braceSeparator(options), bodyDoc || ""]),
      );
    }
    case "class_extends": {
      const exArgs = [];
      node.children.forEach((child, index) => {
        if (!["(", ")", ",", "keyword_extends"].includes(child.type))
          exArgs.push(parts[index]);
      });
      if (!node.children.some((c) => c.type === "(")) return join(" ", parts);
      return group(
        concat([
          "Extends (",
          indent(concat([softline, join(concat([",", line]), exArgs)])),
          softline,
          ")",
        ]),
      );
    }
    case "class_body": {
      const memberNodes = node.children.filter(
        (child) => child.type !== "{" && child.type !== "}",
      );
      const memberParts = parts.filter(
        (part, index) =>
          node.children[index].type !== "{" &&
          node.children[index].type !== "}",
      );
      if (memberNodes.length === 0) return concat(["{", hardline, "}"]);
      return concat([
        "{",
        indent(
          concat([
            hardline,
            printStatementsWithGaps(
              memberNodes,
              memberParts,
              options.originalText,
            ),
          ]),
        ),
        hardline,
        "}",
      ]);
    }

    case "storage":
    case "xdata":
    case "query":
    case "trigger": {
      const openBraceIdx = node.children.findIndex((c) => c.type === "{");
      const closeBraceIdx = node.children.findLastIndex((c) => c.type === "}");
      if (openBraceIdx === -1 || closeBraceIdx <= openBraceIdx) {
        return rawNodeText(node, options);
      }
      const header = printMemberHeader(node, parts, openBraceIdx);
      const bodyNodes = node.children.slice(openBraceIdx + 1, closeBraceIdx);
      // Only triggers with Language = objectscript contain statements.
      const isOpaque =
        node.type !== "trigger" ||
        bodyNodes.some((child) => child.type.endsWith("_body_content"));
      if (isOpaque) {
        return concat([
          header,
          braceSeparator(options),
          printVerbatimBody(
            node.children[openBraceIdx],
            node.children[closeBraceIdx],
            options,
          ),
        ]);
      }
      const bodyParts = parts.slice(openBraceIdx + 1, closeBraceIdx);
      return concat([
        header,
        braceSeparator(options),
        "{",
        printBlock(bodyNodes, bodyParts, options.originalText),
        hardline,
        "}",
      ]);
    }
    case "_storage_body":
    case "xdata_body_content_xml":
      return options.originalText.slice(node.startIndex, node.endIndex).trim();

    // KEYWORD WRAPPERS
    case "method":
    case "classmethod":
      return join(" ", parts);

    // --- PARAMETER / PROPERTY ---
    case "parameter":
    case "property":
    case "index": {
      const output = [];
      node.children.forEach((child, i) => {
        const part = parts[i];
        if (i > 0) {
          const prev = node.children[i - 1];
          // No space before ; , ) or the arguments of a property, nor
          // after an opening parenthesis (`Index I On (A, B)`).
          if (
            ![";", ",", ")", "arguments"].includes(child.type) &&
            prev.type !== "("
          ) {
            // Space between words, including after a keyword_
            // (e.g. "Parameter"), and around "=".
            output.push(" ");
          }
        }
        output.push(part);
      });
      return group(concat(output));
    }

    case "method_definition":
    case "clientmethod":
      return printMethodLike(node, parts, options);

    case "do_parameter":
      return concat(parts);

    case "command_trycatch": {
      const openBraceIdx = node.children.findIndex((c) => c.type === "{");
      const closeBraceIdx = node.children.findIndex((c) => c.type === "}");
      if (openBraceIdx !== -1 && closeBraceIdx !== -1) {
        const tryNodes = node.children.slice(openBraceIdx + 1, closeBraceIdx);
        const tryParts = parts.slice(openBraceIdx + 1, closeBraceIdx);
        const tryDoc = printBlock(tryNodes, tryParts, options.originalText);

        const catchParts = parts.slice(closeBraceIdx + 1);
        return group(
          concat([
            formatKeyword("try", options),
            " ",
            "{",
            tryDoc,
            hardline,
            "}",
            catchParts.length > 0 ? concat([" ", join(" ", catchParts)]) : "",
          ]),
        );
      }
      return join(" ", parts);
    }
    case "catch_block": {
      const openBraceIdx = node.children.findIndex((c) => c.type === "{");
      const closeBraceIdx = node.children.findIndex((c) => c.type === "}");
      if (openBraceIdx !== -1 && closeBraceIdx !== -1) {
        const header = parts.slice(0, openBraceIdx);
        if (node.children[0]?.type === "keyword_catch") {
          header[0] = formatKeyword("catch", options);
        }
        const bodyNodes = node.children.slice(openBraceIdx + 1, closeBraceIdx);
        const bodyParts = parts.slice(openBraceIdx + 1, closeBraceIdx);
        const bodyDoc = printBlock(bodyNodes, bodyParts, options.originalText);
        return group(
          concat([join(" ", header), " ", "{", bodyDoc, hardline, "}"]),
        );
      }
      return join(" ", parts);
    }

    case "expression": {
      const spaced = !inSpaceSensitiveContext(path);
      const head = chainHead(node);
      const breakable =
        spaced &&
        options.objectScriptBreakLongExpressions &&
        isInsideParentheses(head);
      const doc = concat(
        parts.map((part, i) =>
          spaced && isSpacedOperator(node.children[i])
            ? concat([" ", part, breakable ? line : " "])
            : part,
        ),
      );
      if (!breakable) return group(doc);
      // The operands to the right of an operator belong to the group of the
      // first expression of the chain, so they all break together.
      return node === head ? group(indent(doc)) : doc;
    }
    case "embedded_sql":
      return concat(parts);
    case "embedded_sql_amp":
    case "embedded_sql_hash":
      return printEmbeddedSql(node, options);
    case "system_defined_function":
      return printSystemFunction(path, node, parts, options);
    case "macro_function":
      return printNodeWithOmittedPrefix(node, parts, options);
    case "binary_operator": {
      const op = node.text;
      if (op === "." || op === "_" || op.startsWith("'")) return concat(parts);
      return join(" ", parts);
    }

    case "read_argument":
    case "write_argument":
    case "write_device_control":
    case "write_device_fflf":
    case "write_device_tab":
      return concat(parts);
    case "timeout":
      return concat(parts);

    // Lock arguments: recover the + and - signs, which the parser
    case "command_lock_argument":
    case "command_lock_arguments_variant_1": {
      const output = [];
      // may not expose as separate AST nodes.
      if (node.children.length > 0) {
        const firstChild = node.children[0];
        // Gap between the start of the node and its first child (e.g. glvn).
        const gap = options.originalText.slice(
          node.startIndex,
          firstChild.startIndex,
        );
        if (gap.includes("+")) output.push("+");
        else if (gap.includes("-")) output.push("-");
      }

      // The rest (glvn, timeout) without extra spaces.
      output.push(concat(parts));
      return concat(output);
    }

    case "expr_tail":
    case "expr_atom":
    case "class_method_call":
    case "instance_method_call":
    case "relative_dot_method":
    case "function_call":
    case "dollarsf":
    case "oref_method":
    case "oref_set_target":
    case "oref_chain_expr":
    case "oref_chain_segment":
    case "oref_property":
    case "oref_parameter":
    case "relative_dot_parameter":
    case "member_access":
    case "class_ref":
      return concat(parts);
    case "routine_ref":
    case "line_ref":
    case "routine_tag_call":
      return concat(parts);

    case "byref_arg":
      return concat(parts);
    // The arguments of a macro are substituted as text: they are kept as written.
    case "macro_func_args":
      return rawNodeText(node, options);

    case "method_args":
      return printMethodArgs(path, parts, node, options);
    case "arguments":
      return printArgumentsList(parts, node);
    case "argument":
      return join(" ", parts);
    case "argument_type":
      return join(" ", parts);
    case "argument_list":
      return concat(parts);
    case "default_argument_value": {
      const equalsIndex = node.children.findIndex(
        (child) => child.type === "=",
      );
      if (equalsIndex === -1 || equalsIndex === parts.length - 1) {
        return rawNodeText(node, options);
      }
      return concat(["= ", concat(parts.slice(equalsIndex + 1))]);
    }

    case "keyword_pound_pound_class":
      return "##class";

    // These nodes often omit the keyword from the grammar's children,
    // so the original text is safer than rebuilding it.
    case "class_keyword":
    case "method_keyword":
    case "property_keyword":
    case "parameter_keyword":
    case "index_keyword":
    case "rhs_sql_compute_code":
      return rawNodeText(node, options);

    case "variable_datatype":
      return concat(parts);

    // Punctuation.
    case ".":
    case "..":
    case "=":
    case ",":
    case "(":
    case ")":
    case ":":
      // Zero-length nodes are inserted by error recovery: skip them.
      if (node.endIndex - node.startIndex === 0) {
        return "";
      }
      // The node type is the character itself (e.g. "=").
      return node.type;

    case "method_keywords":
    case "external_method_keywords":
    case "expression_method_keywords":
    case "call_method_keywords":
    case "xdata_keywords":
    case "query_keywords":
    case "trigger_keywords":
    case "external_trigger_keywords":
      return printKeywordList(node, parts);

    case "class_keywords":
    case "property_keywords":
    case "parameter_keywords": {
      const content = [];
      node.children.forEach((child, index) => {
        if (!["[", "]", ","].includes(child.type)) content.push(parts[index]);
      });
      if (content.length === 0) return "[]";
      return group(
        concat([
          "[",
          indent(concat([softline, join(concat([",", line]), content)])),
          softline,
          "]",
        ]),
      );
    }
    case "extent_index_keywords":
    case "index_keywords": {
      const content = [];
      node.children.forEach((child, index) => {
        // Drop the original parentheses and commas.
        if (!["[", "]", ","].includes(child.type)) {
          // Skip empty parts.
          if (parts[index]) content.push(parts[index]);
        }
      });

      if (content.length === 0) return "[]";

      return group(
        concat([
          "[",
          indent(concat([softline, join(concat([",", line]), content)])),
          softline,
          "]",
        ]),
      );
    }

    case "property_type":
    case "return_type":
      return printSmartType(parts, node.children);

    case "identifier":
    case "simple_identifier":
    case "string_literal":
      return options.originalText.slice(node.startIndex, node.endIndex);
    case "block_comment":
      return printBlockComment(node, options);
    case "lvn":
    case "gvn":
    case "extrinsic_function":
    case "unary_expression":
      if (node.children.length === 0) return rawNodeText(node, options);
      return printChildrenWithGaps(node, parts, options);
    case "dollar_arg_pair":
      return concat(parts);
    case "numeric_literal":
    case "macro_constant":
    case "variable":
    case "global_variable":
    case "glvn":
      return options.originalText.slice(node.startIndex, node.endIndex);
    case "rhs":
      return options.originalText.slice(node.startIndex, node.endIndex);
    case "%":
    case "typename":
      return options.originalText.slice(node.startIndex, node.endIndex).trim();

    case "ERROR":
      // Print the ERROR content as is.
      const errText = options.originalText.slice(
        node.startIndex,
        node.endIndex,
      );
      if (errText.includes("\n")) {
        // A multiline error likely contains hardcoded indentation;
        // there is not much to do but print it.
        return errText;
      }
      return errText.trim();

    default:
      traceNode(node, options, "fallback");
      // A single child is enough only if it spans the whole node: `instance_variable`
      // exposes `Prop` as a child but not the `i%` prefix.
      if (
        parts.length === 1 &&
        rawNodeText(node.children[0], options) === rawNodeText(node, options)
      ) {
        return parts[0];
      }
      // A fallback that inserts spaces can change the semantics (`obj.Method`
      // used to become `obj. Method`). Unknown composite nodes keep their
      // source until an explicit, tested handler exists.
      return rawNodeText(node, options);
  }
}

module.exports = { printObjectScript };
