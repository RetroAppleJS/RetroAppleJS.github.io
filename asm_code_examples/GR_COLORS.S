1 GR : HOME : PRINT :   FOR X = 4 TO 35 :     COLOR = C : H = C > 9 :     POKE 1616 + 128 * U + X, 176 + K * (C - 11 * H) + H :     VLIN 0,39 AT X : C = C + K : K = K = 0 : U = U = K :   NEXT 
