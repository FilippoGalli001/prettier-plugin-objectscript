/**
 * @file utils.js
 * @description Reusable helpers for the printer: argument lists, types
 *              and conditions.
 */

const {
  doc: {
    builders: {
      concat,
      dedentToRoot,
      fill,
      hardline,
      indent,
      join,
      group,
      line,
      softline,
    },
  },
} = require("prettier");

// Contexts where a space ends the argument. A postconditional (`Do:a=1 Foo`)
// cannot contain spaces or line breaks unless it is entirely parenthesized
// (`Do:(a = 1) Foo`), and the operands of a `For` range or a timeout are kept
// compact for the same reason.
const SPACE_SENSITIVE_TYPES = new Set(["for_parameter", "timeout"]);

const SUBSCRIPT_OWNERS = new Set(["lvn", "gvn"]);

function isFullyParenthesized(postConditional) {
  const expression = postConditional.children.find(
    (child) => child.type === "expression",
  );
  const children = expression?.children ?? [];
  return (
    children.length === 3 &&
    children[0].type === "(" &&
    children[2].type === ")"
  );
}

/**
 * Tells whether the node being printed is inside a postconditional, a `For`
 * range or a timeout, where no whitespace may be added.
 * @param {object} path - The AST path.
 * @returns {boolean}
 */
function inSpaceSensitiveContext(path) {
  for (let level = 0, ancestor; (ancestor = path.getParentNode(level)); level++) {
    if (SPACE_SENSITIVE_TYPES.has(ancestor.type)) return true;
    if (ancestor.type === "post_conditional" && !isFullyParenthesized(ancestor)) {
      return true;
    }
  }
  return false;
}

/**
 * Tells whether the node ends with an argumentless command (e.g. `Quit`, `Do`).
 * Such a command needs two spaces before whatever follows it on the same
 * line, otherwise the rest is read as its argument.
 * @param {object} node - The AST node.
 * @returns {boolean}
 */
function endsWithArgumentlessCommand(node) {
  let current = node;
  while (current && current.type === "statement") {
    current = current.children[current.children.length - 1];
  }
  if (!current || !current.type.startsWith("command_")) return false;
  return current.children.every(
    (child) =>
      child.type.startsWith("keyword_") || child.type === "post_conditional",
  );
}

/**
 * Joins items with commas, allowing a line break after each comma.
 * @param {Array<object>} parts - Docs already printed for each node.
 * @param {Array<object>} nodes - The AST nodes matching `parts`.
 * @returns {object} A Prettier doc.
 */
function joinWithCommas(parts, nodes) {
  const result = [];
  parts.forEach((part, i) => {
    if (i === 0) {
      result.push(
        nodes[0].type === "dotted_statement"
          ? dedentToRoot(concat([hardline, part]))
          : part,
      );
      return;
    }

    const currType = nodes[i].type;
    const prevType = nodes[i - 1].type;

    // Commands nested in a legacy If/For/Do must stay on the same line:
    // a line break would move them out of the outer command's scope.
    if (currType === "statement") {
      result.push(endsWithArgumentlessCommand(nodes[i - 1]) ? "  " : " ");
      result.push(part);
      return;
    }
    // Every line of a dotted block (`. Write x`) is a separate source line.
    if (currType === "dotted_statement") {
      result.push(dedentToRoot(concat([hardline, part])));
      return;
    }

    if (currType === ",") {
      result.push(",");
      result.push(line);
    } else {
      if (prevType === ",") {
        // The comma already emitted the `line` separator.
        result.push(part);
      } else {
        // No comma before this argument (e.g. `Read x y`).
        result.push(line);
        result.push(part);
      }
    }
  });
  return concat(result);
}

/**
 * Prints a list of conditions (e.g. for If/ElseIf).
 * @param {Array<object>} parts - The docs.
 * @param {Array<object>} nodes - The AST nodes.
 * @returns {object} A Prettier doc.
 */
function printConditionList(parts, nodes) {
  const res = [];
  parts.forEach((part, i) => {
    if (i === 0) {
      res.push(part);
      return;
    }
    const currType = nodes[i].type;
    const prevType = nodes[i - 1].type;
    const currText = nodes[i].text || "";

    if (currType === ",") {
      res.push(",");
      res.push(line);
    } else if (prevType === "(" || currType === ")" || currText === ".") {
      // No space around parentheses or dots.
      res.push(part);
    } else {
      res.push(" ");
      res.push(part);
    }
  });
  return concat(res);
}

/**
 * Prints the arguments of an ObjectScript command (e.g. Set, Write, Kill),
 * leaving out the command keyword and the postconditional.
 * @param {object} path - The AST path to the command node.
 * @param {Array<object>} parts - The docs of the node's children.
 * @param {object} node - The command AST node.
 * @returns {object|string} A Prettier doc with the arguments, or an empty string.
 */
function printCommandArgs(path, parts, node) {
  const argsIndices = [];
  node.children.forEach((child, i) => {
    const isHead =
      child.type.startsWith("keyword_") ||
      child.type === "post_conditional" ||
      child.type.includes("whitespace");

    if (!isHead) {
      argsIndices.push(i);
    }
  });

  if (argsIndices.length === 0) return "";

  const argParts = argsIndices.map((i) => parts[i]);
  const argNodes = argsIndices.map((i) => node.children[i]);

  // Plain `a, b, c` list: fill the lines instead of one argument per line.
  const isCommaList =
    argNodes.length > 1 &&
    argNodes.every((argNode, i) => (argNode.type === ",") === (i % 2 === 1));
  if (isCommaList) {
    const items = [];
    for (let i = 0; i < argParts.length; i += 2) {
      if (items.length > 0) items.push(line);
      items.push(i + 1 < argParts.length ? concat([argParts[i], ","]) : argParts[i]);
    }
    return indent(fill(items));
  }
  return indent(joinWithCommas(argParts, argNodes));
}

/**
 * Prints a formal argument list in parentheses (e.g. in a method definition).
 * @param {Array<object>} parts - The docs.
 * @param {object} node - The `arguments` AST node.
 * @returns {object} A Prettier doc.
 */
function printArgumentsList(parts, node) {
  const args = [];
  node.children.forEach((child, index) => {
    if (!["(", ")", ","].includes(child.type)) {
      args.push(parts[index]);
    }
  });

  if (args.length === 0) return "()";

  return group(
    concat([
      "(",
      indent(concat([softline, join(concat([",", line]), args)])),
      softline,
      ")",
    ]),
  );
}

/**
 * Prints the arguments of a method call in parentheses.
 * Also restores dots that the parser skips when there is extra whitespace.
 * @param {object} path - The AST path.
 * @param {Array<object>} parts - The docs.
 * @param {object} node - The `method_args` AST node.
 * @param {object} options - Prettier options (for `originalText`).
 * @returns {object} A Prettier doc.
 */
function printMethodArgs(path, parts, node, options) {
  const elements = [];
  const compact = inSpaceSensitiveContext(path);
  let lastPos = node.startIndex;

  node.children.forEach((child, i) => {
    // A dot in the gap before this child was skipped by the parser.
    // If the child were the dot itself, the gap would end before it.
    if (options && options.originalText) {
      const gap = options.originalText.slice(lastPos, child.startIndex);
      if (gap.includes(".")) {
        elements.push(".");
      }
    }
    lastPos = child.endIndex;

    if (child.type === "(" || child.type === ")") return;

    if (child.type === ",") {
      elements.push(",");
      if (!compact) elements.push(line);
    } else {
      elements.push(parts[i]);
    }
  });

  if (elements.length === 0) return "()";
  // Subscripts (`^Data(a, b)`) are never broken across lines.
  if (compact || SUBSCRIPT_OWNERS.has(node.parent?.type)) {
    return concat([
      "(",
      concat(elements.map((element) => (element === line ? " " : element))),
      ")",
    ]);
  }

  return group(
    concat(["(", indent(concat([softline, concat(elements)])), softline, ")"]),
  );
}

/**
 * Prints a data type (e.g. `As %String`, `As MyApp.MyClass`) with the
 * right spacing around dots.
 * @param {Array<object>} parts - The docs.
 * @param {Array<object>} nodes - The AST nodes.
 * @returns {object} A Prettier doc.
 */
function printSmartType(parts, nodes) {
  const res = [];
  parts.forEach((part, i) => {
    if (i === 0) {
      res.push(part);
      return;
    }
    const prevType = nodes[i - 1].type;
    const currType = nodes[i].type;

    // No space around a dot or a binary operator (such as `..`).
    if (
      currType === "." ||
      prevType === "." ||
      currType === "binary_operator"
    ) {
      res.push(part);
    } else {
      res.push(" ");
      res.push(part);
    }
  });
  return concat(res);
}

module.exports = {
  inSpaceSensitiveContext,
  endsWithArgumentlessCommand,
  joinWithCommas,
  printCommandArgs,
  printArgumentsList,
  printMethodArgs,
  printSmartType,
  printConditionList,
};
