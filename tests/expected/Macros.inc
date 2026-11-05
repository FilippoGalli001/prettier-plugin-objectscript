ROUTINE Macros [Type=INC]
  ; Macros shared by the regression fixtures.
#;  A comment that is not copied into the compiled code.

#Define Twice(%x) (%x*2)
#Def1Arg Join(%args) $lb(%args)
#Define Version "2.0"
#Define Long(%a,%b) $select(%a>%b:%a,1:%b) ##continue
                   + 0

#IfDef Version
#Define HasVersion 1
#Else
#Define HasVersion 0
#EndIf
#If $$$HasVersion
#Define Label "versioned"
#ElseIf 0
#Define Label "never"
#Else
#Define Label "plain"
#EndIf
#IfNDef Debug
#Define Trace(%m)
#EndIf
#Include %occStatus
#if 1
 s x=1
#endif
 w "code in an include file",!
Tag q
