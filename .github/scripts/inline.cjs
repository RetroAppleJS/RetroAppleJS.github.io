const fs = require("fs");
const path = require("path");
const excludePattern = ["ExcludeFromDistro"];    // strings or regex fragments to exclude from distro

// Find repo root by stripping everything after "/.github"
const marker = `${path.sep}.github${path.sep}`;
const idx = __dirname.lastIndexOf(marker);
const repoRoot = idx >= 0 ? __dirname.slice(0, idx) : path.resolve(__dirname, "..");

const srcHtmlPath = path.join(repoRoot, "index.html");
const outDir = path.join(repoRoot, "dist");
const outHtmlPath = path.join(outDir, "RetroAppleJS.html");

function readUtf8(p) {
  if (!fs.existsSync(p)) {
    throw new Error(`Missing file: ${p}`);
  }
  return fs.readFileSync(p, "utf8");
}

function matchesExcludePattern(s) {
  if (!excludePattern || !excludePattern.length) return false;
  const hay = String(s || "");
  return excludePattern.some((pat) => {
    if (!pat) return false;
    // Treat patterns as case-insensitive substrings by default.
    // If you want true regex support, pass strings like "/foo.*/i" and extend this.
    return hay.toLowerCase().includes(String(pat).toLowerCase());
  });
}

function shouldExclude(includeUrl, originalTag) {
  return matchesExcludePattern(includeUrl) || matchesExcludePattern(originalTag);
}

function isRemote(url) {
  return /^(https?:)?\/\//i.test(url) || /^data:/i.test(url);
}

function inlineBuild(html) {
  // Inline stylesheet links
  const linkRe = /<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*>/gi;
  html = html.replace(linkRe, (tag) => {
    const hrefMatch = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) return tag;

    const href = hrefMatch[1].trim();
    // Keep a boundary so removing an include cannot join text into a new tag.
    if (shouldExclude(href, tag)) return "<!-- ExcludeFromDistro -->";
    if (isRemote(href)) return tag;

    const cssPath = path.join(repoRoot, href);
    const css = readUtf8(cssPath);
    return `<style>\n${css}\n</style>`;
  });

  // Inline scripts with src=
  const scriptRe =
    /<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi;

  // This is a trusted-source bundler, not an HTML sanitizer. Assemble each
  // matched include once; do not delete tags and concatenate their neighbours.
  const parts = [];
  let cursor = 0;
  let match;
  while ((match = scriptRe.exec(html)) !== null) {
    const [full, preAttrs, src, postAttrs] = match;
    parts.push(html.slice(cursor, match.index));
    cursor = scriptRe.lastIndex;
    const s = src.trim();
    if (shouldExclude(s, full)) {
      parts.push("<!-- ExcludeFromDistro -->");
      continue;
    }
    if (isRemote(s)) {
      parts.push(full);
      continue;
    }

    const jsPath = path.join(repoRoot, s);
    const js = readUtf8(jsPath);

    const attrs = (preAttrs + " " + postAttrs).replace(/\s+/g, " ").trim();
    const cleanedAttrs = attrs.replace(/\bsrc\s*=\s*["'][^"']+["']/i, "").trim();

    parts.push(`<script${cleanedAttrs ? " " + cleanedAttrs : ""}>\n${js}\n</script>`);
  }

  parts.push(html.slice(cursor));
  return parts.join("");
}

function main() {
  console.log("repoRoot   =", repoRoot);
  console.log("srcHtml    =", srcHtmlPath);
  console.log("outDir     =", outDir);
  console.log("outHtml    =", outHtmlPath);

  const srcHtml = readUtf8(srcHtmlPath);
  const built = inlineBuild(srcHtml);

  // Ensure dist exists (and is a directory)
  if (fs.existsSync(outDir) && !fs.lstatSync(outDir).isDirectory()) {
    throw new Error(`'${outDir}' exists but is not a directory.`);
  }
  fs.mkdirSync(outDir, { recursive: true });


  fs.writeFileSync(outHtmlPath, built, "utf8");

   const st = fs.statSync(outHtmlPath);
   console.log(`Wrote ${outHtmlPath} (${st.size} bytes)`);
  
  if (st.size < 1000) {
    throw new Error("Output looks too small—build likely failed or inlining did nothing.");
  }

}

main();
