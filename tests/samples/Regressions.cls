Include (MacA,MacB)
IncludeGenerator (GenA,GenB)

/// Constructs that used to be formatted wrongly. Each method covers one case.
Class ObjectScript.Regressions Extends %Persistent [ Abstract, Final ]
{
Relationship Owner As ObjectScript.Owner [ Cardinality = one, Inverse = Items ];
ForeignKey OwnerFK(Owner) References Owner(IDKEY) [ OnDelete = cascade ];
Projection Java As %Projection.Java [ Internal ];

/// A legacy If ends at the end of the line: its commands never wrap.
ClassMethod LegacyIfOnOneLine(someCondition As %Boolean)
{
 If someCondition Set firstLongVariable = 1, secondLongVariable = 2, thirdLongVariable = 3 Write "done"
 i  w 1
 f  w 1 q:someCondition
 i someCondition=1 w 1
 e  w 2
}

/// A line break would end a postconditional, even a parenthesized one.
ClassMethod LongPostconditional(veryLongVariableNameOne, veryLongVariableNameTwo)
{
 Set:($Piece(veryLongVariableNameOne, ",", 1) = $Piece(veryLongVariableNameTwo, ",", 2)) result = 1
}

ClassMethod ParenthesizedJson(x, y)
{
 Set arr = [1, (x + 1), (y * 2)]
 Set obj = {"a": (x + 1), "b": [1, (y * 2)]}
}

ClassMethod Directives()
{
 #define Add(%a, %b) (%a + %b)
 #def1arg Raw(%x) %x
 #if 1
 Set x = 1
 #else
 Set x = 2
 #endif
 #if $$$X
 Set y = 1
 Write y
 #elseif 2
 Set y = 3
 #else
 Set y = 4
 #endif
 #ifdef Foo
 Set y = 1
 #endif
 #ifndef Foo
 Set y = 2
 #else
 Set y = 3
 #endif
}

ClassMethod TrailingComments(x)
{
 h // stop execution
 q:x=1 // early return
 Do ..Foo(
  x, // first argument
  2
 )
 Set list = [1, // one
  2]
 Try {
  Set x = 1
 }
 // handle the error
 Catch ex {
  Set x = 0
 }
}

ClassMethod Loops(a, b)
{
 Do {
  Set a = a - 1
 } While /* check */ a > 0
 Do {
  Set a = a - 1
 } While a > 0, b > 0
 While (a > 0), (b > 0) { Set a = a - 1 }
 If a, b { Write 1 }
 Try { Set a = 1 } Catch (ex) { Set a = 0 }
}

ClassMethod Commands(a, b, var)
{
 p +1:5
 zq 1
 zt "ERR"
 Do ##super(a+1,b*2)
 Set c = ##expression(a+1)
 Set d = @var@(a+1,b*2)
 Xecute ("s a=%1", b+1, .c):b>0
}

}
