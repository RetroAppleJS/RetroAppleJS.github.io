(function () {
  if (window.__ASCIICAD_LOG_FORWARD__) return;
  window.__ASCIICAD_LOG_FORWARD__ = true;

  function forward(type, args) {
    try {
      parent.postMessage(
        {
          __asciicadLog: true,
          type,
          args: args.map(a =>
            typeof a === "object" ? JSON.stringify(a) : String(a)
          )
        },
        "*"
      );
    } catch {}
  }

  ["log", "warn", "error"].forEach(type => {
    const orig = console[type];
    console[type] = (...args) => {
      forward(type, args);
      orig.apply(console, args);
    };
  });
})();

function gridFromText(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  for (let r = 0; r < ROWS; r++) {
    const line = lines[r] || "";
    for (let c = 0; c < COLS; c++) ascii[r][c] = line[c] || " ";
  }
}

function textFromGrid(h, w) {
  let out = "";
  for (let r = 0; r < h; r++) {
    let line = "";
    for (let c = 0; c < w; c++) line += ascii[r][c] || " ";
    out += line + "\n";
  }
  return out;
}

function assertEq(name, got, exp) {
  if (got !== exp) {
    console.error("TEST FAILED:", name);
    console.error("GOT:\n" + got.split("\n").map(l => JSON.stringify(l)).join("\n"));
    console.error("EXP:\n" + exp.split("\n").map(l => JSON.stringify(l)).join("\n"));
  }
  console.assert(got === exp, name);
}


function applyHorizontalLine(r, c0, c1, kind, mergeEnabled) {
  const hChar = (kind === "double") ? "═" : "─";
  const stroke = [];
  const touched = [];

  const step = c1 >= c0 ? 1 : -1;
  for (let c = c0; c !== c1 + step; c += step) {
    const prev = ascii[r][c];
    let next = hChar;

    if (mergeEnabled) {
      const prevIsWire = (prev === " ") || isWireGlyph(prev);
      const nextIsWire = (next === " ") || isWireGlyph(next);
      if (prevIsWire && nextIsWire) next = mergedWireGlyph(prev, next, kind);
    }

    if (prev !== next) {
      stroke.push({ r, c, prev, next });
      ascii[r][c] = next;
      touched.push({ r, c });
    }
  }

  if (mergeEnabled && touched.length) {
    const affected = new Set();
    for (let i = 0; i < touched.length; i++) addNeighborsToSet(affected, touched[i].r, touched[i].c);
    affected.forEach((key) => {
      const parts = key.split(",");
      const rr = Number(parts[0]);
      const cc = Number(parts[1]);
      const prev = ascii[rr][cc];
      const next = recomputeWireCell(rr, cc);
      if (prev !== next) {
        stroke.push({ r: rr, c: cc, prev, next });
        ascii[rr][cc] = next;
      }
    });
  }

  return stroke; // in case you want to pushStrokeIfNonEmpty in tests
}


function runJunctionTests() {
  // Keep tests small: use top-left 5x5 of your big grid
  const H = 5, W = 5;

  // --- 1) single + single => ┼
  gridFromText(
    "  │  \n" +
    "  │  \n" +
    "─────\n" +
    "  │  \n" +
    "  │  \n"
  );
  // draw single horizontal across the middle again (idempotent)
  applyHorizontalLine(2, 0, 4, "single", true);
  assertEq("single×single => ┼", textFromGrid(H, W),
    "  │  \n" +
    "  │  \n" +
    "──┼──\n" +
    "  │  \n" +
    "  │  \n"
  );

  // --- 2) double + double => ╬
  gridFromText(
    "  ║  \n" +
    "  ║  \n" +
    "═════\n" +
    "  ║  \n" +
    "  ║  \n"
  );
  applyHorizontalLine(2, 0, 4, "double", true);
  assertEq("double×double => ╬", textFromGrid(H, W),
    "  ║  \n" +
    "  ║  \n" +
    "══╬══\n" +
    "  ║  \n" +
    "  ║  \n"
  );

  // --- 3) double vertical + single horizontal => ╫
  gridFromText(
    "  ║  \n" +
    "  ║  \n" +
    "─────\n" +
    "  ║  \n" +
    "  ║  \n"
  );
  applyHorizontalLine(2, 0, 4, "single", true);
  assertEq("double vert × single horz => ╫", textFromGrid(H, W),
    "  ║  \n" +
    "  ║  \n" +
    "──╫──\n" +
    "  ║  \n" +
    "  ║  \n"
  );

  // --- 4) single vertical + double horizontal => ╪
  gridFromText(
    "  │  \n" +
    "  │  \n" +
    "═════\n" +
    "  │  \n" +
    "  │  \n"
  );
  applyHorizontalLine(2, 0, 4, "double", true);
  assertEq("single vert × double horz => ╪", textFromGrid(H, W),
    "  │  \n" +
    "  │  \n" +
    "══╪══\n" +
    "  │  \n" +
    "  │  \n"
  );

  // --- 5) Your provided case: two single verticals crossed by double horizontal
  gridFromText(
    " ││  \n" +
    " ││  \n" +
    " ││  \n"
  );
  applyHorizontalLine(1, 0, 3, "double", true);
  assertEq("two single verticals crossed by double horizontal", textFromGrid(3, 4),
    " ││ \n" +
    "═╪╪═\n" +
    " ││ \n"
  );

  console.log("Junction tests done.");
}


function setSmallGridFromLines(lines) {
  for (let r = 0; r < lines.length; r++) {
    for (let c = 0; c < lines[r].length; c++) ascii[r][c] = lines[r][c];
  }
}

function getSmallGridText(h, w) {
  let s = "";
  for (let r = 0; r < h; r++) {
    let line = "";
    for (let c = 0; c < w; c++) line += ascii[r][c];
    s += line + "\n";
  }
  return s;
}

function assertGrid(name, got, exp) {
  console.assert(got === exp, name + "\nGOT:\n" + got + "\nEXP:\n" + exp);
}

function runMixedJunctionTests() {
  // Use a 5x5 window in the real grid
  const H=5, W=5;

  // single×single => ┼
  setSmallGridFromLines([
    "  │  ",
    "  │  ",
    "─────",
    "  │  ",
    "  │  ",
  ]);
  // normalize center
  recomputeWireCell(2,2);
  assertGrid("single×single => ┼", getSmallGridText(H,W),
    "  │  \n  │  \n──┼──\n  │  \n  │  \n"
  );

  // double×double => ╬
  setSmallGridFromLines([
    "  ║  ",
    "  ║  ",
    "═════",
    "  ║  ",
    "  ║  ",
  ]);
  recomputeWireCell(2,2);
  assertGrid("double×double => ╬", getSmallGridText(H,W),
    "  ║  \n  ║  \n══╬══\n  ║  \n  ║  \n"
  );

  // single vert × double horz => ╪
  setSmallGridFromLines([
    "  │  ",
    "  │  ",
    "═════",
    "  │  ",
    "  │  ",
  ]);
  recomputeWireCell(2,2);
  assertGrid("single vert × double horz => ╪", getSmallGridText(H,W),
    "  │  \n  │  \n══╪══\n  │  \n  │  \n"
  );

  // double vert × single horz => ╫
  setSmallGridFromLines([
    "  ║  ",
    "  ║  ",
    "─────",
    "  ║  ",
    "  ║  ",
  ]);
  recomputeWireCell(2,2);
  assertGrid("double vert × single horz => ╫", getSmallGridText(H,W),
    "  ║  \n  ║  \n──╫──\n  ║  \n  ║  \n"
  );

  // Your example: two single verticals crossed by double horizontal => ╪ ╪
  setSmallGridFromLines([
    " ││  ",
    " ││  ",
    " ││  ",
    "     ",
    "     ",
  ]);
  // draw the double line into row 1 (like your example), then normalize around
  for (let c=0;c<4;c++) ascii[1][c] = "═";
  for (let c=0;c<4;c++) { recomputeWireCell(1,c); recomputeWireCell(0,c); recomputeWireCell(2,c); }
  assertGrid("two single verticals crossed by double horiz", getSmallGridText(3,4),
    " ││ \n═╪╪═\n ││ \n"
  );

  console.log("Mixed junction tests done.");
}



(function init() {
stageSize = computeStageSize();
stage.style.width = stageSize.w + 'px';
stage.style.height = stageSize.h + 'px';
syncCanvasBufferToStage();

// Light sanity checks
console.assert(serializeToText().split('\n')[0].length === COLS, 'serializeToText -> COLS chars/line');
console.assert(toLines('A\r\nB\rC\nD').length === 4, 'newline normalization');
console.assert(!serializeToText().includes("\\n"), "Save must not contain literal \\n");

console.assert(
    sanitizeForSave("A\\nB\\rC\\r\\nD").split("\n").length === 4,
    "Literal escape normalization failed"
);

console.assert(
    sanitizeForSave("A   \nB\t\t\n\n").endsWith("A\nB"),
    "Trailing whitespace or empty-line trimming failed"
);

console.assert(
    !sanitizeForSave("A\\nB").includes("\\n"),
    "Saved text must not contain literal \\n"
);

console.assert(!catalogTypes().includes(null), "catalogTypes contains null");

console.assert(!catalogTypes().includes(""), "catalogTypes contains empty string");


if (bDebug) { runJunctionTests(); wipeSelection(' '); }
if (bDebug) { runMixedJunctionTests(); wipeSelection(' '); }

updateUI();
draw();
})();

