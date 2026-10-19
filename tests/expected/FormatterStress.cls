Class ObjectScript.FormatterStress Extends %Persistent
{
  /// Deliberately messy class used to stress the formatter
  Parameter Version = "1.0";
  Property Name As %String [Required];
  Property Tags As %DynamicArray;
  Index NameIndex On Name [Unique];

  ClassMethod Transform(value As %String = "") As %String [Private]
  {
    Set result = $zconvert(value, "T")
    Quit result
  }

  ClassMethod Run(verbose As %Boolean = 1) As %Status
  {
    #dim error As %Exception.SystemException
    Set sc = $$$OK, payload = {"name": "ada", "active": 1, "scores": [1, 2, 3]}
    Set payload.meta = {"source": "stress", "version": "1.0"}
    Try {
      For i = 1:1:3 {
        Do payload.scores.%Push(i * 10)
      }
      If verbose {
        Write !, "Name: ", payload.name, !
      } ElseIf payload.name = "" {
        Set sc = $$$ERROR($$$GeneralError, "Missing name")
      } Else {
        Set payload.name = ..Transform(payload.name)
      }
    } Catch error {
      Set sc = error.AsStatus()
    }
    Quit sc
  }
}
