Class ObjectScript.FormatterStress Extends %Persistent
{
/// Deliberately messy class used to stress the formatter
Parameter Version="1.0";
Property Name As %String [ Required ];
Property Tags As %DynamicArray;
Index NameIndex On Name [ Unique ];

ClassMethod Transform(value As %String = "") As %String [ Private ]
{
 s result=$zconvert(value,"T")
 q result
}

ClassMethod Run(verbose As %Boolean = 1) As %Status
{
 #dim error As %Exception.SystemException
 s sc=$$$OK,payload={"name":"ada","active":1,"scores":[1,2,3]}
 s payload.meta={"source":"stress","version":"1.0"}
 try {
  f i=1:1:3 {
   d payload.scores.%Push(i*10)
  }
  i verbose {
   w !,"Name: ",payload.name,!
  } elseif payload.name="" {
   s sc=$$$ERROR($$$GeneralError,"Missing name")
  } else {
   s payload.name=..Transform(payload.name)
  }
 } catch error {
  s sc=error.AsStatus()
 }
 q sc
}
}
