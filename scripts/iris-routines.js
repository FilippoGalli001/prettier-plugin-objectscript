#!/usr/bin/env node

/**
 * Checks the routine formatter against the routines that ship with
 * InterSystems IRIS.
 *
 * In a throwaway IRIS Community container, the `.int` and `.inc` routines of
 * the %SYS namespace that have source code are exported in UDL format and
 * formatted. For every file, formatting must be idempotent and add no parse
 * errors; for every routine it must also keep the number of lines and the
 * labels on the same lines, because `$TEXT(Label+n)` and error locations
 * depend on them. Each `.int` routine is then compiled in the USER namespace
 * under a temporary name, as written and formatted: both versions must give
 * the same compilation errors, at the same Label+offset. Include files are
 * not compiled on their own.
 *
 * Requires Docker. Usage: npm run test:iris:routines [-- --keep]
 *   IRIS_IMAGE   image to use (default intersystems/iris-community:latest-cd)
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const prettier = require("prettier");
const plugin = require("../index");
const { parserForFile, getParseDiagnostics } = require("../src/parser");

const IMAGE = process.env.IRIS_IMAGE || "intersystems/iris-community:latest-cd";
const KEEP = process.argv.includes("--keep");
const CONTAINER = `iris-routines-${process.pid}`;
// Docker on Windows (Git Bash) must not rewrite the container paths.
const DOCKER_ENV = { ...process.env, MSYS_NO_PATHCONV: "1" };

function docker(args, input) {
  return spawnSync("docker", args, {
    input,
    encoding: "utf8",
    maxBuffer: 1 << 28,
    env: DOCKER_ENV,
  });
}

function log(message) {
  process.stderr.write(`${message}\n`);
}

function iris(namespace, script) {
  const result = docker(
    ["exec", "-i", CONTAINER, "iris", "session", "iris", "-U", namespace],
    `${script}\nHalt\n`,
  );
  return result.stdout || "";
}

function waitForIris() {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (iris("USER", 'Write "ready",!').includes("ready")) return;
    spawnSync(process.execPath, ["-e", "setTimeout(() => {}, 3000)"]);
  }
  throw new Error("IRIS did not start within 3 minutes");
}

// Exports the routines of %SYS that have source code, in UDL format.
function exportRoutines(tmp) {
  iris(
    "%SYS",
    [
      `Set dir="/tmp/corpus/",sc=##class(%File).CreateDirectoryChain(dir)`,
      `Set rs=##class(%ResultSet).%New("%Routine:RoutineList")`,
      `Do rs.Execute("*.INT,*.INC",1,0)`,
      `While rs.Next() { Set name=rs.Get("Name"),sc=$SYSTEM.OBJ.ExportUDL(name,dir_name,"-d") }`,
    ].join("\n"),
  );
  const target = path.join(tmp, "corpus");
  const copy = docker(["cp", `${CONTAINER}:/tmp/corpus`, target]);
  if (copy.status !== 0) throw new Error(`docker cp failed: ${copy.stderr}`);
  return target;
}

function diagnostics(text, file) {
  return getParseDiagnostics(parserForFile(file).parser.parse(text)).length;
}

// The label at the start of a line, or "" for a line of code.
function labelOf(line) {
  return /^[%A-Za-z0-9]/.test(line) ? line.split(/[\s(;]/)[0] : "";
}

function isCommentLine(line) {
  return /^(;|\/\/|#;)/.test(line.trim());
}

// Where formatting moved a line, a label or a comment line, or "" if it did
// not. Blank lines at the end count too; only the final newline is ignored.
function lineChange(text, output) {
  const before = text.replace(/\n$/, "").split("\n");
  const after = output.replace(/\n$/, "").split("\n");
  if (before.length !== after.length) {
    return `${before.length} -> ${after.length} lines`;
  }
  const label = before.findIndex((l, i) => labelOf(l) !== labelOf(after[i]));
  if (label !== -1) return `label moved at line ${label + 1}`;
  // Comment lines (`;;` data read with $TEXT) must stay exactly as written.
  const comment = before.findIndex(
    (l, i) => isCommentLine(l) && l.trimEnd() !== after[i].trimEnd(),
  );
  return comment === -1 ? "" : `comment line changed at line ${comment + 1}`;
}

// The routine under a temporary name, so that the system routine is left
// alone and both versions can be compiled side by side.
function renamed(text, name) {
  return text.replace(/^ROUTINE\s+\S+/, `ROUTINE ${name}`);
}

async function main() {
  if (docker(["--version"]).status !== 0) {
    log("Docker is required: https://docs.docker.com/get-docker/");
    return 2;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "iris-routines-"));
  let started = false;
  let failures = 0;
  const fail = (message) => {
    log(`  ${message}`);
    failures++;
  };
  try {
    log(`Starting ${IMAGE} (the first run downloads the image)...`);
    const run = docker(["run", "-d", "--name", CONTAINER, IMAGE]);
    if (run.status !== 0) throw new Error(run.stderr);
    started = true;
    waitForIris();

    log("Exporting the routines of %SYS...");
    const corpus = exportRoutines(tmp);
    const files = fs.readdirSync(corpus).sort();
    const routineCount = files.filter((file) => /\.int$/i.test(file)).length;
    log(
      `Formatting ${routineCount} INT and ${files.length - routineCount} INC routines...`,
    );

    const upload = path.join(tmp, "upload");
    fs.mkdirSync(upload);
    const names = [];
    for (const file of files) {
      const text = fs
        .readFileSync(path.join(corpus, file), "utf8")
        .replace(/\r\n?/g, "\n");
      const options = { plugins: [plugin], filepath: file };
      const output = await prettier.format(text, options);
      if ((await prettier.format(output, options)) !== output) {
        fail(`not idempotent: ${file}`);
      }
      if (diagnostics(output, file) > diagnostics(text, file)) {
        fail(`new parse errors: ${file}`);
      }
      if (/\.int$/i.test(file)) {
        const change = lineChange(text, output);
        if (change) fail(`${file}: ${change}`);
        const id = `ZZFmt${names.length}`;
        names.push({ id, file });
        fs.writeFileSync(path.join(upload, `${id}O.int`), renamed(text, `${id}O`));
        fs.writeFileSync(path.join(upload, `${id}F.int`), renamed(output, `${id}F`));
      }
    }

    log("Compiling every routine as written and formatted...");
    const copy = docker(["cp", upload, `${CONTAINER}:/tmp/upload`]);
    if (copy.status !== 0) throw new Error(`docker cp failed: ${copy.stderr}`);
    // For each pair, the compilation errors of both versions: their number
    // and their text without the routine name and the column offset.
    const output = iris(
      "USER",
      [
        `Set n=${names.length}`,
        `For i=0:1:n-1 { Set id="ZZFmt"_i For v="O","F" { Kill err Set sc=$SYSTEM.OBJ.Load("/tmp/upload/"_id_v_".int","ck-d",.err),m="" For j=1:1:+$Get(err) { Set m=m_$Replace($Piece($Get(err(j)),"Offset:"),id_v,id)_"|" } Set e(v)=+$Get(err),msg(v)=m } Write "RESULT ",id," ",e("O")," ",e("F")," ",msg("O")=msg("F"),! }`,
      ].join("\n"),
    );
    const results = new Map();
    for (const line of output.split("\n")) {
      const match = line.match(/^RESULT (\S+) (\d+) (\d+) (\d)/);
      if (match) {
        results.set(match[1], {
          errorsOriginal: Number(match[2]),
          errorsFormatted: Number(match[3]),
          sameMessages: match[4] === "1",
        });
      }
    }

    let clean = 0;
    let withErrors = 0;
    for (const { id, file } of names) {
      const result = results.get(id);
      if (!result) {
        fail(`no compilation result: ${file}`);
      } else if (!result.sameMessages) {
        fail(
          `different compilation errors: ${file} (${result.errorsOriginal} -> ${result.errorsFormatted})`,
        );
      } else if (result.errorsOriginal > 0) {
        withErrors++;
      } else {
        clean++;
      }
    }
    log(
      `${clean} of ${names.length} INT routines compile without errors, as written and formatted` +
        (withErrors ? `; ${withErrors} give the same errors in both versions` : "") +
        ".",
    );
    log(
      failures === 0
        ? "OK: formatting keeps the lines and the compilation of the routines."
        : `FAILED: ${failures} problems`,
    );
    return failures === 0 ? 0 : 1;
  } finally {
    if (started && !KEEP) docker(["rm", "-f", CONTAINER]);
    if (KEEP && started) log(`Container kept: ${CONTAINER}`);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
  });
