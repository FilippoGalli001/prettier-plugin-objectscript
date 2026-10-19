Class Demo.Greeter Extends %RegisteredObject {
Property Name As %String [Required];

/// Returns a greeting for the given name.
ClassMethod Greet(name As %String="world",times As %Integer=1) As %String [ Private ]
{
 s result=""
 f i=1:1:times {
 s result=result_"Hello, "_name_"! "
 }
 q:name="" "nobody"
 i times>1 { w "Greeted ",times," times",! }
 q result
}
}
