## The Apple II screen

<img src="../res/appleII_title.png?raw=true" width=40% align="left"/> 

Steve Wozniak's chip-saving design requires quite some technical knowledge to accurately produce video emulation. This involves mapping memory locations to physical coordinates on the screen, reading fonts from character ROM in text mode, working with LORES, HIRES, and mixed modes.  You need to understand artifact color conventions, and the inner workings of the video scanner, which is a DMA device that uses timing to drive video data out of RAM and sends them to the video generator. In screen emulation technology, there are two major solution options: one based on the CPU of the host and another based on GPU.

The video scanner operates similarly to a television scan. Due to different TV standards between Europe and America, NTSC models had a master clock tuned at 14.31818Mhz and PAL around 14.238Mhz, which was then exposed to the CPU after division by a factor of 14, resulting in approximately 1MHz. 

The *horizontal scanning* counter consists of 65 states, 1 state lasting approximately 1µs, with 40 states allocated for display and 25 states called 'horizontal blank'. So far accurately documented, we can estimate that the beam journey travels across the left (blank) border traversing 5 states, then utilizing 40 states (or columns) for reading video memory and display at a rate of one CPU cycle per TEXT/LORES column or 7 HIRES pixels. The display area is followed by another 5 blank states across the right border to reach the right end, after which the remaining 15 blank states are left to retrace or clear the beam to the left end, where the following line starts. 

The *vertical scanning* counter in NTSC/PAL configuration consist respectively of 262/312 states.  Only 192 states are allocated for display, while again respectively in NTSC/PAL configuration the remaining 70/120 states are reserved for vertical blanking including the top margin, bottom margin and retrace back to the top of the screen.  Again so far accurately documented, we can only roughly estimate that the beam takes 24/49 states to travel across the top (blank) margin, then utilizing 192 states displaying stuff, reaching to the bottom margin taking another 24/49 states, and when finally engaging the beam into the retrace maneuver to the top, taking the remaining 22 states. 

*So, why do we need to know this to build an emulator?

All Apple IIs were designed with a data bus driver that alternated CPU and VIDEO to access main memory.  These bus drivers came with adapted transistor circuitry to cope with electric field effects (e.g. capacitance) typically found on larger motherboards.  These effects, however unsupported by Apple, enabled a few helpful hacks that are fun to emulate.  One of these hacks is the *vapour lock*, allowing the detection of the video beam position without additional hardware or modification, allowing flicker-free gameplay and mixed-mode graphic effects once thought unimaginable.


    <div style=width:800px>

    HORIZONTAL SCANNING                            65 bus cyles (~µs) = traversing 1 horizonal line
                                     │◄───────────────────────────────────────────────────────────►│  
                                     │ 5µs :             40µs               : 5µs :      15µs      │ 
                                     │◄───►:◄──────────────────────────────►:◄───►:◄──────────────►│
                                     │     ┌────────────────────────────────┐     :                │
    PAL & NTSC display               │left │           display              │right:     beam       │
    scan line                       ───────┘            area                └───────────────────────
                                     margin:                                :margin    retrace
                                           ┌┬┬┬┬┬┬┬┬┬┬┬┬┬┬┬┬┬┬┬┬┬┬┬┬┬┬┬┬┬┬┬┬┐
                                           ││││││││││││││││││││││││││││││││││  
    Direct Memory Access to RAM     ───────┘      latch-in display data     └─────────────────────────
                                             (40 bytes = TEXT/LORES columns)
                                      ┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐       ┐
    Apple II bus at 1MHz            ──┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└...    ├>  SYSTEM
                                                                                                   ┘   CLOCK


    VERTICAL  SCANNING                            17030 bus cycles (~µs) = traversing 1 screen height
                                     │◄───────────────────────────────────────────────────────────►│  
                                     │1560µs:          12480µs               :1560µs:      1430µs  │ 
                                     │◄────►:◄──────────────────────────────►:◄────►:◄────────────►│
                                     │      ┌────────────────────────────────┐      :              │
    NTSC display                     │ top  │           display              │bottom:     beam     │
    scan line                       ────────┘            area                └───────────────────────
                                     margin                                   margin    retrace

    </div>

