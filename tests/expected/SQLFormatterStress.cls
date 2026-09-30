Class ObjectScript.SQLFormatterStress {
  ClassMethod QueryPeople(minAge As %Integer = 18) As %Status {
    #dim name As %String
    #dim age As %Integer
    &sql(
      DECLARE C1 CURSOR FOR
       SELECT Name,Age
       FROM Sample.Person
       WHERE Age >= :minAge
       ORDER BY Name
    )
    &sql(OPEN C1)
    Set sc = $$$OK
    For {
      &sql(FETCH C1 INTO :name,:age)
      Quit:SQLCODE'=0
      Write !, name, " (", age, ")"
    }
    &sql(CLOSE C1)
    Quit sc
  }
}
