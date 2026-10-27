/*
 * Dynablaster — byte-aligned Apple II HGR tile layout
 * Paste into tools/HGR_SCRIPT_STUDIO.html and press Run.
 *
 * 15 columns x 14 HGR pixels = 210 pixels = 30 HGR bytes.
 * Centered horizontally: X=35..244 (five HGR bytes on either side).
 * 13 rows x 13 pixels = 169 pixels, Y=20..188.
 */
'use strict';

const CFG = {
  tile: 14, tileHeight: 13,
  columns: 15, rows: 13,
  left: (280 - 15 * 14) / 2, // 35, divisible by 7
  top: 20,
  showByteGrid: false
};

function atTile(col, row) {
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
  const x = CFG.left;
  const y = CFG.top;
  const w = CFG.columns * CFG.tile;        // 210 pixels
  const h = CFG.rows * CFG.tileHeight;     // 169 pixels

  // Inner field: exactly 13 x 11 grid cells, without overlaps or gaps.
  filled(x + CFG.tile, y + CFG.tileHeight,
         w - 2 * CFG.tile, h - 2 * CFG.tileHeight, 'green');

  // Outside margins: 35 pixels = 5 HGR bytes on each side.
  filled(0, y, x, h, 'orange');
  filled(x + w, y, 280 - (x + w), h, 'orange');
}

function drawPerimeterStone(col, row) {
  const {x, y} = atTile(col, row);
  // A 12x11 stone with one-pixel gutters stays within its 14x13 cell.
  filled(x + 1, y + 1, CFG.tile - 2, CFG.tileHeight - 2, 'blue');
  stroke(x + 2, y + 2, x + CFG.tile - 3, y + 2, 'white1');
}

function drawTile(col, row) {
  const {x, y} = atTile(col, row);

  // Adapted island: 10x5 upper slab inside the 14x13 tile.
  filled(x + 2, y + 1, CFG.tile - 4, 5, 'white0');

  // Seven rows of 2-pixel-wide checker cells (10 pixels across).
  // The first two pixels remain grass on alternating rows.
  for (let dy = 0; dy < 7; dy++) {
    for (let dx = 0; dx < CFG.tile - 4; dx++) {
      if ((dy & 1) && dx < 2) continue;
      const color = (((dx >> 1) ^ dy) & 1) ? 'black0' : 'white0';
      hgr.pixel(x + 2 + dx, y + 6 + dy, color);
    }
  }
}

function drawIslands() {
  // Six columns (2,4,...12) by five rows (2,4,...10) = 30 islands.
  for (let row = 2; row < CFG.rows - 1; row += 2)
    for (let col = 2; col < CFG.columns - 1; col += 2)
      drawTile(col, row);
}

function drawBytes() {
  // Optional HGR byte grid indicator, above the playfield.
  filled(0, 0, 280, 5, 'white0');
  for (let x = 0; x < 280; x += 7)
    stroke(x, 0, x, 4, 'black0');
}

// HGR sprite data: 0/1 = phase 0, 2/3 = phase 1.
const sprite1 = [
  '10101100101',
  '10101000101',
  '10000000101',
  '12232322001',
  '02232323001',
  '03233323000',
  '03332323000',
  '03232323000',
  '03232323000',
  '02232323001',
  '12232322001',
  '10000000101'
];

function drawBackground() {
  hgr.clear('black0');
  drawPlayfieldGrass();

  // 15 blocks along the top and bottom; 13 along each side.
  for (let row = 0; row < CFG.rows; row++) {
    for (let col = 0; col < CFG.columns; col++) {
      if (col === 0 || col === CFG.columns - 1 ||
          row === 0 || row === CFG.rows - 1)
        drawPerimeterStone(col, row);
    }
  }

  drawIslands();
  if (CFG.showByteGrid) drawBytes();

  // Place the original 11x12 sprite in open grass at grid cell (1,1).
  if (typeof hgr.drawSprite === 'function')
    hgr.drawSprite(sprite1, atTile(1, 1).x + 2, atTile(1, 1).y + 1);
  else
    print('Sprite skipped: hgr.drawSprite() requires the sprite-extraction version of HGR Script Studio.');
}

hgr.setPattern('solid');
drawBackground();
print('Dynablaster: 15 x 14-bit tiles over 210 pixels; 30 islands.');
