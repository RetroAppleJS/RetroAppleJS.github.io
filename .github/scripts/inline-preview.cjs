const fs = require('fs');
const path = require('path');

const excludePattern = ['ExcludeFromDistro'];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') out.root = argv[++i];
    else if (arg === '--branch') out.branch = argv[++i];
  }
  return out;
}

function sanitizeBranchName(name) {
  const clean = String(name || '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || 'preview';
}

function readUtf8(p) {
  if (!fs.existsSync(p)) throw new Error(`Missing file: ${p}`);
  return fs.readFileSync(p, 'utf8');
}

function matchesExcludePattern(s) {
  if (!excludePattern.length) return false;
  const hay = String(s || '');
  return excludePattern.some((pat) => hay.toLowerCase().includes(String(pat).toLowerCase()));
}

function shouldExclude(includeUrl, originalTag) {
  return matchesExcludePattern(includeUrl) || matchesExcludePattern(originalTag);
}

function isRemote(url) {
  return /^(https?:)?\/\//i.test(url) || /^data:/i.test(url);
}

function escapeInlineScript(js) {
  return js.replace(/<\/script/gi, '<\\/script');
}

function expandDocumentWriteScripts(js, repoRoot, stack = []) {
  const writeRe = /document\.write\(\s*(['"])([\s\S]*?)\1\s*\);/g;
  return js.replace(writeRe, (full, quote, literal) => {
    const html = literal
      .replace(/\\\//g, '/')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'");
    const scriptMatch = html.match(/^\s*<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script>\s*$/i);
    if (!scriptMatch) return full;

    const src = scriptMatch[1].trim();
    if (shouldExclude(src, html)) return '';
    if (isRemote(src)) return full;
    if (stack.includes(src)) throw new Error(`Circular document.write script include: ${stack.concat(src).join(' -> ')}`);

    const nested = readUtf8(path.join(repoRoot, src));
    return `\n${expandDocumentWriteScripts(nested, repoRoot, stack.concat(src))}\n`;
  });
}

function inlineBuild(html, repoRoot) {
  const linkRe = /<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*>/gi;
  html = html.replace(linkRe, (tag) => {
    const hrefMatch = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) return tag;
    const href = hrefMatch[1].trim();
    if (shouldExclude(href, tag)) return '';
    if (isRemote(href)) return tag;
    return `<style>\n${readUtf8(path.join(repoRoot, href))}\n</style>`;
  });

  const scriptRe = /<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi;
  let prevHtml;
  do {
    prevHtml = html;
    html = html.replace(scriptRe, (full, preAttrs, src, postAttrs) => {
      const s = src.trim();
      if (shouldExclude(s, full)) return '';
      if (isRemote(s)) return full;

      const raw = readUtf8(path.join(repoRoot, s));
      const js = expandDocumentWriteScripts(raw, repoRoot, [s]);
      const attrs = (preAttrs + ' ' + postAttrs).replace(/\s+/g, ' ').trim();
      const cleanedAttrs = attrs.replace(/\bsrc\s*=\s*["'][^"']+["']/i, '').trim();
      return `<script${cleanedAttrs ? ' ' + cleanedAttrs : ''}>\n${escapeInlineScript(js)}\n</script>`;
    });
  } while (html !== prevHtml);

  return html;
}

function buildPreviewAssets(repoRoot) {
  const layoutRel = 'tools/GUI_DEV/assets/apple2-layout-embedded_v2.json';
  const layoutPath = path.join(repoRoot, layoutRel);
  if (!fs.existsSync(layoutPath)) return null;

  const rawLayout = readUtf8(layoutPath);
  JSON.parse(rawLayout);
  return {
    [layoutRel]: { mime: 'application/json', text: rawLayout }
  };
}

function previewAssetShim(assets) {
  if (!assets) return '';
  const payload = JSON.stringify(assets).replace(/<\//g, '<\\/');
  return `<script>\n(function(){\n` +
    `var assets=window.__RETROAPPLEJS_PREVIEW_ASSETS__=${payload};\n` +
    `function findAsset(value){var raw=String(value||'');if(assets[raw])return assets[raw];if(raw.indexOf('./')===0&&assets[raw.slice(2)])return assets[raw.slice(2)];if(raw.charAt(0)==='/'&&assets[raw.slice(1)])return assets[raw.slice(1)];return null;}\n` +
    `var nativeFetch=typeof window.fetch==='function'?window.fetch.bind(window):null;\n` +
    `if(nativeFetch){window.fetch=function(input,init){var raw=typeof input==='string'?input:(input&&input.url);var asset=findAsset(raw);if(!asset)return nativeFetch(input,init);return Promise.resolve(new Response(asset.text,{status:200,headers:{'Content-Type':asset.mime}}));};}\n` +
    `})();\n</script>`;
}

function injectPreviewAssets(html, repoRoot) {
  const shim = previewAssetShim(buildPreviewAssets(repoRoot));
  if (!shim) return html;
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, (tag) => `${tag}\n${shim}`);
  return `${shim}\n${html}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const scriptRepoRoot = path.resolve(__dirname, '..', '..');
  const repoRoot = path.resolve(args.root || scriptRepoRoot);
  const branch = args.branch || process.env.GITHUB_REF_NAME || 'preview';
  const safeBranch = sanitizeBranchName(branch);
  const srcHtmlPath = path.join(repoRoot, 'index.html');
  const outDir = path.join(repoRoot, 'dist');
  const outHtmlPath = path.join(outDir, `RetroAppleJS-${safeBranch}.html`);

  const srcHtml = readUtf8(srcHtmlPath);
  const withAssets = injectPreviewAssets(srcHtml, repoRoot);
  const built = inlineBuild(withAssets, repoRoot);

  if (fs.existsSync(outDir) && !fs.lstatSync(outDir).isDirectory()) {
    throw new Error(`'${outDir}' exists but is not a directory.`);
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outHtmlPath, built, 'utf8');

  const st = fs.statSync(outHtmlPath);
  if (st.size < 1000) throw new Error('Output looks too small—build likely failed or inlining did nothing.');
  console.log(`Wrote ${outHtmlPath} (${st.size} bytes)`);
}

if (require.main === module) main();

module.exports = { sanitizeBranchName, inlineBuild, expandDocumentWriteScripts, buildPreviewAssets, injectPreviewAssets };
