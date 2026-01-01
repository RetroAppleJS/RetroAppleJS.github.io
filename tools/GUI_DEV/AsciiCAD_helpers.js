const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function normalizeNewlines(t) {
return String(t ?? "")
.replace(/\r\n/g, '\n') // real CRLF -> LF
.replace(/\r/g, '\n');  // real CR   -> LF
}

function toLines(t) {
return normalizeNewlines(t).split('\n'); // split on real LF
}

const normRect = (a, b) => ({ r0: Math.min(a.r,b.r), r1: Math.max(a.r,b.r), c0: Math.min(a.c,b.c), c1: Math.max(a.c,b.c) });

const rangeChars = (start, end) => {
    const out = [];
    for (let cp = start; cp <= end; cp++) out.push(String.fromCharCode(cp));
    return out;
};

function catalogTypes()
{
  const set = new Set();
  for (let i = 0; i < CATALOG.length; i++)
  {
    const item = CATALOG[i];
    let type = item && item.type;
    if (type === null || type === undefined) type = "Other";
    else { type = String(type).trim(); if (type === "") type = "Other"; }
    set.add(type);
  }
  return Array.from(set).sort();
}

const catalogItemsForTab = (tab) => tab === 'All' ? CATALOG : CATALOG.filter(it => String(it.type || 'Other') === tab);
const catalogItemByUID = (uid) => CATALOG.find(it => (it.name+'_'+it.type+'_'+it.MFR) === uid);

// Stage sizing: ensure integer cell sizes (avoid remainder pixels -> spacing artifacts)
function computeStageSize() 
{
    const r = container.getBoundingClientRect();
    let w = Math.max(1, Math.floor(r.width));
    let h = Math.max(1, Math.floor(r.height));
    if (w >= COLS) w = Math.floor(w / COLS) * COLS;
    if (h >= ROWS) h = Math.floor(h / ROWS) * ROWS;
    return { w: Math.max(1, w), h: Math.max(1, h) };
}

function syncCanvasBufferToStage() 
{
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(stageSize.w * dpr));
    const h = Math.max(1, Math.floor(stageSize.h * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
}

function getSnapFns(dpr, scaleNow)
{
    const pxScale = (dpr || 1) * (scaleNow || 1);
    const snap = (v) => Math.round(v * pxScale) / pxScale;
    const snapLine = (v) => (Math.round(v * pxScale) + 0.5) / pxScale;
    return { snap, snapLine };
}

const getCellSize = () => ({ cw: baseCellW, ch: baseCellH });

function PanZoomSize(pos,centre,scale,pan,size)
{
    return ((pos - centre) / scale + centre - pan) / size;
}

function serializeToText() {
const lines = [];
for (let r = 0; r < ROWS; r++) lines.push(ascii[r].join(''));
return lines.join('\n');
}

function deEscapeLiteralNewlines(t) {
return String(t ?? "")
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n');
}

function sanitizeForSave(text) {
let t = String(text ?? "")
    // 1) Convert literal escape sequences to real newlines
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')

    // 2) Normalize real CRLF / CR to LF
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

t = collapseAfterWideCharsForSave(t);

// 3) Trim trailing spaces/tabs per line
let lines = t
    .split('\n')
    .map(line => line.replace(/[ \t]+$/g, ""));


// 4) Remove leading empty lines
while (lines.length > 0 && lines[0] === "") {
    lines.shift();
}

// 5) Remove trailing empty lines
while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
}

return lines.join('\n');
}


function isDoubleWidthChar(ch)
{
    if (!ch) return false;
    const cp = ch.codePointAt(0);

    // Quick ASCII / Latin
    if (cp <= 0x1FFF) return false;

    // Common wide ranges (wcwidth-style; not exhaustive but good enough)
    return (
        (cp >= 0x1100 && cp <= 0x115F) || // Hangul Jamo init.
        cp === 0x2329 || cp === 0x232A ||
        (cp >= 0x2E80 && cp <= 0xA4CF) || // CJK, Yi, radicals...
        (cp >= 0xAC00 && cp <= 0xD7A3) || // Hangul syllables
        (cp >= 0xF900 && cp <= 0xFAFF) || // CJK compatibility ideographs
        (cp >= 0xFE10 && cp <= 0xFE19) ||
        (cp >= 0xFE30 && cp <= 0xFE6F) ||
        (cp >= 0xFF00 && cp <= 0xFF60) || // Fullwidth forms
        (cp >= 0xFFE0 && cp <= 0xFFE6) ||
        (cp >= 0x1F300 && cp <= 0x1FAFF) || // emoji blocks (often wide)
        (cp >= 0x20000 && cp <= 0x3FFFD) || // CJK ext
        cp === 0x2B24 // ⬤ specifically
    );
}