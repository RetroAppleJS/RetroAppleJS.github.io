;----- NEXT OBJECT FILE NAME IS VAPORLOCK

ORG $8AFF   ; FOR HIGH HRCG CHARACTER SET

; *****************************************
; *                                       *
; *           - < VAPORLOCK > -           *
; *                                       *
; *      (FAST AND EXACT FIELD SYNC)      *
; *                                       *
; *      VERSION 1.0 ($8AFF-$8BC7)        *
; *   for the APPLE II+ and APPLE Ile     *
; *                                       *
; *              10-12-83                 *
; *.......................................*
; *                                       *
; *          COPYRIGHT C 1983 BY          *
; *                                       *
; *     DON LANCASTER AND SYNERGETICS     *
; *     BOX 1300, THATCHER AZ., 85552     *
; *            (602) 428-4073             *
; *                                       *
; * ALL COMMERCIAL RIGHTS RESERVED        *
; *****************************************

;           *** WHAT IT DOES***
; This subroutine gives you a fast and exact field
; sync that locks to the video screen in as few as
; nine scan lines. No hardware mods are needed.

; The same code works on the Apple II+ or Ile.

; The vaporlock, with suitable support software,
; lets you mix and match HIRES, LORES, and text
; anywhere on the screen, provides for glitchless
; animation, simplifies light pens, allows grey
; scale, text-over-color, professional video wipes,
; and offers many other new visual display tricks
; that seem •impossible• to do on a stock Apple.

; Typical displays are totally free from any
; glitches or jitter.

;            *** HOW TO USE IT ***
; To lock to the video timing, do a JSR VAPORLK at
; $8B00 or CALL 35840.

; The vaporlock exits exactly and precisely on the
; start of a new video field.


;             *** GOTCHAS ***
; This code only runs on "real" Apples.
; Franklins, clones, and look-alikes may have different timing that requires special code.
; Certain oddball plug-in cards might interfere with operation on the II+. Such interference is unlikley on the Ile.
; Parts of the code have very critical timing and must not cross a page boundary. If you relocate the code, put it all on one page.
;             *** ENHANCEMENTS ***
; You can make a '"phasing" adjustment by adding
; or removing NOPs and branches in the PHASE code. code. Note that a NOP or a branch not taken uses two clock ; cycles, while a branch taken needs three.
; You can preset the soft switches at the top of the screen with suitable pokes to SHOW.
; VAPORLK object code is relocatable, if you put
; it all on one page of memory. Be sure to protect
; memory and link to your first or second address.


;           *** RANDOM COMMENTS ***
; The accumulator and all flags are saved to the stack. No use is made of the X or Y registers.
; The vaporlock exact field sync may be used in your commercial programs provided fair credit is prominently given.
; VAPORLK may be loaded as the highest HRCG character set.

; Program length is $CS (200) bytes.