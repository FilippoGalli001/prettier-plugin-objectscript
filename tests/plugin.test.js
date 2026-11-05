const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const prettier = require("prettier");
const plugin = require("../index");
const {
  objectScriptParser,
  parserForFile,
  getParseDiagnostics,
} = require("../src/parser");

const samplesDir = path.join(__dirname, "samples");
const expectedDir = path.join(__dirname, "expected");
const sampleFiles = fs
  .readdirSync(samplesDir)
  .filter((file) => /\.(cls|inc|mac|int)$/.test(file))
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
    parser: parserForFile(options.filepath || "").name,
    plugins: [plugin],
    ...options,
  });
}

function diagnostics(code, fileName = "") {
  return getParseDiagnostics(parserForFile(fileName).parser.parse(code));
}

test("formats every fixture without regressions", async (t) => {
  for (const fileName of sampleFiles) {
    await t.test(fileName, async () => {
      const input = fs.readFileSync(path.join(samplesDir, fileName), "utf8");
      const formatted = await format(input, { filepath: fileName });
      const formattedAgain = await format(formatted, { filepath: fileName });
      const inputDiagnostics = diagnostics(input, fileName);
      const outputDiagnostics = diagnostics(formatted, fileName);

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

test("formats the operands of subscripts, extrinsic functions and $Select", async () => {
  const formatted = await format(
    `Class Demo {
Method X(x) {
 Set a=^Data(x+1,"k")+x(i*2,j)+$Select(x>0:x+1,1:0)
 Set b=$$Func^Rtn(x-1)+'(x<y)
 Set $Piece(h,",",x+1)=y
}
}`,
  );

  assert.match(
    formatted,
    /Set a = \^Data\(x \+ 1, "k"\) \+ x\(i \* 2, j\) \+ \$Select\(x > 0:x \+ 1, 1:0\)\n/,
  );
  assert.match(formatted, /Set b = \$\$Func\^Rtn\(x - 1\) \+ '\(x < y\)\n/);
  assert.match(formatted, /Set \$Piece\(h, ",", x \+ 1\) = y/);
});

test("keeps the arguments of macro calls as written", async () => {
  const formatted = await format(
    'Class Demo {\nMethod X(x) {\n Set sc=$$$ERROR($$$GeneralError,"x"_x+1)*2\n}\n}',
  );

  assert.match(formatted, /Set sc = \$\$\$ERROR\(\$\$\$GeneralError,"x"_x\+1\) \* 2/);
});

test("allows whitespace in a postconditional only when it is parenthesized", async () => {
  const formatted = await format(
    `Class Demo {
Method X(a, b) {
 Quit:(a=$Length(b,","))||(a>1) 1
 Quit:($Length(b,",")>a) 2
 Quit:$Length(b,",")>a 3
}
}`,
  );

  assert.match(formatted, /Quit:\(a=\$Length\(b,","\)\)\|\|\(a>1\) 1/);
  assert.match(formatted, /Quit:\(\$Length\(b, ","\) > a\) 2/);
  assert.match(formatted, /Quit:\$Length\(b,","\)>a 3/);
});

test("objectScriptBreakLongExpressions breaks only inside parentheses", async () => {
  const input = `Class Demo {
Method X() {
 Set total=(firstOperandWithLongName+secondOperandWithLongName*thirdOperandWithLongName-fourthOperandWithLongName)
 Set bare=firstOperandWithLongName+secondOperandWithLongName*thirdOperandWithLongName-fourthOperandWithLongName+fifthOperand
}
}`;
  const options = { objectScriptBreakLongExpressions: true };
  const plain = await format(input);
  const wrapped = await format(input, options);

  assert.ok(plain.split("\n").some((line) => line.length > 100), plain);
  assert.match(
    wrapped,
    /Set total = \(firstOperandWithLongName \+\n\s+secondOperandWithLongName \*\n\s+thirdOperandWithLongName -\n\s+fourthOperandWithLongName\)/,
  );
  assert.match(wrapped, /Set bare = firstOperandWithLongName \+ secondOperandWithLongName/);
  assert.deepEqual(
    leaves(objectScriptParser.parse(wrapped)),
    leaves(objectScriptParser.parse(plain)),
  );
  assert.equal(await format(wrapped, options), wrapped);
});

test("objectScriptBreakLongExpressions never breaks a subscript", async () => {
  const input = `Class Demo {
Method X() {
 Set x=^GlobalData(firstVeryLongVariableName+secondVeryLongVariableName+thirdVeryLongVariableName)
}
}`;
  const formatted = await format(input, {
    objectScriptBreakLongExpressions: true,
  });

  assert.match(
    formatted,
    /Set x = \^GlobalData\(firstVeryLongVariableName \+ secondVeryLongVariableName \+ thirdVeryLongVariableName\)\n/,
  );
});

test("objectScriptExpandCommands false also keeps block commands abbreviated", async () => {
  const formatted = await format(
    `Class Demo {
Method X(x) {
 i x { s a=1 } else { s a=2 }
 f j=1:1:3 { w j }
 d { s x=x-1 } while x>0
}
}`,
    { objectScriptExpandCommands: false },
  );

  // Abbreviations stay abbreviated; keywords written in full stay in full.
  assert.match(formatted, /\n {4}I x \{\n {6}S a = 1\n {4}\} Else \{/);
  assert.match(formatted, /\n {4}F j = 1:1:3 \{\n {6}W j\n/);
  assert.match(formatted, /\n {4}D \{\n {6}S x = x - 1\n {4}\} While x > 0\n/);
});

test("keeps the body of a trigger written in SQL as written", async () => {
  const body = " INSERT INTO Log VALUES (1)";
  const formatted = await format(
    `Class Demo Extends %Persistent {
Trigger T [ Event = INSERT, Language = sql ]
{
${body}
}
}`,
  );

  assert.ok(formatted.includes(`\n${body}\n`), formatted);
});

test("include files: directives are formatted, code lines are kept as written", async () => {
  const input = `ROUTINE Demo [Type=INC]
  #define   Twice(%x) (%x*2)
#ifdef Twice
#def1arg Join(%a) $lb(%a)
#endif
  ; a comment
 s x=1
`;
  // The parser is inferred from the extension, as with the CLI and VS Code.
  const formatted = await prettier.format(input, {
    plugins: [plugin],
    filepath: "Demo.inc",
  });

  assert.equal(
    formatted,
    `ROUTINE Demo [Type=INC]
#Define Twice(%x) (%x*2)
#IfDef Twice
#Def1Arg Join(%a) $lb(%a)
#EndIf
  ; a comment
 s x=1
`,
  );
});

test("routines keep their lines, labels and comment lines", async () => {
  const input = `ROUTINE Demo
Demo ; entry


 s x=1 w x
 n a,b,
   c
Data ;;first
   ;;  second
Proc(n) public {
 q n*2
}
`;
  for (const filepath of ["Demo.mac", "Demo.int"]) {
    // The parser is inferred from the extension, as with the CLI and VS Code.
    const formatted = await prettier.format(input, {
      plugins: [plugin],
      filepath,
    });
    assert.equal(
      formatted,
      `ROUTINE Demo
Demo ; entry


  Set x = 1 Write x
  n a,b,
   c
Data ;;first
   ;;  second
Proc(n) public {
  Quit n * 2
}
`,
    );
  }
});

test("a /* */ comment does not end a legacy If", async () => {
  const formatted = await format(
    "Class Demo {\nMethod X(x) {\n i x /* why */ s y=1\n}\n}",
  );

  assert.match(formatted, /\n {4}If x \/\* why \*\/ Set y = 1\n/);
});

test("an argumentless command nested after Do keeps two spaces", async () => {
  const formatted = await format(
    "Class Demo {\nMethod X(x) {\n f  d  q:x>3  s x=x+1\n}\n}",
  );

  assert.match(formatted, /\n {4}For  Do  Quit:x>3  Set x = x \+ 1\n/);
});
