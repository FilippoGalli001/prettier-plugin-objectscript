#!/usr/bin/env node

/**
 * Checks, against a real InterSystems IRIS instance, that formatting does not
 * change what the code does.
 *
 * The fixtures in tests/samples and the executable class in tests/iris are
 * compiled as written and after being formatted with several option sets, in
 * a throwaway IRIS Community container. The compilation errors of every
 * variant must match those of the original files, and the output of
 * Check.Ops.Run() must be identical.
 *
 * Requires Docker. Usage: npm run test:iris [-- --keep]
 *   IRIS_IMAGE   image to use (default intersystems/iris-community:latest-cd)
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const prettier = require("prettier");
const plugin = require("../index");

const IMAGE = process.env.IRIS_IMAGE || "intersystems/iris-community:latest-cd";
const KEEP = process.argv.includes("--keep");
const CONTAINER = `iris-check-${process.pid}`;
const root = path.resolve(__dirname, "..");

const VARIANTS = {
  orig: null,
  next: {},
  same: { objectScriptBraceStyle: "same-line" },
  wrap: { objectScriptBreakLongExpressions: true },
};

function docker(args, input) {
  return spawnSync("docker", args, {
    input,
    encoding: "utf8",
    maxBuffer: 1 << 26,
  });
}

function log(message) {
  process.stderr.write(`${message}\n`);
}

async function writeVariants(tmp) {
  const sources = [
    { dir: "fx", from: path.join(root, "tests", "samples") },
    { dir: "ops", from: path.join(root, "tests", "iris") },
  ];
  for (const [variant, options] of Object.entries(VARIANTS)) {
    for (const { dir, from } of sources) {
      const target = path.join(tmp, `${dir}_${variant}`);
      fs.mkdirSync(target, { recursive: true });
      for (const file of fs.readdirSync(from)) {
        const text = fs.readFileSync(path.join(from, file), "utf8");
        const output =
          options && file.endsWith(".cls")
            ? await prettier.format(text, {
                parser: "objectscript-parser",
                plugins: [plugin],
                filepath: file,
                ...options,
              })
            : text;
        fs.writeFileSync(path.join(target, file), output);
      }
    }
  }
}

function waitForIris() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const result = docker(
      ["exec", "-i", CONTAINER, "iris", "session", "iris", "-U", "USER"],
      'Write "ready",!\nHalt\n',
    );
    if (result.stdout && result.stdout.includes("ready")) return;
    spawnSync(process.execPath, ["-e", "setTimeout(() => {}, 3000)"]);
  }
  throw new Error("IRIS did not start within 3 minutes");
}

function irisScript() {
  const lines = [];
  for (const variant of Object.keys(VARIANTS)) {
    lines.push(
      `Write "=== FIXTURES ${variant}",!`,
      `Set sc=$SYSTEM.OBJ.LoadDir("/tmp/v/fx_${variant}","ck-d/displayerror",.errs,0)`,
      `Do $SYSTEM.OBJ.DeletePackage("ObjectScript","-d")`,
      `Do $SYSTEM.OBJ.DeletePackage("Demo","-d")`,
      `Write "=== RUN ${variant}",!`,
      `Kill ^CheckOps`,
      `Set sc=$SYSTEM.OBJ.Load("/tmp/v/ops_${variant}/CheckMac.inc","ck-d")`,
      `Set sc=$SYSTEM.OBJ.Load("/tmp/v/ops_${variant}/Ops.cls","ck-d/displayerror")`,
      `Try { Do ##class(Check.Ops).Run() } Catch ex { Write "RUNERR: ",ex.DisplayString(),! }`,
      `Do $SYSTEM.OBJ.Delete("Check.Ops","-d")`,
      `Do ##class(%Routine).Delete("CheckMac.INC")`,
    );
  }
  lines.push("Halt");
  return `${lines.join("\n")}\n`;
}

// Line numbers and offsets change when the code is reformatted.
function normalize(block) {
  const counts = new Map();
  for (const rawLine of block.split("\n")) {
    if (rawLine.startsWith(" TEXT:")) continue;
    const line = rawLine
      .replace(/\.1\(\d+\)/g, ".1(N)")
      .replace(/\.cls\(\w+\+\d+\)/g, ".cls(M)")
      .replace(/\[[^\]]*\]/g, "[..]")
      .replace(/(Invalid character in tag :) '[^']*'/g, "$1")
      .replace(/Offset:\d+/g, "Offset")
      .trim();
    if (line) counts.set(line, (counts.get(line) || 0) + 1);
  }
  return counts;
}

function sections(output) {
  const result = {};
  const parts = output.split(/=== (FIXTURES|RUN) (\w+)\n/);
  for (let i = 1; i < parts.length; i += 3) {
    result[`${parts[i]} ${parts[i + 1]}`] = parts[i + 2];
  }
  return result;
}

function sameCounts(a, b) {
  if (a.size !== b.size) return false;
  for (const [key, value] of a) if (b.get(key) !== value) return false;
  return true;
}

async function main() {
  if (docker(["--version"]).status !== 0) {
    log("Docker is required: https://docs.docker.com/get-docker/");
    return 2;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "iris-check-"));
  let started = false;
  try {
    log("Formatting the fixtures...");
    await writeVariants(tmp);

    log(`Starting ${IMAGE} (the first run downloads the image)...`);
    const run = docker(["run", "-d", "--name", CONTAINER, IMAGE]);
    if (run.status !== 0) throw new Error(run.stderr);
    started = true;
    waitForIris();

    docker(["exec", CONTAINER, "mkdir", "-p", "/tmp/v"]);
    for (const name of fs.readdirSync(tmp)) {
      const copy = docker([
        "cp",
        path.join(tmp, name),
        `${CONTAINER}:/tmp/v/${name}`,
      ]);
      if (copy.status !== 0) throw new Error(copy.stderr);
    }

    log("Compiling and running...");
    const result = docker(
      ["exec", "-i", CONTAINER, "iris", "session", "iris", "-U", "USER"],
      irisScript(),
    );
    const output = result.stdout
      .split("\n")
      .filter((line) => line.trim() && !/^USER>\s*$/.test(line))
      .join("\n")
      .concat("\n");
    const found = sections(output);

    let failures = 0;
    const baseFixtures = normalize(found["FIXTURES orig"] || "");
    const baseRun = found["RUN orig"] || "";
    if (!baseRun.includes("if1")) {
      log(`The original Check.Ops did not run to completion:\n${baseRun}`);
      failures++;
    }
    for (const variant of Object.keys(VARIANTS).filter((v) => v !== "orig")) {
      const fixtures = normalize(found[`FIXTURES ${variant}`] || "");
      const variantRun = found[`RUN ${variant}`] || "";
      const okFixtures = sameCounts(baseFixtures, fixtures);
      const okRun = variantRun === baseRun;
      log(
        `${variant.padEnd(5)} compilation messages: ${okFixtures ? "same as original" : "DIFFERENT"}; ` +
          `Check.Ops output: ${okRun ? "identical" : "DIFFERENT"}`,
      );
      if (!okFixtures) {
        failures++;
        for (const [line, count] of fixtures) {
          if (baseFixtures.get(line) !== count) log(`  new or changed: ${line}`);
        }
        for (const [line, count] of baseFixtures) {
          if (fixtures.get(line) !== count) log(`  missing: ${line}`);
        }
      }
      if (!okRun) {
        failures++;
        log(`  original:\n${baseRun}\n  ${variant}:\n${variantRun}`);
      }
    }
    const total = [...baseFixtures.values()].reduce((a, b) => a + b, 0);
    log(
      `The original fixtures give ${total} compilation messages: some of them ` +
        "use classes or tables that do not exist in a clean IRIS. Only differences matter.",
    );
    log(failures === 0 ? "OK: formatting does not change the behavior." : "FAILED");
    return failures === 0 ? 0 : 1;
  } finally {
    if (started && !KEEP) docker(["rm", "-f", CONTAINER]);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    log(error.stack || String(error));
    process.exit(1);
  },
);
