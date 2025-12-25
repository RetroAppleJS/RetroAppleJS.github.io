const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function normalizeNewlines(t) {
return String(t ?? "")
.replace(/\r\n/g, "\n") // real CRLF -> LF
.replace(/\r/g, "\n");  // real CR   -> LF
}

function toLines(t) {
return normalizeNewlines(t).split("\n"); // split on real LF
}

const normRect = (a, b) => ({ r0: Math.min(a.r,b.r), r1: Math.max(a.r,b.r), c0: Math.min(a.c,b.c), c1: Math.max(a.c,b.c) });

const rangeChars = (start, end) => {
const out = [];
for (let cp = start; cp <= end; cp++) out.push(String.fromCharCode(cp));
return out;
};