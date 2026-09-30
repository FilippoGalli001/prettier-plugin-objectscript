Class ObjectScript.Lookup1 {
  /// main loop section, dispatch to different methods based on user input
  ClassMethod Main() {
    While ..GetInput(.type, .search) {
      If (type="help") {
        Do ..Help()
      } ElseIf (type="dob") {
        Do ..DOB(search)
      }
    }
  }

  /// prompt user for a lookup string, return search type and search string
  ClassMethod GetInput(
    Output type As %String,
    Output search As %String
  ) As %Boolean {
    Read !, "Lookup: ", lookup
    Return:(lookup="") 0 // user entered nothing so return FALSE
    If (lookup="?") {
      Set type = "help", search = ""
    } ElseIf (##class(ObjectScript.DataEntry4).ValidDOB(lookup, .convdate)) {
      Set type = "dob", search = convdate
    } Else {
      Set (type, search) = ""
    }
    Return 1
  }

  /// display lookup options
  ClassMethod Help() {
    Write !, "You can enter:", !?10, "* date of birth", !
  }

  /// exact date of birth lookup
  ClassMethod DOB(intdob As %Date) {
    // is the date of birth in the index?
    If '$data(^PersonI("DOB", intdob) ) {
      Write "...no matches"
      Quit
    }

    Write "...finding birthday matches"
    // loop through IDs, and number them
    Set id = ""
    For count = 1:1 {
      Set id = $order(^PersonI("DOB", intdob, id))
      Quit:(id="")
      Write !, count, ") "
      Do ..DisplayLine(id)
    }
    Write !
  }

  /// given an ID, retrieve data and write it on a line
  ClassMethod DisplayLine(id As %Integer) {
    Set $listbuild(name, phone, intdob) = ^PersonD(id)
    /* the line above is equivalent to
    set answers = ^PersonD(id),
    name = $list(answers, 1),
    phone = $list(answers, 2),
    intdob = $list(answers, 3) */
    Write name, ?20, phone, ?35, $zdate(intdob, 2)
  }
}
