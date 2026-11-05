ROUTINE CheckMac [Type=INC]
#define Twice(%x) (%x*2)
  #define   Sum3(%a,%b,%c) (%a+%b+%c)
#ifdef Twice
#define HasTwice 1
#else
#define HasTwice 0
#endif
#if 1
#define Mode "one"
#elseif 0
#define Mode "never"
#else
#define Mode "other"
#endif
#def1arg  List(%args) $lb(%args)
#define Long(%a,%b) $select(%a>%b:%a,1:%b) ##continue
 + 1
