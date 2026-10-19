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
	q $$$OK
}

}
