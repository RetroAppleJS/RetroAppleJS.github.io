## TOOLS Explained

In the [tools folder](../tools), we keep a collection of helpers to simulate, better understand or automate processes supporting the development of the IDE.  Every tool is designed to run in the browser, just like the IDE, using HTML/CSS/JavaScript.  Discover here the entire [TOOLS CATALOG](https://retroapplejs.github.io/tools/TOOLS_CATALOG.html).

### ConfigFile_updater.html

Check documentation here : [CONFIG.md](CONFIG.md)

### Monitor_palette.html

<img src="../res/palette.png" width=30% align=left />Color graphics on the Apple II rendered only 4 distinct colors in high-resolution (green, orange, violet, blue) as a result of a cheap but smart piece of discrete logic.  Surely, owners of monochrome green or amber monitors sometimes longed for some color, but the blurry and color-bleeding TV screen rendering was more like a gimmick compared to the razor-sharp image produced by a genuine monochrome apple monitor.

The emulator's display offers an easy switching capability to render color, black&white, green and amber as some graphics really look nicer in color or monochrome.  e.g. fonts rendered on a hires screen produce very disturbing color fringing artifacts, which make the letters unreadable in color mode; any monochrome setting is more appropriate in this case. 

This tool was made to test and assure the best image rendering approximation with these respective monitors.
It produces a Javascript snippet that seamlessly maps the Apple II colors to the different monochrome versions.  This snippet is located in [EMU_apple2video.js](..f/res/EMU_apple2video.js).


### HGRpatternJS.html

<img src="../res/HGRpatternJS.png" align=left width=40% style="padding:10px 10px 10px 10px"/>[This tool](https://retroapplejs.github.io/tools/HGRpatternJS.html) is designed to find a color encoding strategy to tackle the typical challenges with Apple II HGR graphics. 

Major challenges to picture quality are:

* extreme color limitations (4 true colors + black and white)
* a high-bit color switch ruling over an entire byte
* convolutional color encoding
* low pixel resolution (at today's standards)

Classic dithering algorithms as we know, simply can't cope well with all the weird stuff that happens on pixel level in an Apple II.  Trying dissociate a **color-encoding layer** and a **pattern encoding  layer** is challenging, both are seriously messed-up.  Most dithering patterns become colors, and generic color dithering algorithms can't handle anamorphous color pallettes.  While  black-and-White dithering can be achieved by means of a simple trick, **any color dithering algorithm known so far, regular or error-diffusion-based, need to be re-invented**.

Please check this [small app](https://retroapplejs.github.io/tools/HGRpatternJS.html), especially designed to examine achievable colors for regular dithering by generating any imaginable bit pattern. Small patches or blocks of pixels, will reveal interesting features in both layers.  Since the color encoding layer has a size of 2x1 bits (wxh), in a full resolution of 280x192, e.g. rendering 4 colors + black and white brings us already down to a color resolution of only 140x192.

Block size 2x2 bits
<img src="../res/pattern_block_2x2.png" width=20% align=left />

Block size 4x2 bits
<img src="../res/pattern_block_4x2.png" width=20% align=left />

The pattern encoding layer can only bare multiples of the color encoding block size, bringing us to a minimal size of 2x2 bits (wxh), and the next being 4x2 bits (wxh).  In the next figure, we identify color encoding conflicts.

Color conflics at block size 2x2 bits
<img src="../res/pattern_block_conflicts_2x2.png" width=20% align=left />

Color conflics at block size 4x2 bits
<img src="../res/pattern_block_conflicts_4x2.png" width=20% align=left />

Note the high-bit on the right side, turned on or off generates different color conflicts.  According to classic dithering practice, these conflicts should be resolved by any means to keep a minimal color deviation.

The amount of combinations one can get is quite decent, but this testing tool proves that some bit pattern combinations render exactly the same average color.  In theory, these repetitions could be removed, but we have to check other aspects before doing so.  In practice, we have to deal with color encoding conflics that can occur on byte-level.  We still have 7 visible bits per byte ammended by one inivisible high-bit.  Situations where a high-bit selector should be =1 in the lower nibble and =0 for the higher nibble, these can be resolved by picking an alternate dithering pattern in the lower nibble or the higher nibble to resolve the conflict.  We can additionally reduce the statistical chance for such conflicts by chosing for the larger block size.

In our conclusion, we are putting together color resolution, color conflict sensitivity and color range :
* color block size 2x1 bits (wxh)
   * color resolution = 140x96
   * no color conflics - by ruling out conflictual pattern blocks
   * bit combinations = 2 ^ (2 visible bits + 1 high bit) = 8
   * net usable color range - 4 distinct colors + black and white
* pattern block size 2x2 bits (wxh)
   * color resolution = 140x96
   * 3 possible high-bit color conflicts between pattern blocks in the same byte
   * statistical chance for color conflics = (5/7-2/7)/2 = 0.714 - 0.286 / 2 = 21 %
   * bit combinations = 2 ^ (4 visible bits + 2 high bits) = 64
   * net usable color range - 19 distinct colors + black and white
* pattern block size 4x2 bits (wxh)
   * color resolution = 70x96
   * 1 possible high-bit color conflict between pattern blocks in the same byte
   * statistical chance for color conflics = (3/7-4/7)/2 = 0.429 - 0.571 / 2 = 14 %
   * bit combinations = 2 ^ (8 visible bits + 2 high biths) = 1024
   * net usable color range - ? distinct colors + black and white
* mixed mode block size 2x2 and 4x4 bits (wxh)
   * average color resolution = 105x95
   * 3 possible high-bit color conflicts between pattern blocks in the same byte
   * statistical change for color conflicts = (21%+14%)/2 = 17.5%
   * bit combinations = 2 ^ (8 vsible bits + 2 high bits) = 1024
   * net usable color range - ? distinct colors + black and white

#### Pattern selector

Patterns are generated by two formulas, the first reporting true (bit=1) or false (bit=0) on the visible bits 0-7 and another formula reporting 0 or 127 for the invisible bit 7.  The pattern selector has a double function: selected patterns can be edited and loaded into the first bitmap grid (left pane) and by means of the Generate_HGR button also visualised in the first location of the pattern grid (right pane).

| bit7 | bit6 | bit5 | bit4 | bit3 | bit2 | bit1 | bit0 |
|:----:|:----:|:----:|:----:|:---:|:---:|:---:|----:|
| high bit | even | odd | even | odd | even | odd | even |


#### Color gamut


* switch: 0 selects a pallette of green and violet, and 1 selects a pallet of orange and blue for all 7 visible pixels in bits 0-6
* convolutional logic

| <<left | even bit | right>> | | <<left | odd bit | right>> |
|:----:|:----:|:----:|:----:|:----:|:----:|:----:|
| 1 | 0 | 1 || 1 | 0 | 1 |
|   | 0 |  || 1 | 0 | 1 |

### ConverHGR.html

<img src="../res/HGR_Venus.png" align=left width=30% />This handy tool converts the most common image file types to an Apple II HGR color bitmaps.  Dithering achieves a way to convert images from high color-depths to lower depths, but Apple II graphics require a special twist to gracefully overcome inherent 'Wozniackian' artifacts explained in *PatternHGR.html*.   Buttons and tuning sliders will help you model the most acceptable conversion.  For developers, the challenge will be to optimize conversion quality and speed, as this very algorithm will serve inside the webcam capture tool.

TODO: flow diagram



### Camera_capture.html

<img src='data:image/png;base64,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' align=left width=30% />
THIS IS A TEST

### DiskJS.html

<img src="../res/apple-disk-ii_256.png" align=left width=30% />The emulator natively works with __.nib formatted disk images__.  Therefore, it can read .nib files from your local hard drive to the emulator's memory and download .nib files raw from memory.   The emulator also accepts loading .dsk image files, but it always does that by converting from .dsk format to .nib before storing the image in memory.
This tool does the same thing, plus some extra functions like making a full hex dump and displaying a (16x35) heat map laying out 16 columns (sectors) and 35 rows (tracks).

### SIDchipJS.html

<img src="../res/SID_chips.png" align=left width=30% />While emulating AppleII sound is not working out, let's put to work a crazy idea of emulating a C64-style SID chip that could bring us closer to emulating a peripheral that actually did exist for the Apple II: the [Mockingboard](https://en.wikipedia.org/wiki/Mockingboard) sound card. The Mochinboard used the AY-3-8910, a 3-voice sound chip found in the popular MSX, and later ZX Spectrum home computers.  As we speak, I am evaluating [a closer match to emulating the AY-3-8910 with JavaScript](https://github.com/alexanderk23/ayumi-js), as this could bring us to real software and a few games on the Apple II that made full use of the mockingboards capabilities.

---

## GUI MODULES Explained

Similar to the tool catalog demonstrating particular emulator functions, the GUI modules focus on the development of GUI components like tabs, memory maps, visual keyboard. Discover here the entire [GUI CATALOG](https://retroapplejs.github.io/tools/GUI_CATALOG.html).

### FontJS.html

Pictograms from Fontawesome are widely used in this project to generate all sorts of buttons.
Not all codes generate visible pictograms, therefore this tool to see which are usable and which are not.  

### Tab_ctrl_v*.html

This is a fully client-side tab controller that remembers the last clicked tab after a page reload, based on the URI fragment identifier.  e.g. www.example.com/index.html#tab1
Subsequent versions of this tab control show increasingly interesting capabilities and design options.

|         | pop-out<br>menu | sub-<br>menu | anima-<br>tion |
|:-------:|:------------:|:---------:|:-------------:|
| v0      | -            | -         | -            |
| v1      | YES          | -         | -            |
| v2      | YES          | YES       | -            |
| v3      | -            |           | YES          |

