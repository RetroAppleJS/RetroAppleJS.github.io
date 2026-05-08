/* Original authors: Peter Sovietov & Alexander Kovalenko */
//  AY-3-8910 and YM2149 Emulator

/*
 * Ayumi emulates one General Instrument AY-3-8910 / Yamaha YM2149
 * Programmable Sound Generator (PSG).
 *
 * Mockingboard orientation
 * ------------------------
 * A Mockingboard Sound II-style Apple II card contains two AY-3-8910 PSGs,
 * each driven through a 6522 VIA.  In other words, one Ayumi instance maps
 * to one AY chip, not to the whole Mockingboard.  A complete Mockingboard
 * emulator should normally own two Ayumi instances and route Apple II slot
 * I/O writes to the selected VIA/PSG pair.
 *
 * This file currently models the already-decoded PSG state: tone periods,
 * noise period, mixer enable bits, channel volumes, envelope period and
 * envelope shape.  It does not emulate the Apple II slot address space, the
 * 6522 VIA registers, or the AY bus-control handshake.  Those layers should
 * sit above this class.
 *
 * AY register map used by the public setters below
 * ------------------------------------------------
 * Register numbers here follow the common emulator / YM-file convention:
 * decimal array indices 0..13, written as R0..R13.  Original GI datasheets
 * sometimes label the same registers in octal-like notation: their R10/R11/R12
 * are this file's R8/R9/R10 amplitude registers, and their R13/R14/R15 are
 * this file's R11/R12/R13 envelope registers.
 *
 *   R0  channel A tone period, fine 8 bits
 *   R1  channel A tone period, coarse low 4 bits
 *   R2  channel B tone period, fine 8 bits
 *   R3  channel B tone period, coarse low 4 bits
 *   R4  channel C tone period, fine 8 bits
 *   R5  channel C tone period, coarse low 4 bits
 *   R6  noise period, low 5 bits
 *   R7  mixer / I/O enable
 *       bit 0: tone A disable, bit 1: tone B disable, bit 2: tone C disable
 *       bit 3: noise A disable, bit 4: noise B disable, bit 5: noise C disable
 *       bit 6/7: AY I/O port direction bits.  These are intentionally not
 *                modelled here because Mockingboard audio playback normally
 *                uses only the sound-generator part of the AY.
 *   R8  channel A amplitude: low 4 bits=fixed level, bit 4=use envelope
 *   R9  channel B amplitude: low 4 bits=fixed level, bit 4=use envelope
 *   R10 channel C amplitude: low 4 bits=fixed level, bit 4=use envelope
 *   R11 envelope period, fine 8 bits
 *   R12 envelope period, coarse 8 bits
 *   R13 envelope shape, low 4 bits: Continue, Attack, Alternate, Hold
 *   R14/R15 AY I/O port data.  Not emulated by Ayumi.
 *
 * Typical register-write decoding, as used by MockingboardJS.html:
 *
 *   setTone(0, (R1 << 8) | R0);
 *   setTone(1, (R3 << 8) | R2);
 *   setTone(2, (R5 << 8) | R4);
 *   setNoise(R6);
 *   setMixer(0, R7 & 1,       (R7 >> 3) & 1, R8  >> 4);
 *   setMixer(1, (R7 >> 1)&1,  (R7 >> 4) & 1, R9  >> 4);
 *   setMixer(2, (R7 >> 2)&1,  (R7 >> 5) & 1, R10 >> 4);
 *   setVolume(0, R8  & 0x0f);
 *   setVolume(1, R9  & 0x0f);
 *   setVolume(2, R10 & 0x0f);
 *   setEnvelope((R12 << 8) | R11);
 *   setEnvelopeShape(R13);
 *
 * Audio-generation pipeline
 * -------------------------
 * process() advances the chip model and produces one stereo output sample in
 * this.left / this.right.  The caller should usually call process(), then
 * removeDC(), then copy the two output values into the Web Audio buffer.
 */

// Ayumi oversamples the internal PSG state and then decimates it to the
// requested Web Audio sample rate.  DECIMATE_FACTOR controls that final
// downsampling stage.
const DECIMATE_FACTOR = 8;

// Number of taps in the finite impulse response low-pass filter used by
// decimate().  The large coefficient table in decimate() is the filter body.
const FIR_SIZE = 192;

// Moving-average window used to remove DC offset from the generated audio.
// Must remain a power of two because removeDC() advances dcIndex with a bitmask.
const DC_FILTER_SIZE = 1024;

// Normalized DAC output table for the original AY-3-8910 amplitude ladder.
// There are 32 entries because fixed volumes use odd entries (level*2+1),
// while the envelope generator can address the whole 0..31 range.
// Consecutive AY entries are duplicated because the original AY has 16
// effective amplitude levels.
const AY_DAC_TABLE = [
  0.0, 0.0,
  0.00999465934234, 0.00999465934234,
  0.0144502937362, 0.0144502937362,
  0.0210574502174, 0.0210574502174,
  0.0307011520562, 0.0307011520562,
  0.0455481803616, 0.0455481803616,
  0.0644998855573, 0.0644998855573,
  0.107362478065, 0.107362478065,
  0.126588845655, 0.126588845655,
  0.20498970016, 0.20498970016,
  0.292210269322, 0.292210269322,
  0.372838941024, 0.372838941024,
  0.492530708782, 0.492530708782,
  0.635324635691, 0.635324635691,
  0.805584802014, 0.805584802014,
  1.0, 1.0
]

// Normalized DAC output table for the Yamaha YM2149.  The YM envelope has
// finer amplitude resolution than the AY, so the 32 entries are not duplicated.
const YM_DAC_TABLE = [
  0.0, 0.0,
  0.00465400167849, 0.00772106507973,
  0.0109559777218, 0.0139620050355,
  0.0169985503929, 0.0200198367285,
  0.024368657969, 0.029694056611,
  0.0350652323186, 0.0403906309606,
  0.0485389486534, 0.0583352407111,
  0.0680552376593, 0.0777752346075,
  0.0925154497597, 0.111085679408,
  0.129747463188, 0.148485542077,
  0.17666895552, 0.211551079576,
  0.246387426566, 0.281101701381,
  0.333730067903, 0.400427252613,
  0.467383840696, 0.53443198291,
  0.635172045472, 0.75800717174,
  0.879926756695, 1.0
]


/*
 * Constructor for one PSG.  For a Mockingboard with two sound chips, create
 * two instances, e.g. leftChip = new Ayumi(); rightChip = new Ayumi();
 */
Ayumi = function() 
{

  // Three tone channels, conventionally called A, B and C in AY literature.
  this.channels = this.getChannels();

  // Shared pseudo-random noise generator.  R6 controls noisePeriod.
  this.noisePeriod = 0;
  this.noiseCounter = 0;
  this.noise = 0;

  // Shared envelope generator.  R11/R12 control envelopePeriod; R13
  // controls envelopeShape.  Channels opt into this generator through bit 4
  // of their amplitude register (R8/R9/R10).
  this.envelopes = this.getEnvelopeShapes();
  this.envelopeCounter = 0;
  this.envelopePeriod = 0;
  this.envelopeShape = 0;
  this.envelopeSegment = 0;
  this.envelope = 0;

  // Selected analog amplitude curve.  configure(isYM, ...) chooses AY or YM.
  this.dacTable = YM_DAC_TABLE;

  // Fractional advancement of the PSG clock per oversampled output point.
  // configure() computes step from the chip clock and requested sample rate.
  this.step = 0.0;
  this.x = 0.0;

  // Last generated stereo sample, after panning and master volume scaling.
  this.left = 0.0;
  this.right = 0.0;
  this.mastervolume = 1.0;

  // Quadratic interpolation history used between discrete PSG state updates.
  this.interpolatorLeft = {
   c: new Float64Array(4),
   y: new Float64Array(4)
  }
  this.interpolatorRight = {
   c: new Float64Array(4),
   y: new Float64Array(4)
  }

  // DC-removal state for the left and right channels.
  this.dcFilterLeft = {
   sum: 0.0,
   delay: new Float64Array(DC_FILTER_SIZE)
  }
  this.dcFilterRight = {
   sum: 0.0,
   delay: new Float64Array(DC_FILTER_SIZE)
  }
  this.dcIndex = 0;

  // FIR ring buffers used by decimate().
  this.firLeft = new Float64Array(FIR_SIZE * 2);
  this.firRight = new Float64Array(FIR_SIZE * 2);
  this.firIndex = 0;
}

/*
 * Per-channel state for one AY tone channel.
 *
 * tonePeriod is the 12-bit value from R0/R1, R2/R3 or R4/R5.
 * toneCounter advances until tonePeriod is reached, then tone toggles.
 *
 * tOff and nOff mirror the inverted enable bits in R7:
 *   0 = source is enabled and participates in the AND mixer
 *   1 = source is forced on, effectively disabling that source's gating
 *
 * eOn mirrors bit 4 of R8/R9/R10:
 *   0 = use fixed 4-bit volume
 *   1 = use the shared envelope output instead of fixed volume
 */
Ayumi.prototype.Channel = function() {
  return {
      toneCounter: 0, tonePeriod: 0, tone: 0,
      tOff: 0, nOff: 0, eOn: 0,
      volume: 0,
      panLeft: 1.0, panRight: 1.0
  };
}

// Allocate the three AY tone channels A, B and C.
Ayumi.prototype.getChannels = function() {
  return [
    new this.Channel,
    new this.Channel,
    new this.Channel
  ];
}

/*
 * Convert the 4-bit envelope shape register (R13) into two segment functions.
 *
 * R13 bit layout is: bit 3 Continue, bit 2 Attack, bit 1 Alternate, bit 0 Hold.
 * The array index is the raw shape nibble 0..15.  Each entry contains the
 * operation for segment 0 and segment 1.  slideDown/slideUp move the 5-bit
 * internal envelope value through 31..0 or 0..31; holdBottom/holdTop leave it
 * fixed after a terminal segment.
 *
 * Useful shapes:
 *   0..3  one descending ramp, then hold at 0
 *   4..7  one ascending ramp, then hold at 0
 *   8     repeating descending sawtooth
 *   9     descending ramp, then hold at 0
 *   10    repeating triangle: down, up, down, up ...
 *   11    descending ramp, then hold at 31
 *   12    repeating ascending sawtooth
 *   13    ascending ramp, then hold at 31
 *   14    repeating triangle: up, down, up, down ...
 *   15    ascending ramp, then hold at 0
 */
Ayumi.prototype.getEnvelopeShapes = function() {
  return [
    [ this.slideDown, this.holdBottom ],
    [ this.slideDown, this.holdBottom ],
    [ this.slideDown, this.holdBottom ],
    [ this.slideDown, this.holdBottom ],

    [ this.slideUp, this.holdBottom ],
    [ this.slideUp, this.holdBottom ],
    [ this.slideUp, this.holdBottom ],
    [ this.slideUp, this.holdBottom ],

    [ this.slideDown, this.slideDown ],
    [ this.slideDown, this.holdBottom ],
    [ this.slideDown, this.slideUp ],
    [ this.slideDown, this.holdTop ],

    [ this.slideUp, this.slideUp ],
    [ this.slideUp, this.holdTop ],
    [ this.slideUp, this.slideDown ],
    [ this.slideUp, this.holdBottom ]
  ]
};

/*
 * Advance one tone generator by one internal PSG tick.
 *
 * The AY tone generator is a divider.  When the counter reaches the programmed
 * period, the square-wave output toggles.  setTone() normalizes period 0 to 1
 * so the counter always has a usable divisor.
 */
Ayumi.prototype.updateTone = function(index) {
  var ch = this.channels[index];
  if(++ch.toneCounter >= ch.tonePeriod) {
    ch.toneCounter = 0;
    ch.tone ^= 1;
  }
  return ch.tone;
}

/*
 * Advance the shared noise generator.
 *
 * The AY has one pseudo-random noise source shared by all three channels.
 * R7 decides which channels receive the noise gate.  This implementation uses
 * a 17-bit linear feedback shift register and advances it according to R6.
 */
Ayumi.prototype.updateNoise = function() {
  if(++this.noiseCounter >= (this.noisePeriod << 1)) {
    this.noiseCounter = 0;
    var bit0x3 = (this.noise ^ (this.noise >> 3)) & 1;
    this.noise = (this.noise >> 1) | (bit0x3 << 16);
  }
  return this.noise & 1;
}

// Envelope segment: increase the internal envelope level until it overflows.
Ayumi.prototype.slideUp = function(e) {
  if(++e.envelope > 31) {
    e.envelopeSegment ^= 1;
    e.resetSegment();
  }
}

// Envelope segment: decrease the internal envelope level until it underflows.
Ayumi.prototype.slideDown = function(e) {
  if(--e.envelope < 0) {
    e.envelopeSegment ^= 1;
    e.resetSegment();
  }
}

// Envelope segment: keep the output at the maximum envelope level.
Ayumi.prototype.holdTop = function(e) {};

// Envelope segment: keep the output at the minimum envelope level.
Ayumi.prototype.holdBottom = function(e) {};

/*
 * Start the currently selected envelope segment at the correct endpoint.
 * A downward slide or a top hold starts at 31; an upward slide or bottom hold
 * starts at 0.
 */
Ayumi.prototype.resetSegment = function() {
  var env = this.envelopes[this.envelopeShape][this.envelopeSegment];
  this.envelope = (env == this.slideDown || env == this.holdTop) ? 31 : 0;
}

/*
 * Advance the shared envelope generator by one internal PSG tick.
 * The envelope output is a 5-bit value 0..31, which indexes the DAC table
 * directly when a channel's eOn flag is set.
 */
Ayumi.prototype.updateEnvelope = function() {
  if(++this.envelopeCounter >= this.envelopePeriod) {
    this.envelopeCounter = 0;
    this.envelopes[this.envelopeShape][this.envelopeSegment](this);
  }
  return this.envelope;
}

/*
 * Combine the three tone channels, the shared noise source and the shared
 * envelope generator into a raw stereo sample.
 *
 * The AY mixer is easiest to read if you remember that the mixer register bits
 * are disable bits, not enable bits.  A disabled tone/noise source is treated
 * as a constant 1 in the boolean mixer; an enabled source contributes its
 * actual square/noise output.  Tone and noise are then ANDed together.
 *
 * For each channel:
 *   gate = (tone | toneDisable) & (noise | noiseDisable)
 *   levelIndex = envelope if envelope mode is on, else fixedVolume*2+1
 *   output = DAC[gate * levelIndex]
 */
Ayumi.prototype.updateMixer = function() {
  var out;
  var noise = this.updateNoise();
  var envelope = this.updateEnvelope();
  this.left = 0;
  this.right = 0;
  for(var i = 0; i < this.channels.length; i++) {
    out = (this.updateTone(i) | this.channels[i].tOff) &
      (noise | this.channels[i].nOff);
    out *= this.channels[i].eOn ? envelope : this.channels[i].volume * 2 + 1;
    this.left += this.dacTable[out] * this.channels[i].panLeft;
    this.right += this.dacTable[out] * this.channels[i].panRight;
  }
}

// FVD 14-01-2024
// Convenience function used by the demo page.  This is not a hardware AY
// operation.  A future Mockingboard wrapper will probably want to stop the
// Web Audio node, mute both chips, or reset the emulated 6522/PSG state
// explicitly rather than configuring with zero clock/sample rate.
Ayumi.prototype.stop = function()
{
  this.configure(true,0,0);
}

/*
 * Configure the chip model before rendering audio.
 *
 * isYM      true  => use the YM2149 DAC table
 *           false => use the AY-3-8910 DAC table
 * clockRate PSG master clock in Hz.  The player reads this from the YM/FYM
 *           file header; a Mockingboard wrapper should use the Apple II card's
 *           PSG clock value.
 * sr        output sample rate in Hz, normally audioContext.sampleRate.
 */
Ayumi.prototype.configure = function(isYM, clockRate, sr) {
  this.step = clockRate / (sr * 8 * DECIMATE_FACTOR);
  this.dacTable = isYM ? YM_DAC_TABLE : AY_DAC_TABLE;
  this.noise = 1;
  this.setEnvelope(1);
  for(var i = 0; i < this.channels.length; i++) {
    this.setTone(i, 1);
  }
}

/*
 * Set stereo panning for one channel.
 *
 * index  0=A, 1=B, 2=C
 * pan    0.0=left, 0.5=center, 1.0=right
 * isEqp  non-zero => equal-power panning; zero => linear panning
 *
 * The physical AY has separate analog outputs for A/B/C; panning here is a
 * renderer convenience.  A Mockingboard wrapper can choose channel panning to
 * approximate the board's two output channels.
 */
Ayumi.prototype.setPan = function(index, pan, isEqp) {
  if(isEqp) {
    this.channels[index].panLeft = Math.sqrt(1 - pan);
    this.channels[index].panRight = Math.sqrt(pan);
  } else {
    this.channels[index].panLeft = 1 - pan;
    this.channels[index].panRight = pan;
  }
}

/*
 * Program one channel's 12-bit tone period from the AY tone registers.
 *
 * index  0=A from R0/R1, 1=B from R2/R3, 2=C from R4/R5
 * period 12-bit divider value: ((coarse & 0x0f) << 8) | fine
 *
 * Register write mapping:
 *   A: setTone(0, (R1 << 8) | R0)
 *   B: setTone(1, (R3 << 8) | R2)
 *   C: setTone(2, (R5 << 8) | R4)
 *
 * Hardware treats a period of 0 as the smallest divider; this code stores 1
 * for that case.
 */
Ayumi.prototype.setTone = function(index, period) {
  period &= 0xfff;
  this.channels[index].tonePeriod = (period == 0) | period;
}

/*
 * Program the shared 5-bit noise period from R6.
 * Only the low five bits are meaningful on the AY.
 */
Ayumi.prototype.setNoise = function(period) {
  this.noisePeriod = period & 0x1f;
}

/*
 * Program per-channel mixer flags decoded from R7 and R8/R9/R10.
 *
 * index 0=A, 1=B, 2=C
 * tOff tone disable bit for this channel from R7 bit 0/1/2
 * nOff noise disable bit for this channel from R7 bit 3/4/5
 * eOn  envelope-mode bit from this channel's amplitude register bit 4
 *
 * Note the naming: tOff/nOff are inverted hardware bits.  0 means the source
 * is enabled; 1 means the source is disabled.
 */
Ayumi.prototype.setMixer = function(index, tOff, nOff, eOn) {
  this.channels[index].tOff = tOff & 1;
  this.channels[index].nOff = nOff & 1;
  this.channels[index].eOn = eOn & 1;
}

/*
 * Renderer-level master volume.
 *
 * The demo passes a value in the range 0..255.  Values below 0 and above 255
 * are clamped; internally the gain is normalized to 0.0..1.0.  This is not an
 * AY register.
 */
Ayumi.prototype.setMasterVolume = function(volume)
{
    this.mastervolume = volume>1?1:(volume<0)?0:volume/0xff;
}

/*
 * Program the fixed amplitude nibble for one channel.
 *
 * index  0=A from R8, 1=B from R9, 2=C from R10
 * volume low 4 bits of the corresponding amplitude register.
 *
 * The envelope-enable bit is not handled here; it is decoded in setMixer()
 * as eOn because updateMixer() needs both fixed volume and envelope mode.
 */
Ayumi.prototype.setVolume = function(index, volume) {
  this.channels[index].volume = volume & 0x0f;
}

/*
 * Program the 16-bit shared envelope period from R11/R12.
 *
 * Register write mapping:
 *   setEnvelope((R12 << 8) | R11)
 *
 * Hardware treats period 0 as the smallest divider; this code stores 1 for
 * that case.
 */
Ayumi.prototype.setEnvelope = function(period) 
{
  period &= 0xffff;
  this.envelopePeriod = (period == 0) | period;
}

/*
 * Program the 4-bit envelope shape from R13.
 *
 * Shape bits: bit 3 Continue, bit 2 Attack, bit 1 Alternate, bit 0 Hold.
 * Writing R13 restarts the envelope cycle, so this method clears the counter
 * and starts from segment 0.
 */
Ayumi.prototype.setEnvelopeShape = function(shape) 
{
  this.envelopeShape = shape & 0x0f;
  this.envelopeCounter = 0;
  this.envelopeSegment = 0;
  this.resetSegment();
}

/*
 * FIR low-pass decimator.
 *
 * process() writes DECIMATE_FACTOR interpolated samples into a FIR ring buffer.
 * This function convolves that buffer with the precomputed 192-tap low-pass
 * filter and returns one output-rate sample.  The large coefficient list below
 * is intentionally kept inline for speed and to match the original Ayumi code.
 */
Ayumi.prototype.decimate = function(x) 
{
  var y = -0.0000046183113992051936 * (x[1] + x[191]) +
    -0.00001117761640887225 * (x[2] + x[190]) +
    -0.000018610264502005432 * (x[3] + x[189]) +
    -0.000025134586135631012 * (x[4] + x[188]) +
    -0.000028494281690666197 * (x[5] + x[187]) +
    -0.000026396828793275159 * (x[6] + x[186]) +
    -0.000017094212558802156 * (x[7] + x[185]) +
    0.000023798193576966866 * (x[9] + x[183]) +
    0.000051281160242202183 * (x[10] + x[182]) +
    0.00007762197826243427 * (x[11] + x[181]) +
    0.000096759426664120416 * (x[12] + x[180]) +
    0.00010240229300393402 * (x[13] + x[179]) +
    0.000089344614218077106 * (x[14] + x[178]) +
    0.000054875700118949183 * (x[15] + x[177]) +
    -0.000069839082210680165 * (x[17] + x[175]) +
    -0.0001447966132360757 * (x[18] + x[174]) +
    -0.00021158452917708308 * (x[19] + x[173]) +
    -0.00025535069106550544 * (x[20] + x[172]) +
    -0.00026228714374322104 * (x[21] + x[171]) +
    -0.00022258805927027799 * (x[22] + x[170]) +
    -0.00013323230495695704 * (x[23] + x[169]) +
    0.00016182578767055206 * (x[25] + x[167]) +
    0.00032846175385096581 * (x[26] + x[166]) +
    0.00047045611576184863 * (x[27] + x[165]) +
    0.00055713851457530944 * (x[28] + x[164]) +
    0.00056212565121518726 * (x[29] + x[163]) +
    0.00046901918553962478 * (x[30] + x[162]) +
    0.00027624866838952986 * (x[31] + x[161]) +
    -0.00032564179486838622 * (x[33] + x[159]) +
    -0.00065182310286710388 * (x[34] + x[158]) +
    -0.00092127787309319298 * (x[35] + x[157]) +
    -0.0010772534348943575 * (x[36] + x[156]) +
    -0.0010737727700273478 * (x[37] + x[155]) +
    -0.00088556645390392634 * (x[38] + x[154]) +
    -0.00051581896090765534 * (x[39] + x[153]) +
    0.00059548767193795277 * (x[41] + x[151]) +
    0.0011803558710661009 * (x[42] + x[150]) +
    0.0016527320270369871 * (x[43] + x[149]) +
    0.0019152679330965555 * (x[44] + x[148]) +
    0.0018927324805381538 * (x[45] + x[147]) +
    0.0015481870327877937 * (x[46] + x[146]) +
    0.00089470695834941306 * (x[47] + x[145]) +
    -0.0010178225878206125 * (x[49] + x[143]) +
    -0.0020037400552054292 * (x[50] + x[142]) +
    -0.0027874356824117317 * (x[51] + x[141]) +
    -0.003210329988021943 * (x[52] + x[140]) +
    -0.0031540624117984395 * (x[53] + x[139]) +
    -0.0025657163651900345 * (x[54] + x[138]) +
    -0.0014750752642111449 * (x[55] + x[137]) +
    0.0016624165446378462 * (x[57] + x[135]) +
    0.0032591192839069179 * (x[58] + x[134]) +
    0.0045165685815867747 * (x[59] + x[133]) +
    0.0051838984346123896 * (x[60] + x[132]) +
    0.0050774264697459933 * (x[61] + x[131]) +
    0.0041192521414141585 * (x[62] + x[130]) +
    0.0023628575417966491 * (x[63] + x[129]) +
    -0.0026543507866759182 * (x[65] + x[127]) +
    -0.0051990251084333425 * (x[66] + x[126]) +
    -0.0072020238234656924 * (x[67] + x[125]) +
    -0.0082672928192007358 * (x[68] + x[124]) +
    -0.0081033739572956287 * (x[69] + x[123]) +
    -0.006583111539570221 * (x[70] + x[122]) +
    -0.0037839040415292386 * (x[71] + x[121]) +
    0.0042781252851152507 * (x[73] + x[119]) +
    0.0084176358598320178 * (x[74] + x[118]) +
    0.01172566057463055 * (x[75] + x[117]) +
    0.013550476647788672 * (x[76] + x[116]) +
    0.013388189369997496 * (x[77] + x[115]) +
    0.010979501242341259 * (x[78] + x[114]) +
    0.006381274941685413 * (x[79] + x[113]) +
    -0.007421229604153888 * (x[81] + x[111]) +
    -0.01486456304340213 * (x[82] + x[110]) +
    -0.021143584622178104 * (x[83] + x[109]) +
    -0.02504275058758609 * (x[84] + x[108]) +
    -0.025473530942547201 * (x[85] + x[107]) +
    -0.021627310017882196 * (x[86] + x[106]) +
    -0.013104323383225543 * (x[87] + x[105]) +
    0.017065133989980476 * (x[89] + x[103]) +
    0.036978919264451952 * (x[90] + x[102]) +
    0.05823318062093958 * (x[91] + x[101]) +
    0.079072012081405949 * (x[92] + x[100]) +
    0.097675998716952317 * (x[93] + x[99]) +
    0.11236045936950932 * (x[94] + x[98]) +
    0.12176343577287731 * (x[95] + x[97]) +
    0.125 * x[96];
  for(var i = 0; i < DECIMATE_FACTOR; i++) {
    x[FIR_SIZE - DECIMATE_FACTOR + i] = x[i];
  }
  return y * this.mastervolume;
}

/*
 * Render one stereo sample.
 *
 * Public rendering contract:
 *   ayumi.process();
 *   ayumi.removeDC();
 *   leftBuffer[i] = ayumi.left;
 *   rightBuffer[i] = ayumi.right;
 *
 * Internally, this function advances the PSG at the configured chip clock,
 * interpolates between raw mixer states, and decimates the oversampled signal
 * to the requested audio sample rate.
 */
Ayumi.prototype.process = function() {
  var y1;

  var cLeft = this.interpolatorLeft.c;
  var yLeft = this.interpolatorLeft.y;

  var cRight = this.interpolatorRight.c;
  var yRight = this.interpolatorRight.y;

  var firOffset = FIR_SIZE - this.firIndex * DECIMATE_FACTOR;
  var firLeft = this.firLeft.subarray(firOffset);
  var firRight = this.firRight.subarray(firOffset);

  this.firIndex = (this.firIndex + 1) % (FIR_SIZE / DECIMATE_FACTOR - 1);

  for(var i = DECIMATE_FACTOR - 1; i >= 0; i--) {
    this.x += this.step;
    if(this.x >= 1) {
      this.x--;
      yLeft[0] = yLeft[1];
      yLeft[1] = yLeft[2];
      yLeft[2] = yLeft[3];

      yRight[0] = yRight[1];
      yRight[1] = yRight[2];
      yRight[2] = yRight[3];

      this.updateMixer();

      yLeft[3] = this.left;
      yRight[3] = this.right;

      y1 = yLeft[2] - yLeft[0];
      cLeft[0] = 0.5  * yLeft[1]    + 0.25 * (yLeft[0]  + yLeft[2]);
      cLeft[1] = 0.5  * y1;
      cLeft[2] = 0.25 * (yLeft[3]   - yLeft[1] - y1);

      y1 = yRight[2] - yRight[0];
      cRight[0] = 0.5  * yRight[1]  + 0.25 * (yRight[0] + yRight[2]);
      cRight[1] = 0.5  * y1;
      cRight[2] = 0.25 * (yRight[3] - yRight[1] - y1);
    }
    firLeft[i] = (cLeft[2] * this.x + cLeft[1]) * this.x + cLeft[0];
    firRight[i] = (cRight[2] * this.x + cRight[1]) * this.x + cRight[0];
  }

  this.left = this.decimate(firLeft);
  this.right = this.decimate(firRight);
}

// One step of the moving-average DC-removal filter.
Ayumi.prototype.dcFilter = function(dc, index, x) {
  dc.sum += -dc.delay[index] + x;
  dc.delay[index] = x;
  return x - dc.sum / DC_FILTER_SIZE;
}

/*
 * Remove DC offset from the last generated stereo sample.
 * Call this after process() and before writing this.left/this.right to the
 * Web Audio output buffers.
 */
Ayumi.prototype.removeDC = function() {
  this.left = this.dcFilter(this.dcFilterLeft, this.dcIndex, this.left);
  this.right = this.dcFilter(this.dcFilterRight, this.dcIndex, this.right);
  this.dcIndex = (this.dcIndex + 1) & (DC_FILTER_SIZE - 1);
}
