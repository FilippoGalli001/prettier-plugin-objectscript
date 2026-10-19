/// Constructs that older tree-sitter-objectscript versions reported as syntax errors.
Class ObjectScript.GrammarUpdate Extends %Persistent
{
  Property Code(MAXLEN = 10) As %String [Required];

  Property Tags As list Of %String(MAXLEN = 20);

  Parameter Mode As COSEXPRESSION = "1";

  Index CodeIdx On (Code As EXACT, Tags(ELEMENTS)) [Unique];

  Index CodeOnly On Code;

  ForeignKey OwnerFK(Code) References ObjectScript.Owner();

  Relationship Owner As ObjectScript.Owner [ Cardinality = one, Inverse = Items ];

  ClientMethod Refresh(id As %String) As %String [Language = javascript]
  {
	return id;
  }

  Method Empty()
  {
  }

  Method Double(val As %Integer) As %Integer [CodeMode = expression]
  {
    val
  }

  Method Check() [ZenMethod]
  {
    Set sc = $$$ERROR($$$GeneralError,"Missing code")
    $$$ThrowOnError(sc)
    Do $$$LOGINFO("checked")
    Set path = $$$MAC.Path
    zedit "Routine"
    Do
    . Do
    . . Write "nested"
    If sc {
      Write 1
    } ElseIf 'sc {
      Write 2
    } Else {
      Write 3
    }
    Try {
      Do ..Empty()
    } Catch ex {
      Throw ex
    }
  }

  Trigger Audit [Event = INSERT, Time = AFTER]
  {
    Set ^Log($Increment(^Log)) = %ROWID
  }
}
