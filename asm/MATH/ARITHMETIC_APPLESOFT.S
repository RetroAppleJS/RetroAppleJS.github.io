*=$6000
STROUT  = $DB3A       ; Print string pointed to by Y,A. The string must end with a zero or a quote.
L1NPRT  = $ED24       ; Prints the 2 byte unsigned number in X,A.
PRNTFAC = $ED2E       ; Prints the current value of FAC. FAC is destroyed.
