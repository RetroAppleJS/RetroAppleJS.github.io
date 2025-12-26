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

updateUI();
draw();
})();

