Include (%occStatus, CheckMac)

Class Check.Ops
{

ClassMethod Inc(ByRef x As %Integer)
{
	s x=x+1
}

ClassMethod Add(p As %Integer,q As %Integer) As %Integer
{
	q p+q
}

ClassMethod Run() As %Status
{
	s a=7,b=3,c=2
	w "arith:",a+b,",",a-b,",",a*b,",",a/b,",",a\b,",",a#b,",",a**b,",",a+b*c-1,!
	w "grouped:",(a+b)*(c-1),",",((a+b)*c)/(b-1),!
	w "unary:",-a+ +b,",",'(a<b),",",'a,!
	w "cmp:",(a=b),(a'=b),(a<b),(a<=b),(a>b),(a>=b),(a'<b),(a'>b),!
	w "logic:",(a&b),(a!b),(a&&b),(a||b),(a'&b),(a'!b),((a&&'b)||(b&&'a)),!
	s s="hello"
	w "str:",s_" "_a,",",(s["ell"),(s'["xyz"),(s]"abc"),(s']"abc"),(s]]"abc"),(s']]"abc"),!
	w "pat:",(s?5A),(s'?1N.E),!
	s arr(1)=10,arr(2,3)=20,^CheckOps(1)=5
	w "sub:",arr(a-6)+arr(1+1,b),",",^CheckOps(a-6)*2,!
	w "select:",$select(a>b:a+1,a<b:a-1,1:0),",",$case(c,1:"one",2:"two",:"other"),!
	w "call:",..Add(a+1,b*2)*2,",",$$$Twice(a+1),",",$$$Twice(a + 1),!
	s x=0
	d:x=0 ..Inc(.x)
	d:(x=1) ..Inc(.x)
	d:$length("a,b",",")=2 ..Inc(.x)
	d:($length("a,b",",")=2)&&(x>2) ..Inc(.x)
	w "post:",x,!
	f i=1:1:a-4 { w i," " }
	w !
	f i=a#3:b-1:a+b { w i," " }
	w !
	s firstOperandWithLongName=1,secondOperandWithLongName=2,thirdOperandWithLongName=3,fourthOperandWithLongName=4,fifth=5
	s long=(firstOperandWithLongName+secondOperandWithLongName*thirdOperandWithLongName-fourthOperandWithLongName+fifth)
	w "long:",long,!
	w "call2:",..Add((firstOperandWithLongName+secondOperandWithLongName)*thirdOperandWithLongName-fourthOperandWithLongName,fifth+a),!
	i a>b&&(b>c) { w "if1",! } elseif a=b { w "if2",! } else { w "if3",! }
	s cond=0
	i cond s firstLongVariableName=1,secondLongVariableName=2,thirdLongVariableName=3 w "legacy-if: wrong",!
	w "legacy-if:",$d(firstLongVariableName),!
	i a>b
	i  w "test:yes",!
	s n=0
	f  s n=n+1 q:n>2
	w "for:",n,!
	s:($piece("aa,bb,cc",",",2)=$piece("xx,bb,yy",",",2)) samePiece=1 w "postcond:",$g(samePiece),!
	s jarr=[1,(a+1),(b*2)],obj={"k":(a-1),"l":[(c*3)]}
	w "json:",jarr.%ToJSON(),obj.%ToJSON(),!
	#define Sum(%p,%q) (%p+%q)
	#def1arg Raw(%x) %x
	#if 1
	w "pp:",$$$Sum(a,b),",",$$$Raw(a,b),!
	#else
	w "pp: wrong",!
	#endif
	w "quit:",..EarlyQuit(1),..EarlyQuit(0),!
	s n=0
	d {
		s n=n+1
	} while /* both */ n<5,n<3
	w "dowhile:",n,!
	try {
		throw ##class(%Exception.General).%New("E")
	}
	// the error is caught below
	catch (ex) {
		w "catch:",ex.Name,!
	}
	s name="^CheckOps"
	w "indirect:",@name@(a-6)+1,!
	x ("(p) w ""xecute:"",p+1,!",a+1):a>0
	w "run:complete",!
	q $$$OK
}

ClassMethod EarlyQuit(x) As %String
{
	q:x=1 "one" // early return
	q "other"
}

}
