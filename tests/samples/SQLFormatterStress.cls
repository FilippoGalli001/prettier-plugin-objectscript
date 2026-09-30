Class ObjectScript.SQLFormatterStress
{
ClassMethod QueryPeople(minAge As %Integer = 18) As %Status
{
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
 s sc=$$$OK
 f {
  &sql(FETCH C1 INTO :name,:age)
  q:SQLCODE'=0
  w !,name," (",age,")"
 }
 &sql(CLOSE C1)
 q sc
}
}
