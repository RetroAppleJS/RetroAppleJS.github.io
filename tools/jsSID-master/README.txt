                               jsSID 0.9.1 ReadMe
 
Intro:
  Hi Folks, this is Hermit with a new JavaScript SID emulator and player called jsSID. 
 My main motivation to code jsSID was to enable visitors of my new webpage (hermit.sidrip.com) 
 play my SID tunes easily, directly in the web-browser, without needing SID-player, Flash/Java or other plugins.
 jsSID is based upon the Web Audio API which is supported by most major web-browsers by this time. (I tested it in Firefox33.) 
  More specifically, 'scriptNode' of the Web Audio API is utilized to generate the sample (e.g. 44.1kHz) beat,
 which in turn calls a totally custom play() routine internally. I didn't rely on other aspects
 of the Web Audio API except this simple 'play()' called by 'onaudioprocess' routine that generates the sound and 
 fills the audiobuffer with the data. Therefore if soon the web-browsers will change to the 'audioWorker'
 and make the 'scriptNode' obsolete, the change will be easy, just the audio setup and output stage needs modification.
 (Well, the situation is interesting, w3c tells scriptNode is obsolete, but the browsers haven't implemented
 the new 'audioWorker' yet...)
  There's another project called 'WebSID' which uses Web Audio API as well, though it's not coded in JavaScript but 
 ported from TinySID written in C. Therefore it's a bigger code, but it supports SIDs with SounDemon/Mahoney digis too...
 (For traditional SID tune quality/preciseness you can run my tester SIDs in 'soundtests' folder & playlist to compare SID engines...)

Usage:
  The usage, examples, tips can bee observed by opening 'index.html' in this folder.
 I also included a playlist-based 'player.html' example which you can use on your webpage to handle playback
 of a list of your SIDs with timeout and auto-advance feature. It needs a list of files in 'playlist.txt'.
 Playtime is taken from it if present, and must be given in 'mm:ss' format after the filename (minutes and seconds).
 (Default subtune can be selected with an additional (optional) ':st' field, so the format after filename seems like: 'mm:ss:st'...)
  The source code 'source/jsSID.js' works directly, but for webpages I advise the stripped versions. The 'sources/Makefile' script
 generates them, and you can decide what degree of compression you need. (Variables shortened, newlines/spaces eliminated, etc.)

Features of jsSID that I think need to be mentioned:
 -jsSID.js is very small in size (14kbyte), coded from scratch, so loading time on slow net-connections will still be adequate
 -Audio-frequency (mostly 44.1kHz) operation, not 1MHz, so the CPU usage is very low despite being written in JS
 -Clean sound, thin and high-pitched sounds are cleaned / band-limited algorithmically (e.g. Robocop3 title music intro)
 -ADSR delay-bug/wraparound is simulated, so the soundstarts of modern tunes in SIDs are crisp as on the original SID
 -6581 and 8580 model-changes are supported, they have different cutoff/resonance curves and combined waveforms
 -Combined waveforms are generated algorithmically, not read from low-resolution tables (first of its kind, based on SID schematic)
 -Background noise can be added to give a bit more analog feel (though it's just simple whiteniose yet, not VIC noise)
 -CPU emulation is cycle-based despite 44.1kHz operation (called more times appropriately during one sample-period)
 -Vsync- and CIA-timed single- and multispeed tunes are supported (though there are exceptions like digi tunes)
 -Illegal opcodes are supported by the CPU emulation to a degree (most LAX and SAX instructions, needed e.g. by 1raster-tracker)
 -Interfacing through easy-to-use function calls (load/start/stop/etc.), playing a SID is as simple as playSID('URL',subtune);
 -Callbacks can be set for various events, e.g. when a SID with given length ends (this eases auto-advance playback)
 -2nd and 3rd (2SID and 3SID) playback support

Not supported:
 -Digi playback is totally left off from jsSID, it's targeted for authentic clean SID sound instead
 -jsSID is not a real C64/SID environment, CIA and raster-interrupts are not emulated exactly, so some SIDs won't play:
  Digis won't play at all. Some older players with complex/unusual CIA-IRQ timing may have issues (e.g. Richard Joseph / Galway tunes.)

Outro:
  It took me around 2 weeks to code this tool, though getting quite some experiences from a SwinSID-variant development
 made the task much easier and faster. The sound-quality enhancement methods are essentially the same that I worked out
 for that SwinSID-variant (available very soon from CodeKiller). So jsSID sounds nearly the same as that new SwinSID-variant..
  More information can be found out from the comments in the 'source' folder in 'jsSID.js'...
 In case of unanswered question don't hesitate to ask me through the messagebox at my webpage or by PM at CSDB...
 Licenses? The license is the popular WTF license, so 'do what the fukk you want with this code'. :)
 I'd be grateful if my name/credits won't be removed from it, but otherwise feel free to use it as you wish.

Mihaly Horvath (Hermit)
2016, Hungary
http://hermit.sidrip.com
