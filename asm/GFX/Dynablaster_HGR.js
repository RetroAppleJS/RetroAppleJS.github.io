/*
 * Dynablaster — 14 × 14 byte-aligned HGR playfield and 20 sprites
 * Paste the entire file into tools/HGR_SCRIPT_STUDIO.html and press Run.
 *
 * Apple II HGR:         280 × 192 pixels
 * Tile dimensions:       14 × 14 pixels = two 7-pixel HGR bytes per scanline
 * Playfield:             15 columns × 13 rows = 210 × 182 pixels
 * Playfield origin:      x=35, y=10
 * Black top margin:      scanlines 0..9 (10 pixels)
 * Playfield bottom:      scanline 191
 * All sprite positions:  x=35+14×column, y=10+14×row
 *
 * Native sprite codes: 0=off/phase0, 1=on/phase0,
 *                      2=off/phase1, 3=on/phase1, .=transparent.
 * Re-cropped from the original RGB sheet to fill all 14 sprite rows.
 * RGB colors remain approximate owing to Apple II artifact constraints.
 */
'use strict';

const CFG = Object.freeze({
  tile: 14,
  tileHeight: 14,
  columns: 15,
  rows: 13,
  left: 35,
  top: 10,
  showByteGrid: false,
  showBricks: false,   // Set true to enable the original sample brick positions.
  showSprites: true    // Set false to preview the empty playfield instead.
});

function atTile(col, row) {
  if (!Number.isInteger(col) || col < 0 || col >= CFG.columns ||
      !Number.isInteger(row) || row < 0 || row >= CFG.rows)
    throw new RangeError('Tile coordinates must be col=0..14 and row=0..12');
  return {
    x: CFG.left + col * CFG.tile,
    y: CFG.top + row * CFG.tileHeight
  };
}

function filled(x, y, w, h, color) {
  if (w > 0 && h > 0) hgr.rect(x, y, w, h, color, true);
}

function stroke(x1, y1, x2, y2, color) {
  hgr.line(x1, y1, x2, y2, color);
}

function drawPlayfieldGrass() {
  const x = CFG.left, y = CFG.top;
  const width = CFG.columns * CFG.tile;           // 210
  const height = CFG.rows * CFG.tileHeight;       // 182

  // Interior is 13 columns × 11 rows, with grass as its base layer.
  filled(x + CFG.tile, y + CFG.tileHeight,
         width - 2 * CFG.tile, height - 2 * CFG.tileHeight,
         'green');

  // 35-pixel (five-byte) orange strips on either side, starting below
  // the ten-pixel black margin and extending through scanline 191.
  filled(0, y, x, height, 'orange');
  filled(x + width, y, 280 - (x + width), height, 'orange');
}

function drawPerimeterStone(col, row) {
  const {x, y} = atTile(col, row);

  // 12 × 12 blue stone inside a 14 × 14 black-gutter cell.
  filled(x + 1, y + 1, 12, 12, 'blue');
  stroke(x + 2, y + 2, x + 11, y + 2, 'white1');
}

function drawTile(col, row) {
  const {x, y} = atTile(col, row);

  // Stationary island: 12 × 7 white slab and 12 × 7 checker area.
  // Leave the two rightmost pixels as grass (as in the source layout).
  filled(x, y, 12, 7, 'white0');
  for (let dy = 0; dy < 7; dy++) {
    for (let dx = 0; dx < 12; dx++) {
      // Alternating grass opening on the first two columns.
      if ((dy & 1) && dx < 2) continue;
      const color = (((dx >> 1) ^ dy) & 1) ? 'black0' : 'white0';
      hgr.pixel(x + dx, y + 7 + dy, color);
    }
  }
}

function drawBrick(col, row) {
  const {x, y} = atTile(col, row);
  filled(x, y, CFG.tile, CFG.tileHeight, 'orange');
}

function drawIslands() {
  // 6 columns (2,4,...12) × 5 rows (2,4,...10) = 30 islands.
  for (let row = 2; row < CFG.rows - 1; row += 2)
    for (let col = 2; col < CFG.columns - 1; col += 2)
      drawTile(col, row);
}

function drawSampleBricks() {
  // Original brick examples; disabled unless CFG.showBricks is true.
  for (const [col, row] of [
    [5, 1], [7, 1], [7, 2],
    [5, 3], [6, 3], [7, 3]
  ]) drawBrick(col, row);
}

function drawBytes() {
  // Optional byte ticks at the top of the field. The y=0..9 band
  // stays black even with CFG.showByteGrid enabled.
  for (let x = 0; x < 280; x += 7)
    stroke(x, CFG.top, x, CFG.top + 2, 'white0');
}

function drawBackground() {
  hgr.clear('black0');
  drawPlayfieldGrass();

  // Perimeter: 15 stones at top/bottom, 13 on left/right.
  for (let row = 0; row < CFG.rows; row++) {
    for (let col = 0; col < CFG.columns; col++) {
      if (col === 0 || col === CFG.columns - 1 ||
          row === 0 || row === CFG.rows - 1)
        drawPerimeterStone(col, row);
    }
  }

  drawIslands();
  if (CFG.showBricks) drawSampleBricks();
  if (CFG.showByteGrid) drawBytes();
}

// -------------------------------------------------------------
// All 20 sprites re-cropped and re-scaled to fill their 14 × 14 cells.
// -------------------------------------------------------------

// Re-cropped from the ORIGINAL 21 x 24 source frames, not stretched from
// the previously encoded (already reduced) 14 x 14 HGR sprites.
// The full non-background bounding rectangle is scaled to 14 x 14.
// Every sprite touches the top and bottom of its 14-row cell.
// The two 7-pixel halves each use one consistent Apple II HGR phase.
// Note: native HGR cannot reproduce the source RGB colors exactly.
const DYNABLASTER_SPRITES_14x14 = [
  [ // Sprite 01

    /*
    ".....0000.....",
    "..0111111110..",
    "..1111111111..",
    "..3332300111..",
    "..3332300111..",
    "..3332323233..",
    "..3222200001..",
    ".232232323232.",
    "22222230000000",
    "23232323232232",
    "..2232223232..",
    "..2232223232..",
    ".000000000000.",
    "...00000000...",
    */

  "10111111111010",
  "33333331111110",
  "33332232233332",
  "33332232233332",
  "33323232323332",
  "10000000000000",
  "32322222223232",
  "32332323233232",
  "22322232322222",
  "22322323232232",
  "10000000000000",
  "10010100010100",
  "10000000000000",
  "10100000000010"


  ],
  [ 
    
    // Sprite 02
/*    
    "....00000.....",
    "..1111111101..",
    ".01111111101..",
    ".23232301110..",
    ".23232301110..",
    ".23232301110..",
    ".000000222322.",
    "22322323223222",
    "23222232222232",
    "22323323232.2.",
    "..323222322...",
    ".00000000000..",
    "000000023222..",
    "..00000000....",
*/

    "10111111111010",
    "33333331111110",
    "33332232233332",
    "33332232233332",
    ".23232301110..",
    ".23232301110..",
    ".000000222322.",
    "22322323223222",
    "23222232222232",
    "22323323232.2.",
    "..323222322...",
    ".00000000000..",
    "000000023222..",
    "..00000000....",

  ],
  [ // Sprite 03
    /*
    ".....00000....",
    "..3233311111..",
    "..32333111110.",
    "..23323232232.",
    "..23323232232.",
    "..01111232322.",
    ".232222000000.",
    "22322323223222",
    "01000002322232",
    ".0.01113232232",
    "...232323232..",
    "..00000000000.",
    "..223230000000",
    "....00000000..",
    */

  "01011111111010",
  "11011111111110",
  "33323222322332",
  "33323222322332",
  "33323232323332",
  "10011112323222",
  "32322220000000",
  "22322323223222",
  "01000002322232",
  "10101113232232",
  "32323232323232",
  "10000000010000",
  "10010100000000",
  "10100000000010"



  ],
  [ // Sprite 04
    ".0...00000....",
    "010001111111..",
    ".0.011111111..",
    "...0111111010.",
    "...0111111010.",
    "...0011332322.",
    ".....0023222..",
    ".....3223223..",
    ".....0000001..",
    ".....3223223..",
    ".....232322...",
    "...0000232222.",
    "..000000000000",
    ".....0000000..",
  ],
  [ // Sprite 05
    ".0..000000....",
    "010111111110..",
    ".01111111110..",
    "..3332322232..",
    "..3332322232..",
    "..1111123232..",
    "..0000032232..",
    "..3223223223..",
    ".00000023222..",
    ".22223200000..",
    "..223232223232",
    "..32222000010.",
    ".001000000000.",
    "...00000000...",
  ],
  [ // Sprite 06
    ".0...0000.....",
    "010011111110..",
    ".00011111111..",
    "..0111111101..",
    "..0111111101..",
    "..0011133232..",
    "....2232222232",
    "...22232233232",
    "...2322222322.",
    "....00032322..",
    "...2322232322.",
    "..0000022232..",
    "..00000000000.",
    "....0000000...",
  ],
  [ // Sprite 07
    "....00000...0.",
    "..111113322232",
    "..111111110.0.",
    ".2323231110...",
    ".2323231110...",
    ".2323331100...",
    "..2222300.....",
    "..2322300.....",
    "..3222200.....",
    "..2322300.....",
    "...232300.....",
    ".2223230000...",
    "000000000000..",
    "..0000000.....",
  ],
  [ // Sprite 08
    ".....0000...0.",
    "..011113332232",
    "..11111111000.",
    "..3233311110..",
    "..3233311110..",
    "..3233311100..",
    "2322223232....",
    "23233232322...",
    ".2223220010...",
    "..23232322....",
    ".2223220010...",
    "..3222200000..",
    ".00000000000..",
    "...0000000....",
  ],
  [ // Sprite 09
    "....000000..0.",
    "..011113333232",
    "..01111111110.",
    "..2232301111..",
    "..2232301111..",
    "..3232301111..",
    "..3222300000..",
    "..3232322323..",
    "..22323000000.",
    "..23222323222.",
    "223232223232..",
    ".23222200001..",
    ".000000222322.",
    "...00000000...",
  ],
  [ // Sprite 10
    ".....0000.....",
    "..0111010110..",
    "..1111101111..",
    "..1111111111..",
    "..1111111111..",
    "..1111111111..",
    "..3222200001..",
    ".232332323232.",
    "01000002222232",
    "22222323232222",
    "..22322232322.",
    "..2232223232..",
    ".000000000000.",
    "...00000000...",
  ],
  [ // Sprite 11
    "....000000....",
    "...232211111..",
    "..00001111110.",
    "..01111111110.",
    "..01111111110.",
    "..01111111110.",
    ".232222000000.",
    "22322323232222",
    "01000002222232",
    ".2.22323232232",
    "...232322232..",
    "..00000000000.",
    "..000002223222",
    "....00000000..",
  ],
  [ // Sprite 12
    "....000000....",
    "..111112322...",
    ".01111110000..",
    ".01111111110..",
    ".01111111110..",
    ".01111111110..",
    ".000000222322.",
    "22232323223222",
    "01000002222232",
    "23232323222.2.",
    "..323222322...",
    ".00000000000..",
    "223232200000..",
    "..00000000....",
  ],
  [ // Sprite 13
    ".....0000.....",
    "...01111110...",
    "..0111111100..",
    "..0111023222..",
    "..0111023222..",
    "..2332301110..",
    "..3222222232..",
    ".23233.323223.",
    "22322230000100",
    "01001113232232",
    ".101110323323.",
    ".000000000000.",
    ".000000000000.",
    "....000000....",
  ],
  [ // Sprite 14
    ".....0000.....",
    "...01111110...",
    "...11111110...",
    "...11100111...",
    "00011100111000",
    "23233232333232",
    ".232222222323.",
    ".23222.322322.",
    "...22230000...",
    "...01113232...",
    "...32323223...",
    "..0100022232..",
    "..0000000000..",
    "....000000....",
  ],
  [ // Sprite 15
    ".....0000.....",
    "...01111110...",
    "...11111111...",
    "...11100111...",
    "...11100111...",
    "...33230111...",
    ".232222222322.",
    ".232232323223.",
    "23222232222232",
    ".222232323222.",
    "22322323232322",
    ".222232322222.",
    "..0000000000..",
    "....000000....",
  ],
  [ // Sprite 16
    ".....0000.....",
    "...01111110...",
    "...33230111...",
    "...33230011...",
    "...11000011...",
    "...22323222...",
    ".232232223232.",
    "223232..232322",
    ".223222323222.",
    ".223232223232.",
    "..23232323222.",
    "..2223232222..",
    "..2232222232..",
    "....000000....",
  ],
  [ // Sprite 17
    "....000000....",
    "...01111110...",
    "..2332301110..",
    ".222232323222.",
    "22232322232322",
    ".2232322232322",
    ".22322..22232.",
    ".3232.23.2232.",
    ".32322..23232.",
    ".323232232232.",
    "23232323232322",
    ".223232323222.",
    ".222232323222.",
    "....000000....",
  ],
  [ // Sprite 18
    "....000000....",
    "...0......0...",
    "..0.000000.0..",
    ".223232223222.",
    "222322..232322",
    "222322..232322",
    ".32........00.",
    ".32........00.",
    ".322.2..2.232.",
    ".322232232223.",
    "22232323232322",
    "23232323232232",
    ".222232323222.",
    "....000000....",
  ],
  [ // Sprite 19
    "....000000....",
    "...32223232...",
    ".2232.22.3222.",
    ".1000....2223.",
    ".00........32.",
    "2322......2322",
    "23232....22322",
    ".32........32.",
    ".32........32.",
    ".00........32.",
    ".000.0..2.232.",
    ".323232232323.",
    ".223232323222.",
    ".....0000.....",
  ],
  [ // Sprite 20
    ".....0000.....",
    "...22323222...",
    ".223222223222.",
    ".10........23.",
    ".0..........0.",
    "232........000",
    "00..........00",
    ".32........00.",
    "..............",
    ".00........00.",
    ".000......232.",
    ".100000222223.",
    ".223232223222.",
    ".....0000.....",
  ],
];

// -------------------------------------------------------------
// Tile-snapped sprite placement
// -------------------------------------------------------------

function drawDynablasterSprite(id, x, y) {
  if (!Number.isInteger(id) || id < 1 ||
      id > DYNABLASTER_SPRITES_14x14.length)
    throw new RangeError('Sprite id must be 1..20');

  if (!Number.isInteger(x) || x < CFG.left ||
      x + CFG.tile > CFG.left + CFG.columns * CFG.tile ||
      (x - CFG.left) % CFG.tile !== 0)
    throw new RangeError('Sprite x must equal 35 + 14*col, col=0..14');

  if (!Number.isInteger(y) || y < CFG.top ||
      y + CFG.tileHeight > CFG.top + CFG.rows * CFG.tileHeight ||
      (y - CFG.top) % CFG.tileHeight !== 0)
    throw new RangeError('Sprite y must equal 10 + 14*row, row=0..12');

  hgr.drawSprite(DYNABLASTER_SPRITES_14x14[id - 1], x, y);
}

function drawDynablasterSpriteAtTile(id, col, row) {
  const {x, y} = atTile(col, row);
  drawDynablasterSprite(id, x, y);
}

function previewDynablasterSprites() {
  // 5 columns × 4 rows: each sprite occupies one entire 14 × 14 cell.
  // All preview positions are on grass, avoiding the even/even islands.
  // X = 49,91,133,175,217 (tile columns 1,4,7,10,13).
  // Y = 24,52,80,108      (tile rows    1,3,5,7).
  const spriteColumns = [1, 4, 7, 10, 13];
  const spriteRows = [1, 3, 5, 7];

  for (let id = 1; id <= DYNABLASTER_SPRITES_14x14.length; id++) {
    const col = spriteColumns[(id - 1) % spriteColumns.length];
    const row = spriteRows[Math.floor((id - 1) / spriteColumns.length)];
    drawDynablasterSpriteAtTile(id, col, row);
  }
}

function validateSpriteData() {
  if (DYNABLASTER_SPRITES_14x14.length !== 20)
    throw new Error('Exactly 20 sprites are required');

  for (let i = 0; i < DYNABLASTER_SPRITES_14x14.length; i++) {
    const sprite = DYNABLASTER_SPRITES_14x14[i];
    if (sprite.length !== 14 ||
        !sprite.every(row => typeof row === 'string' &&
          row.length === 14 && /^[0123.]{14}$/.test(row)))
      throw new Error(`Sprite ${i + 1} must contain 14 rows of 14 pixels`);

    // Regression checks for tight cropping: no completely empty edge.
    if (!/[0123]/.test(sprite[0]) || !/[0123]/.test(sprite[13]) ||
        !sprite.some(row => row[0] !== '.') ||
        !sprite.some(row => row[13] !== '.'))
      throw new Error(`Sprite ${i + 1} has an unused outer row/column`);

    // Exactly one shared HGR phase for each seven-pixel half-byte.
    for (const scanline of sprite) {
      for (const start of [0, 7]) {
        const phases = new Set(scanline.slice(start, start + 7)
          .replace(/\./g, '').split('')
          .map(value => Number(value) >> 1));
        if (phases.size > 1)
          throw new Error(`Sprite ${i + 1} has mixed phases in one HGR byte`);
      }
    }
  }
}

// Run once. Do not clear the screen again before drawing sprites.
hgr.setPattern('solid');
validateSpriteData();
drawBackground();
if (CFG.showSprites) previewDynablasterSprites();

print('Dynablaster: 15×13 tiles of 14×14 pixels; x=35, y=10; ' +
      '30 islands; 20 grid-aligned sprites.');
// HGR sprite: 0/1 = phase 0 (off/on), 2/3 = phase 1 (off/on); . = transparent
const sprite1 = [
  "1011111111010",
  "1111111111111",
  "1111001223333",
  "1111001223333",
  "3332323232333",
  "1000000000101",
  "1000000222322",
  "2232232322322",
  "2322223222223",
  "2232332323222",
  "3232322232223",
  "1000000000001",
  "0000000232223",
  "1000000000101"
];
hgr.drawSprite(sprite1, 91, 24); // Use true as 4th argument for transparent black

// HGR sprite: 0/1 = phase 0 (off/on), 2/3 = phase 1 (off/on); . = transparent
const sprite2 = [
  "01011111111010",
  "01111111111111",
  "01111001223333",
  "01111001223333",
  "03332323232333",
  "01000000000101",
  "01000000222322",
  "02232232322322",
  "02322223222223",
  "02232332323222",
  "03232322232223",
  "01000000000001",
  "00000000232223",
  "01000000000101"
];
hgr.drawSprite(sprite2, 90, 24); // Use true as 4th argument for transparent black

// HGR sprite: 0/1 = phase 0 (off/on), 2/3 = phase 1 (off/on); . = transparent
const sprite3 = [
  "10111111110100",
  "11111111111110",
  "11110012233332",
  "11110012233332",
  "33323232323332",
  "10000000001010",
  "10000002223222",
  "22322323223222",
  "23222232222232",
  "22323323232222",
  "32323222322232",
  "10000000000010",
  "00000002322232",
  "10000000001010"
];
hgr.drawSprite(sprite3, 91, 24); // Use true as 4th argument for transparent black

// HGR sprite: 0/1 = phase 0 (off/on), 2/3 = phase 1 (off/on); . = transparent
const sprite4 = [
  "10111111110100",
  "11111111110110",
  "33223222323332",
  "33223222323332",
  "33323232323332",
  "10000000001010",
  "10000000000010",
  "22332323223222",
  "23222232222232",
  "22323323232222",
  "32323222322232",
  "10010000000010",
  "00000001010010",
  "10000000001010"
];
hgr.drawSprite(sprite4, 91, 24); // Use true as 4th argument for transparent black

