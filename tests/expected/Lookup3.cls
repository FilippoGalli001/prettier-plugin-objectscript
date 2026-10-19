Class ObjectScript.Lookup3
{
  /// main loop section, dispatch to different methods based on user input
  ClassMethod Main()
  {
    Do ..CurrentCount()
    While ..GetInput(.type, .search) {
      If (type="help") {
        Do ..Help() Set id = ""
      } ElseIf (type="phone") {
        Do ..Phone(search, .id)
      } ElseIf (type="name") {
        Do ..Name(search, .id)
      } ElseIf (type="dob") {
        Do ..DOB(search, .id)
      }
      If ((type'="")&&(id'="")) {
        Do ..TakeAction(id)
      }
    }
  }

  /// prompt user for a lookup string, return search type and search string
  ClassMethod GetInput(
    Output type As %String,
    Output search As %String
  ) As %Boolean
  {
    Read !, "Lookup: ", lookup
    Return:(lookup="") 0 // user entered nothing so return FALSE
    If (lookup="?") {
      Set type = "help", search = ""
    }
    // the RegEx accepts ###- or ###-###-#### only
    ElseIf $match(lookup, "\d{3}-(\d{3}-\d{4})?") {
      Set type = "phone", search = lookup
    }
    /* the $zconvert converts the last name and first name entered to Last,First format
    the pattern match accepts Lastname only, or Lastname,Firstname */
    ElseIf ($zconvert(lookup, "W")?1U.L.1(1","1U.L)) {
      Set type = "name", search = $zconvert(lookup, "W")
    } ElseIf (##class(ObjectScript.DataEntry4).ValidDOB(lookup, .convdate)) {
      Set type = "dob", search = convdate
    } Else {
      // this is a hack for invalid input
      // ValidDOB() writes an error message, and the text below gets added to that
      Write ", name, or phone"
      Set (type, search) = ""
    }
    Return 1
  }

  /// display lookup options
  ClassMethod Help()
  {
    Write !, "You can enter:", !?10, "* date of birth", !?10,
      "* full phone number or area code only ""617-""", !?10,
      "* full name: Smith,John", !?10, "* last name: Smith", !?10,
      "* partial name: Sm,J or Smith,J or Sm,John", !
  }

  /// exact date of birth lookup
  ClassMethod DOB(intdob As %Date, Output id As %Integer)
  {
    Set id = ""
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
      Set matches(count) = id // keep track of matches
      Write !, count, ") "
      Do ..DisplayLine(id)
    }
    Do ..Select(.matches, .id)
  }

  /// lookup phone or area code
  ClassMethod Phone(phone As %String, Output id As %Integer)
  {
    Set id = ""
    Set count = 0
    // handle exact match first
    Set id = $get(^PersonI("Phone", phone))
    If (id'="") {
      Set count = 1
      Set matches(1) = id // keep track of exact match
      Write !, "1) "
      Do ..DisplayLine(id)
      Quit
    }
    // handle area code matches next
    ElseIf (phone?3n1"-") {
      // use 3-argument $order to get first matching phone number and its ID number
      Set ph = $order(^PersonI("Phone", phone), 1, id)
      // loop through matching phones, and number them
      While ($extract(ph, 1, $length(phone))=phone) {
        Write:(count=0) "...finding area code matches"
        Set count = count+1
        Set matches(count) = id // keep track of matches
        Write !, count, ") "
        Do ..DisplayLine(id)
        // use 3-arg $order to get the next phone number and its ID number
        Set ph = $order(^PersonI("Phone", ph), 1, id)
      }
    }
    If (count=0) {
      Write "...no matches"
    } Else {
      Do ..Select(.matches, .id)
    }
  }

  /// lookup names in these forms: Smith; Smith,John; Smith,J; Sm,John; Sm,J
  ClassMethod Name(name As %String, Output id As %Integer)
  {
    Set id = ""
    Set count = 0
    Set last = $piece(name, ",", 1), first = $piece(name, ",", 2)
    // last may be an exact match, so find preceding last name
    Set ln = $order(^PersonI("Name", last), -1)
    // loop through last names
    For {
      Set ln = $order(^PersonI("Name", ln))
      // quit as soon as last name doesn't match original
      Quit:($extract(ln, 1, $length(last))'=last)
      // first may be "". Otherwise, it may be an exact match, so find preceding first name
      If (first="") {
        Set fn = ""
      } Else {
        Set fn = $order(^PersonI("Name", ln, first), -1)
      }
      // loop through first names
      For {
        Set fn = $order(^PersonI("Name", ln, fn))
        // quit as soon as first name doesn't match original, or is ""
        Quit:(($extract(fn, 1, $length(first))'=first)||(fn=""))
        Set id = ""
        // loop through all IDs
        For {
          Set id = $order(^PersonI("Name", ln, fn, id))
          Quit:(id="")
          Write:(count=0) "...finding name matches"
          Set count = count+1
          Set matches(count) = id // keep track of matches
          Write !, count, ") "
          Do ..DisplayLine(id)
        }
      }
    }
    If (count=0) {
      Write "...no matches"
    } Else {
      Do ..Select(.matches, .id)
    }
  }

  /// given an ID, retrieve data and write it on a line
  ClassMethod DisplayLine(id As %Integer)
  {
    Set $listbuild(name, phone, intdob) = ^PersonD(id)
    /* the line above is equivalent to
    set answers = ^PersonD(id),
    name = $list(answers, 1),
    phone = $list(answers, 2),
    intdob = $list(answers, 3) */
    Write name, ?20, phone, ?35, $zdate(intdob, 2)
  }

  /// count the "1" bits from the chunks of the Bitmap-ID index
  ClassMethod CurrentCount()
  {
    Set records = 0, chunk = ""
    For {
      // use the 3-argument $order to get the next chunk and the bits stored there
      Set chunk = $order(^PersonI("Bitmap-ID", chunk), 1, bits)
      Quit:(chunk="")
      // add the "1" bits to the count
      Set records = records+$bitcount(bits, 1)
    }
    Write !, "There are ", records, " records in the database."
  }

  /// user makes a choice from the matches array, return the corresponding ID or ""
  ClassMethod Select(ByRef matches As %Integer, Output id As %Integer)
  {
    Set id = ""
    For {
      Read !!, "Choose by number: ", choice
      Quit:(choice="")
      Set id = $get(matches(choice))
      Quit:(id'="")  // stop looping if user makes a valid choice
      Write "...Invalid choice"
    }
  }

  /// display chosen record, and optionally delete/edit/write to file
  ClassMethod TakeAction(id As %Integer)
  {
    Set record = ^PersonD(id)
    Do ##class(ObjectScript.DataEntry4).Display(record)

    // ask if user wants to delete
    Read !, "Delete? (y/n): ", yn
    If ((yn="y")||(yn="Y")) {
      Do ..Delete(id, record)
      Quit
    }

    // ask if user wants to edit
    Read !, "Edit? (y/n): ", yn
    If ((yn="y")||(yn="Y")) {
      Do ..Edit(id, record)
      Quit
    }
  }

  /// delete chosen record (lock, start a txn, kill global nodes, commit txn, unlock)
  ClassMethod Delete(id As %Integer, record As %String)
  {
    // try to lock the record for 5 seconds
    Lock +^PersonD(id):5
    If '$test {
      Write "...someone else is editing this person. Try again later."
      Quit
    }
    // retrieve data
    Set $listbuild(name, phone, intdob) = record
    Set last = $piece(name, ",", 1), first = $piece(name, ",", 2)
    Set chunk = (id\64000)+1, position = (id#64000)+1

    // change all globals inside a transaction
    TStart
    Kill ^PersonD(id)
    Kill ^PersonI("Name", last, first, id)
    Kill ^PersonI("Phone", phone)
    Kill ^PersonI("DOB", intdob, id)
    Set $bit(^PersonI("Bitmap-ID", chunk), position) = 0
    TCommit
    Write "...deleted"
    Lock -^PersonD(id)
  }

  /// edit chosen record (lock, reprompt, compare, update globals, unlock)
  ClassMethod Edit(id As %Integer, record As %String)
  {
    // try to lock the record for 5 seconds
    Lock +^PersonD(id):5
    If '$test {
      Write "...someone else is editing this person. Try again later."
      Quit
    }
    // show current data and prompt for updates
    Do ..Reprompt(record, .newanswers)
    // if changes were made, update the record
    If '$listsame(record, newanswers) {
      Do ..Update(id, record, newanswers)
    }
    Lock -^PersonD(id)
  }

  /// prompt for updates - similar to ##class(ObjectScript.DataEntry4).Prompt()
  ClassMethod Reprompt(currentdata As %String, ByRef newanswers As %String)
  {
    // get current name, phone, intdob so that they can be displayed within prompts
    Set $listbuild(currentname, currentphone, currentintdob) = currentdata
    Do {
      Write !, "Name: ", currentname, " => "
      Read newname
      // enter nothing to keep current value
      If (newname="") {
        Set newname = currentname
        Quit
      }
    } While '##class(ObjectScript.DataEntry4).ValidName(newname)

    Do {
      Write !, "Phone: ", currentphone, " => "
      Read "(617): ", newphone
      // enter nothing to keep current value
      If (newphone="") {
        Set newphone = currentphone
        Quit
      }
    } While '##class(ObjectScript.DataEntry4).ValidPhone(.newphone)

    Do {
      Write !, "DOB: ", $zdate(currentintdob, 2), "=> "
      Read newdob
      // enter nothing to keep current value
      If (newdob="") {
        Set newintdob = currentintdob
        Quit
      }
    } While '##class(ObjectScript.DataEntry4).ValidDOB(newdob, .newintdob)

    Set newanswers = $listbuild(newname, newphone, newintdob)
  }

  /// save the updated record (start a txn, updating data and index globals using set and kill, commit txn)
  ClassMethod Update(
    id As %Integer,
    currentdata As %String,
    ByRef newanswers As %String
  )
  {
    Read !, "Store updates? (y/n): ", yn // ask if user wants to store
    // only go on if user says yes
    If ((yn'="y")&&(yn'="Y")) {
      Write "...not stored."
      Quit
    }

    // get current and new data for comparisons
    Set $listbuild(currentname, currentphone, currentintdob) = currentdata
    Set currentlast = $piece(currentname, ",", 1),
      currentfirst = $piece(currentname, ",", 2)
    Set $listbuild(newname, newphone, newintdob) = newanswers
    Set newlast = $piece(newname, ",", 1), newfirst = $piece(newname, ",", 2)

    // update all globals inside a transaction
    // only update indices if the data was changed
    TStart
    Set ^PersonD(id) = newanswers
    If (newname'=currentname) {
      // kill old name and add new name to index
      Kill ^PersonI("Name", currentlast, currentfirst, id)
      Set ^PersonI("Name", newlast, newfirst, id) = ""
    }
    If (newphone'=currentphone) {
      // kill old phone and add new phone to index
      Kill ^PersonI("Phone", currentphone)
      Set ^PersonI("Phone", newphone) = id
    }
    If (newintdob'=currentintdob) {
      // kill old dob and add new dob to index
      Kill ^PersonI("DOB", currentintdob, id)
      Set ^PersonI("DOB", newintdob, id) = ""
    }
    TCommit  // commit the transaction
    Write "...updated."
  }
}
