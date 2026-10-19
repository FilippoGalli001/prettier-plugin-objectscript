const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const prettier = require("prettier");
const plugin = require("../index");
const { objectScriptParser, getParseDiagnostics } = require("../src/parser");

const samplesDir = path.join(__dirname, "samples");
const expectedDir = path.join(__dirname, "expected");
const sampleFiles = fs
  .readdirSync(samplesDir)
  .filter((file) => /\.(cls|int|mac)$/.test(file))
  .sort();

function expectedOutput(fileName) {
  const expectedPath = path.join(expectedDir, fileName);
  assert.ok(
    fs.existsSync(expectedPath),
    `Missing expected output for ${fileName}`,
  );
  return fs.readFileSync(expectedPath, "utf8");
}

async function format(code, options = {}) {
  return prettier.format(code, {
    parser: "objectscript-parser",
    plugins: [plugin],
    ...options,
  });
}

function diagnostics(code) {
  return getParseDiagnostics(objectScriptParser.parse(code));
}

test("formats every fixture without regressions", async (t) => {
  for (const fileName of sampleFiles) {
    await t.test(fileName, async () => {
      const input = fs.readFileSync(path.join(samplesDir, fileName), "utf8");
      const formatted = await format(input, { filepath: fileName });
      const formattedAgain = await format(formatted, { filepath: fileName });
      const inputDiagnostics = diagnostics(input);
      const outputDiagnostics = diagnostics(formatted);

      assert.equal(
        formattedAgain,
        formatted,
        "The formatter must be idempotent",
      );
      assert.equal(
        outputDiagnostics.length,
        0,
        `Syntactically invalid output: input=${inputDiagnostics.length}, output=${outputDiagnostics.length}`,
      );
      assert.equal(formatted, expectedOutput(fileName));
    });
  }
});

test("the parser accepts CRLF line endings after argumentless commands", () => {
  const input = "Class T\r\n{\r\nClassMethod A()\r\n{\r\n b\r\n Quit\r\n Set x=1\r\n}\r\n}\r\n";
  assert.deepEqual(diagnostics(input), []);
});

test("applies command casing and expansion", async () => {
  const input = "Class Demo { Method X() { s x=1 w x } }";
  const uppercase = await format(input, {
    objectScriptCommandCase: "uppercase",
  });
  const lowercase = await format(input, {
    objectScriptCommandCase: "lowercase",
  });
  const abbreviated = await format(input, {
    objectScriptExpandCommands: false,
  });

  assert.match(uppercase, /SET x = 1/);
  assert.match(uppercase, /WRITE x/);
  assert.match(lowercase, /set x = 1/);
  assert.match(lowercase, /write x/);
  assert.match(abbreviated, /S x = 1/);
  assert.match(abbreviated, /W x/);
});

test("applies casing to block commands too", async () => {
  const input = `Class Demo { Method X() {
 if x { s y=1 } elseif y { w 1 } else { q }
 for i=1:1:2 { w i }
 while x { s x=0 }
 do { s x=1 } while x
} }`;
  const uppercase = await format(input, {
    objectScriptCommandCase: "uppercase",
  });

  assert.match(uppercase, /IF x \{/);
  assert.match(uppercase, /\} ELSEIF y \{/);
  assert.match(uppercase, /\} ELSE \{/);
  assert.match(uppercase, /FOR i = 1:1:2 \{/);
  assert.match(uppercase, /WHILE x \{/);
  assert.match(uppercase, /DO \{/);
  assert.match(uppercase, /\} WHILE x/);
});

test("preserves instance variable prefixes", async () => {
  const input = `Class Demo { Method X() {
 Set a = i%Prop, b = r%Prop, c = m%Prop
 Set i%Prop = 5
} }`;
  const formatted = await format(input);

  assert.match(formatted, /Set a = i%Prop, b = r%Prop, c = m%Prop/);
  assert.match(formatted, /Set i%Prop = 5/);
});

test("keeps labels in column 1", async () => {
  const input = `Class Demo {
ClassMethod X() {
 Do Sub
 Quit
Sub
 Write "sub"
Done Quit
}
}`;
  const formatted = await format(input);

  assert.match(formatted, /\nSub\n/);
  assert.match(formatted, /\nDone Quit\n/);
  assert.equal(await format(formatted), formatted);
  assert.equal(diagnostics(formatted).length, 0);
});

test("keeps two spaces after argumentless commands", async () => {
  const input = `Class Demo {
ClassMethod X(x) {
 If x Quit  Write "after"
 Do  Write "x"
 Quit:x  Write "y"
}
}`;
  const formatted = await format(input);

  assert.match(formatted, /If x Quit {2}Write "after"/);
  assert.match(formatted, /Do {2}Write "x"/);
  assert.match(formatted, /Quit:x {2}Write "y"/);
  assert.equal(diagnostics(formatted).length, 0);
});

test("does not split the commands of a legacy If across lines", async () => {
  const input = `Class Demo {
ClassMethod X(x) {
 If x Set aaaaaaaaaaaaaaaaaaaa=1 Write "${"b".repeat(60)}" Kill ccccccccccccccc
}
}`;
  const formatted = await format(input);

  assert.match(
    formatted,
    /If x Set aaaaaaaaaaaaaaaaaaaa = 1 Write "b+" Kill ccccccccccccccc/,
  );
});

test("formats legacy dotted syntax", async () => {
  const input = `Class Demo {
ClassMethod X(x) {
 If x Do
 . Write "inside"
 . If x Do
 . . Write "nested"
 Write "out"
}
}`;
  const formatted = await format(input);

  assert.match(formatted, /If x Do\n\s+\. Write "inside"\n/);
  assert.match(formatted, /\n\s+\. \. Write "nested"\n/);
  assert.equal(await format(formatted), formatted);
  assert.equal(diagnostics(formatted).length, 0);
});

test("normalizes less common commands and tells Halt from Hang", async () => {
  const input = `Class Demo { ClassMethod X() {
 m ^a=^b
 g Start:x=0
 h
 h 5
 zw x
 Kill (a,b)
 For b = "John","Paul" { }
} }`;
  const expanded = await format(input);
  const abbreviated = await format(input, {
    objectScriptExpandCommands: false,
  });

  assert.match(expanded, /Merge \^a = \^b/);
  assert.match(expanded, /Goto Start:x=0/);
  assert.match(expanded, /\n\s+Halt\n/);
  assert.match(expanded, /Hang 5/);
  assert.match(expanded, /ZWrite x/);
  assert.match(expanded, /Kill \(a, b\)/);
  assert.match(expanded, /For b = "John", "Paul" \{/);
  assert.match(abbreviated, /\n\s+H\n/);
  assert.match(abbreviated, /ZW x/);
});

test("copies XData, Storage, Query and Python payloads verbatim", async () => {
  const yaml = ["openapi: 3.0.0", "info:", "  title: Demo"].join("\n");
  const storage = ['<Data name="D">', "<Value>%%CLASSNAME</Value>", "</Data>"].join("\n");
  const python = ["  x = 1", "  if x:", "      print(x)"].join("\n");
  const sql = ["SELECT %ID FROM Demo", " WHERE Name = :name"].join("\n");
  const input = `Class Demo Extends %Persistent {
XData Spec [ MimeType = application/yaml ]
{
${yaml}
}
ClassMethod Py() [ Language = python ]
{
${python}
}
Query ByName(name As %String) As %SQLQuery [ SqlProc ]
{
${sql}
}
Storage Default
{
${storage}
}
}`;
  const formatted = await format(input);

  assert.ok(formatted.includes(`{\n${yaml}\n  }`), formatted);
  assert.ok(formatted.includes(`{\n${python}\n  }`), formatted);
  assert.ok(formatted.includes(`{\n${sql}\n  }`), formatted);
  assert.ok(formatted.includes(`{\n${storage}\n  }`), formatted);
  assert.match(formatted, /XData Spec \[MimeType = application\/yaml\]\n {2}\{/);
  assert.equal(await format(formatted), formatted);
});

test("formats the body of ObjectScript triggers", async () => {
  const input = `Class Demo Extends %Persistent {
Trigger Upd [ Event = UPDATE ]
{
 s x=1
}
}`;
  const formatted = await format(input);

  assert.match(formatted, /Trigger Upd \[Event = UPDATE\]\n {2}\{\n {4}Set x = 1\n {2}\}/);
});

test("preserves the internal alignment of block comments", async () => {
  const input = `Class Demo {
ClassMethod X() {
 /* first
      aligned
    second */
 Quit
}
}`;
  const formatted = await format(input);

  assert.match(formatted, / {4}\/\* first\n {9}aligned\n {7}second \*\//);
  assert.equal(await format(formatted), formatted);
});

test("moves Else and ElseIf onto the closing brace line", async () => {
  const input = `Class Demo {
ClassMethod X(t) {
 if t { write 1 }
 elseif 't { write 2 }
 else { write 3 }
}
}`;
  const formatted = await format(input);

  assert.match(formatted, /\} ElseIf 't \{/);
  assert.match(formatted, /\} Else \{/);
});

test("preserves object reference dots, qualified types and JSON", async () => {
  const input = `Class Demo {
Method X() {
  #dim error As %Exception.SystemException
  Set status = error.AsStatus()
  Set object = {"name":"value"}
}
}`;
  const formatted = await format(input);

  assert.match(formatted, /%Exception\.SystemException/);
  assert.match(formatted, /error\.AsStatus\(\)/);
  assert.match(formatted, /\{"name": "value"\}/);
  assert.equal(diagnostics(formatted).length, 0);
});

test("keeps embedded Python as an opaque block", async () => {
  const input = [
    "Class ObjectScript.PythonInterop",
    "{",
    "ClassMethod Hello(name As %String) As %String [ Language = python ]",
    "{",
    '    message = f"Hello, {name}"',
    "    if not name:",
    '        return "Hello"',
    "    return message",
    "}",
    "}",
  ].join("\n");
  const formatted = await format(input);
  const formattedAgain = await format(formatted);

  assert.match(formatted, /\[Language = python\]/);
  assert.match(formatted, /    if not name:\n        return "Hello"/);
  assert.equal(diagnostics(formatted).length, 0);
  assert.equal(formattedAgain, formatted);
});

test("strict parsing rejects unrecognized input", async () => {
  await assert.rejects(
    format("Class {", { objectScriptStrictParsing: true }),
    (error) =>
      error &&
      error.name === "ObjectScriptParseError" &&
      Array.isArray(error.diagnostics),
  );
});

test("selective debug writes only to stderr and filters nodes", async () => {
  let debugOutput = "";
  const originalWrite = process.stderr.write;
  process.stderr.write = (chunk) => {
    debugOutput += String(chunk);
    return true;
  };

  let formatted;
  try {
    formatted = await format(
      "Class Demo { Method X() { Set x=obj.Method() } }",
      {
        filepath: "debug-sample.cls",
        objectScriptDebug: true,
        objectScriptDebugNodes: "oref_chain_segment",
        objectScriptDebugMax: 5,
      },
    );
  } finally {
    process.stderr.write = originalWrite;
  }

  const records = debugOutput
    .split(/\r?\n/)
    .filter((line) => line.startsWith("[objectscript-debug] {"));
  assert.ok(records.length > 0, "Debug produced no records");
  assert.ok(records.length <= 5, "Debug did not respect the limit");
  assert.ok(
    records.every((line) => line.includes('"type":"oref_chain_segment"')),
  );
  assert.doesNotMatch(formatted, /objectscript-debug/);
});

test("places the opening brace of declarations on the next line by default", async () => {
  const input = `Class Demo Extends %Persistent {
XData Spec [ MimeType = application/xml ] {
<a/>
}
Trigger Upd [ Event = UPDATE ] {
 s x=1
}
Method X() {
 if x { w 1 } else { w 2 }
 try { w 1 } catch e { w 2 }
}
Method Empty() { }
}`;
  const formatted = await format(input);

  assert.match(formatted, /^Class Demo Extends %Persistent\n\{\n/);
  assert.match(formatted, /\n {2}XData Spec \[MimeType = application\/xml\]\n {2}\{\n<a\/>\n {2}\}/);
  assert.match(formatted, /\n {2}Trigger Upd \[Event = UPDATE\]\n {2}\{\n/);
  assert.match(formatted, /\n {2}Method X\(\)\n {2}\{\n/);
  assert.match(formatted, /\n {2}Method Empty\(\)\n {2}\{\n {2}\}\n/);
  // Control-flow blocks keep the brace on the same line.
  assert.match(formatted, /If x \{[\s\S]*\} Else \{/);
  assert.match(formatted, /Try \{[\s\S]*\} Catch e \{/);
  assert.equal(diagnostics(formatted).length, 0);
  assert.equal(await format(formatted), formatted);
});

test("objectScriptBraceStyle same-line keeps the brace on the declaration line", async () => {
  const input = "Class Demo\n{\nClassMethod X(a As %String)\n{\n Quit\n}\n}";
  const options = { objectScriptBraceStyle: "same-line" };
  const formatted = await format(input, options);

  assert.equal(
    formatted,
    "Class Demo {\n  ClassMethod X(a As %String) {\n    Quit\n  }\n}\n",
  );
  assert.equal(await format(formatted, options), formatted);
});

function leaves(node, result = []) {
  if (node.childCount === 0) {
    if (node.endIndex > node.startIndex) result.push(`${node.type}:${node.text}`);
  } else {
    for (const child of node.children) leaves(child, result);
  }
  return result;
}

test("spaces around binary operators never change how the code is parsed", async () => {
  const input = fs.readFileSync(path.join(samplesDir, "Operators.cls"), "utf8");
  const formatted = await format(input);

  assert.deepEqual(
    leaves(objectScriptParser.parse(formatted)),
    leaves(objectScriptParser.parse(input)),
  );
});

test("keeps postconditionals and For ranges compact", async () => {
  const input = `Class Demo {
Method X(a, b) {
 Do:a=1 ..Y(a+1)
 Quit:a'=b&&b>2 a+b
 For i=1:1:a+1 { Write i+1 }
}
}`;
  const formatted = await format(input);

  assert.match(formatted, /Do:a=1 \.\.Y\(a \+ 1\)/);
  assert.match(formatted, /Quit:a'=b&&b>2 a \+ b/);
  assert.match(formatted, /For i = 1:1:a\+1 \{\n\s+Write i \+ 1/);
});

test("keeps concatenation and pattern matches compact", async () => {
  const formatted = await format(
    'Class Demo {\nMethod X(s) {\n Set t="a"_s_"b"\n Set ok=(s?3N)\n}\n}',
  );

  assert.match(formatted, /Set t = "a"_s_"b"/);
  assert.match(formatted, /Set ok = \(s\?3N\)/);
});
