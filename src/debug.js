const debugStates = new WeakMap();

function isTruthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || ""));
}

function parseNodeTypes(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function parseRange(value) {
  const match = String(value || "").match(/^(\d+)\s*:\s*(\d+)$/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return start <= end ? { start, end } : { start: end, end: start };
}

function createDebugState(options) {
  const envDebug = process.env.OBJECTSCRIPT_DEBUG || "";
  const envDebugIsFlag = /^(|0|1|false|true|no|yes|off|on)$/i.test(envDebug);
  const nodeTypes = parseNodeTypes(
    options.objectScriptDebugNodes ||
      process.env.OBJECTSCRIPT_DEBUG_NODES ||
      (envDebugIsFlag ? "" : envDebug),
  );
  const requestedMax = Number(
    options.objectScriptDebugMax || process.env.OBJECTSCRIPT_DEBUG_MAX || 200,
  );

  return {
    enabled:
      options.objectScriptDebug === true ||
      isTruthy(envDebug) ||
      (!envDebugIsFlag && nodeTypes.size > 0),
    nodeTypes,
    range: parseRange(
      options.objectScriptDebugRange || process.env.OBJECTSCRIPT_DEBUG_RANGE,
    ),
    fileFilter: String(
      options.objectScriptDebugFile ||
        process.env.OBJECTSCRIPT_DEBUG_FILE ||
        "",
    ),
    max: Number.isFinite(requestedMax)
      ? Math.max(1, Math.trunc(requestedMax))
      : 200,
    count: 0,
    limitReported: false,
  };
}

function getDebugState(options) {
  let state = debugStates.get(options);
  if (!state) {
    state = createDebugState(options);
    debugStates.set(options, state);
  }
  return state;
}

function traceNode(node, options, phase = "visit") {
  const state = getDebugState(options);
  if (!state.enabled) return;
  if (state.nodeTypes.size > 0 && !state.nodeTypes.has(node.type)) return;
  if (
    state.range &&
    (node.endIndex < state.range.start || node.startIndex > state.range.end)
  ) {
    return;
  }

  const filePath = String(options.filepath || "<input>");
  if (state.fileFilter && !filePath.includes(state.fileFilter)) return;

  if (state.count >= state.max) {
    if (!state.limitReported) {
      process.stderr.write(
        `[objectscript-debug] limit reached (${state.max}); further nodes suppressed\n`,
      );
      state.limitReported = true;
    }
    return;
  }

  const originalText = options.originalText || "";
  const snippet = originalText
    .slice(node.startIndex, Math.min(node.endIndex, node.startIndex + 120))
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
  const record = {
    phase,
    file: filePath,
    type: node.type,
    parent: node.parent ? node.parent.type : null,
    start: node.startIndex,
    end: node.endIndex,
    startPosition: node.startPosition,
    endPosition: node.endPosition,
    missing: Boolean(node.isMissing),
    hasError: Boolean(node.hasError),
    snippet,
  };

  process.stderr.write(`[objectscript-debug] ${JSON.stringify(record)}\n`);
  state.count += 1;
}

module.exports = { traceNode };
