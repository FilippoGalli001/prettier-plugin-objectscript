ROUTINE Macros [Type=INC]
  ; Macros shared by the regression fixtures.
#;  A comment that is not copied into the compiled code.

#define Twice(%x) (%x*2)
#def1arg Join(%args) $lb(%args)
  #define Version "2.0"
#define Long(%a,%b) $select(%a>%b:%a,1:%b) ##continue
                   + 0


#ifdef Version
#define HasVersion 1
#else
#define HasVersion 0
#endif
#if $$$HasVersion
#define Label "versioned"
#elseif 0
#define Label "never"
#else
#define Label "plain"
#endif
#ifndef Debug
#define Trace(%m)
#endif
#include %occStatus
#if 1
 s x=1
#endif
 w "code in an include file",!
Tag q
