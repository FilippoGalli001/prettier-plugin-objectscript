Class ObjectScript.Operators
{

ClassMethod Arithmetic(a As %Integer, b As %Integer) As %Integer
{
	Set sum=a+b
	Set diff=a-b
	Set prod=a*b
	Set quot=a/b
	Set idiv=a\b
	Set mod=a#b
	Set pow=a**b
	Set chain=a+b*c-d
	Set grouped=(a+b)*(c-d)
	Set nested=((a+b)*c)/(d-e)
	Set neg=-a+ +b
	Quit sum
}

ClassMethod Comparison(a As %Integer, b As %Integer) As %Boolean
{
	Set eq=(a=b)
	Set ne=(a'=b)
	Set lt=(a<b)
	Set le=(a<=b)
	Set gt=(a>b)
	Set ge=(a>=b)
	Set nlt=(a'<b)
	Set ngt=(a'>b)
	Quit eq
}

ClassMethod Logic(a As %Boolean, b As %Boolean) As %Boolean
{
	Set and=a&b
	Set or=a!b
	Set sand=a&&b
	Set sor=a||b
	Set nand=a'&b
	Set nor=a'!b
	Set mixed=(a&&'b)||(b&&'a)
	Quit and
}

ClassMethod Strings(s As %String) As %String
{
	Set cat="a"_s_"c"
	Set contains=(s["x")
	Set notContains=(s'["x")
	Set follows=(s]"x")
	Set notFollows=(s']"x")
	Set sorts=(s]]"x")
	Set notSorts=(s']]"x")
	Set pat=(s?3N1"-"4N)
	Set notPat=(s'?1A.E)
	Quit cat
}

ClassMethod Contexts(x As %Integer) As %Status
{
	If x>0&&x<10 {
		Write x+1,!
	} ElseIf (x'=0)||(x=-1) {
		Write x*2
	}
	While x>0 {
		Set x=x-1
	}
	For i=1:1:x+1 {
		Write i
	}
	Do:x>3 ..Other(x+1,x*2)
	Quit:x=0 $$$OK
	Set r=$Select(x>0:x+1,x<0:x-1,1:0)
	Set s=$Piece("a,b",",",x+1)
	Set t=..Other(x+1,x*2)+1
	Set u=^Data(x+1)+$Length("abc")
	Set v=$$$MAC(x+1)*2
	Set w=##class(A.B).Run(x+1)*2
	Quit $$$OK
}

ClassMethod Operands(x As %Integer) As %Status
{
	Set a=x(i+1,j*2)+^Data(x+1,"a")+^|"ns"|Glob(i*2)+^["sys"]G(j+1)
	Set b=$Select(x>0:x+1,x<0:x-1,1:0)
	Set c=$Case(x,1:"a",2:"b",:"c")
	Set d='(x<y)+-(a*b)
	Set e=$$Func^Rtn(x+1,y*2)*2+$$Local(y*2)
	Set f=$Order(^Data(x+1))+$ListGet(list,i+1)
	Set g=$$$MAC(x+1,y*2)*2
	Set $Piece(h,",",x+1)=y*2
	Kill ^Data(x+1)
	Merge ^Copy(x+1)=^Data(y*2)
	Do:(x>0)&&(y<3) ..Other($Length(a,","),x+1)
	Quit:($Extract(a,1,$Length(b))'=b)||(x=0) $$$OK
	Quit:($Extract(a,1,$Length(b))'=b) $$$OK
	Quit:$Length(a,",")>1 $$$OK
	Quit $$$OK
}

}
