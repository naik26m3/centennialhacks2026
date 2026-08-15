import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(projectRoot, "GREENLIGHT_CLAUDE_REVIEW.html");

const sourceRoots = ["uxui/app", "uxui/components", "uxui/hooks", "uxui/lib"];
const standaloneFiles = [
  "docs/PRD.md",
  "docs/OWNERSHIP.md",
  "uxui/README.md",
  "uxui/package.json",
  "uxui/next.config.ts",
  "uxui/app/globals.css",
  "scripts/build-claude-review.mjs",
];
const allowedExtensions = new Set([".ts", ".tsx", ".css", ".json", ".md", ".mjs"]);

async function walk(relativeDir) {
  const absoluteDir = path.join(projectRoot, relativeDir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === ".next") continue;
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(relativePath)));
    if (entry.isFile() && allowedExtensions.has(path.extname(entry.name))) files.push(relativePath);
  }
  return files;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function fileExists(relativePath) {
  try {
    return (await stat(path.join(projectRoot, relativePath))).isFile();
  } catch {
    return false;
  }
}

const discovered = (await Promise.all(sourceRoots.map(walk))).flat();
const sourceFiles = [...new Set([...standaloneFiles, ...discovered])]
  .filter((file) => !file.includes(".env"))
  .filter((file) => file !== "uxui/package-lock.json")
  .sort();

const sourceEntries = [];
for (const relativePath of sourceFiles) {
  if (!(await fileExists(relativePath))) continue;
  sourceEntries.push({
    path: relativePath,
    source: await readFile(path.join(projectRoot, relativePath), "utf8"),
  });
}

const heroImage = await readFile(path.join(projectRoot, "uxui/public/images/greenlight-meadow.webp"));
const heroDataUrl = `data:image/webp;base64,${heroImage.toString("base64")}`;
const generatedAt = new Date().toISOString();
const totalSourceBytes = sourceEntries.reduce((total, entry) => total + Buffer.byteLength(entry.source), 0);

const reviewPrompt = `You are reviewing Greenlight, a hackathon demo that turns utility bills into verified home-energy incentives and an actionable application plan.

Inspect the visual preview, interaction map, product requirements, and complete source dossier in this HTML file. Then provide:

1. A blunt assessment of why the current demo may feel shallow or button-limited.
2. Ten concrete interactions that would make a 3-minute judge demo feel alive, consequential, and believable.
3. A revised emotional narrative for the journey from upload to discovery to action.
4. Provocative but truthful replacement headlines and CTA labels for every major screen.
5. The three highest-impact changes that can be completed during a hackathon, ranked by effort and demo value.
6. Any confusing, low-trust, inaccessible, or technically fragile moments you find.

Do not recommend generic dashboards, decorative gamification, or features that require inventing eligibility or dollar amounts. Keep calculations deterministic and sources official.`;

const sourceMarkup = sourceEntries
  .map(
    (entry, index) => `<details class="source" data-search="${escapeHtml(entry.path.toLowerCase())}" ${index < 2 ? "open" : ""}>
      <summary><span>${escapeHtml(entry.path)}</span><small>${entry.source.split("\n").length} lines</small></summary>
      <pre><code>${escapeHtml(entry.source)}</code></pre>
    </details>`,
  )
  .join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Greenlight - Complete Claude Review Dossier</title>
  <style>
    :root{--forest:#173d2a;--leaf:#1f5c3f;--mist:#eef2ec;--paper:#fbfcf9;--line:#d8e0d7;--ink:#16221a;--muted:#5b6c61}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font-family:"Avenir Next","Helvetica Neue",Arial,sans-serif;line-height:1.55}
    button,input{font:inherit}a{color:inherit}.shell{width:min(1180px,calc(100% - 32px));margin:0 auto}.topbar{position:sticky;top:0;z-index:10;border-bottom:1px solid rgba(216,224,215,.8);background:rgba(251,252,249,.9);backdrop-filter:blur(18px)}
    .topbar .shell{height:64px;display:flex;align-items:center;justify-content:space-between}.brand{display:flex;align-items:center;gap:10px;color:var(--forest);font-weight:700}.mark{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:var(--leaf);color:white}.meta{font-size:12px;color:var(--muted)}
    .hero{position:relative;min-height:700px;display:grid;place-items:center;overflow:hidden;background-image:linear-gradient(rgba(244,246,240,.35),rgba(24,55,35,.18)),url('${heroDataUrl}');background-size:cover;background-position:center}.hero::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 34%,rgba(255,255,255,.52),transparent 42%)}
    .preview-nav{position:absolute;z-index:2;top:26px;width:min(920px,calc(100% - 40px));height:64px;padding:0 24px;border:1px solid rgba(255,255,255,.75);border-radius:999px;background:rgba(255,255,255,.62);backdrop-filter:blur(22px);display:flex;align-items:center;justify-content:space-between;color:var(--forest)}
    .preview-nav nav{display:flex;gap:30px;font-size:14px}.hero-copy{position:relative;z-index:2;text-align:center;width:min(850px,calc(100% - 32px));padding-top:70px}.hero h1{margin:0;color:var(--forest);font-size:clamp(48px,7vw,82px);letter-spacing:-.055em;line-height:.98}.hero p{max-width:680px;margin:26px auto 32px;color:#284a38;font-size:18px}
    .upload{width:min(670px,100%);margin:auto;padding:14px;border:1px solid rgba(255,255,255,.9);border-radius:28px;background:rgba(255,255,255,.7);box-shadow:0 24px 70px rgba(32,57,40,.2);backdrop-filter:blur(22px)}.drop{min-height:166px;border:1px dashed rgba(31,92,63,.38);border-radius:20px;display:grid;place-items:center;padding:30px}.drop strong{display:block;color:var(--leaf);font-size:17px}.drop small{color:var(--muted)}
    .actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.actions span{padding:13px;border-radius:12px;font-weight:700;font-size:14px}.primary{background:var(--leaf);color:white}.secondary{border:1px solid white;background:rgba(255,255,255,.42);color:var(--leaf)}
    section{padding:72px 0;border-bottom:1px solid var(--line)}h2{margin:0 0 12px;font-size:clamp(30px,4vw,48px);letter-spacing:-.035em;line-height:1.05;color:var(--forest)}.lede{max-width:760px;margin:0 0 34px;color:var(--muted);font-size:17px}.grid{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}.card{border:1px solid var(--line);border-radius:18px;background:white;padding:24px}.card h3{margin:0 0 8px;color:var(--forest)}.card p{margin:0;color:var(--muted)}
    .flow .card{grid-column:span 4}.flow strong{display:block;font-size:26px;color:var(--leaf);margin-bottom:8px}.prompt{border-radius:22px;background:var(--forest);color:white;padding:28px}.prompt pre{margin:0;white-space:pre-wrap;font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace}.copy{margin-top:18px;border:1px solid rgba(255,255,255,.4);border-radius:10px;background:transparent;color:white;padding:10px 14px;cursor:pointer}.copy:hover{background:rgba(255,255,255,.1)}
    .search{width:100%;border:1px solid var(--line);border-radius:12px;background:white;padding:13px 15px;margin-bottom:16px}.source{border:1px solid var(--line);border-radius:12px;background:white;margin:10px 0;overflow:hidden}.source summary{cursor:pointer;display:flex;justify-content:space-between;gap:18px;padding:14px 16px;font-weight:700;color:var(--forest)}.source small{font-weight:400;color:var(--muted)}.source pre{margin:0;border-top:1px solid var(--line);background:#111a14;color:#dbe9de;padding:18px;overflow:auto;max-height:640px;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}
    .facts .card:nth-child(1){grid-column:span 7}.facts .card:nth-child(2){grid-column:span 5}.facts .card:nth-child(3){grid-column:span 5}.facts .card:nth-child(4){grid-column:span 7}.footer{padding:36px 0;color:var(--muted);font-size:13px}
    @media(max-width:760px){.preview-nav nav{display:none}.hero{min-height:760px}.hero h1{font-size:46px}.hero p{font-size:16px}.actions{grid-template-columns:1fr}.flow .card,.facts .card:nth-child(n){grid-column:1/-1}section{padding:52px 0}.meta{display:none}}
  </style>
</head>
<body>
  <header class="topbar"><div class="shell"><div class="brand"><span class="mark">G</span>Greenlight review dossier</div><div class="meta">Generated ${escapeHtml(generatedAt)} | ${sourceEntries.length} source files | ${(totalSourceBytes / 1024).toFixed(0)} KB source</div></div></header>
  <main>
    <div class="hero" aria-label="Static visual preview of the Greenlight home screen">
      <div class="preview-nav"><strong>Greenlight</strong><nav><span>Opportunities</span><span>Plan</span><span>Sound</span></nav></div>
      <div class="hero-copy"><h1>Your home may be leaving thousands behind.</h1><p>Upload a bill. We expose verified incentives, show what they are worth, and prepare the path to claim them.</p><div class="upload"><div class="drop"><div><strong>Put your utility bills to work</strong><small>PDF or photo. Electricity and gas bills can be added together.</small></div></div><div class="actions"><span class="primary">Reveal a demo household</span><span class="secondary">Take a photo</span></div></div></div>
    </div>

    <section><div class="shell"><h2>The demo journey Claude should interrogate</h2><p class="lede">Greenlight is not a rebate directory. The intended emotional arc is uncertainty, discovery, proof, agency, and relief.</p><div class="grid flow">
      <article class="card"><strong>01</strong><h3>Reveal what is hidden</h3><p>A bill becomes a household profile and a search across reviewed official programs.</p></article>
      <article class="card"><strong>02</strong><h3>Prove every dollar</h3><p>Eligibility evidence, estimates, payback logic, and official sources stay visible.</p></article>
      <article class="card"><strong>03</strong><h3>Turn possibility into action</h3><p>The agent resolves administrators, asks only for missing facts, and prepares the next step.</p></article>
    </div></div></section>

    <section><div class="shell"><h2>Product facts and constraints</h2><p class="lede">Use these to distinguish deliberate product boundaries from unfinished interaction design.</p><div class="grid facts">
      <article class="card"><h3>Truth boundary</h3><p>Deterministic TypeScript owns eligibility and financial calculations. AI may explain verified results but cannot invent eligibility, amounts, contacts, or sources.</p></article>
      <article class="card"><h3>Core demo path</h3><p>Bill upload or demo household, analysis sequence, opportunity findings, evidence detail, agent case, negotiated plan.</p></article>
      <article class="card"><h3>Current concern</h3><p>The interface can feel like a short chain of buttons instead of a responsive, consequential conversation with the household.</p></article>
      <article class="card"><h3>Desired feeling</h3><p>Warm, trustworthy, uplifting, and emotionally direct. Interaction should reveal real reasoning and let judges influence the outcome.</p></article>
    </div></div></section>

    <section><div class="shell"><h2>Paste-ready Claude critique prompt</h2><p class="lede">Upload this HTML file to Claude, then paste the prompt below.</p><div class="prompt"><pre id="review-prompt">${escapeHtml(reviewPrompt)}</pre><button class="copy" type="button" onclick="navigator.clipboard.writeText(document.getElementById('review-prompt').innerText);this.textContent='Copied'">Copy prompt</button></div></div></section>

    <section><div class="shell"><h2>Complete source dossier</h2><p class="lede">Searchable implementation context is embedded below. Secrets, environment files, build output, and dependencies are excluded.</p><input id="source-search" class="search" type="search" placeholder="Filter source files by path" aria-label="Filter source files"><div id="sources">${sourceMarkup}</div></div></section>
  </main>
  <footer class="footer"><div class="shell">Standalone Greenlight review artifact. The production app remains separate.</div></footer>
  <script>
    const input=document.getElementById('source-search');
    input.addEventListener('input',()=>{const q=input.value.trim().toLowerCase();document.querySelectorAll('.source').forEach((el)=>{el.hidden=q&&!el.dataset.search.includes(q)})});
  </script>
</body>
</html>`;

await writeFile(outputPath, html, "utf8");
console.log(JSON.stringify({
  output: outputPath,
  bytes: Buffer.byteLength(html),
  sourceFiles: sourceEntries.length,
  sourceBytes: totalSourceBytes,
  embeddedHero: html.includes("data:image/webp;base64,"),
  containsEnvFile: sourceEntries.some((entry) => entry.path.includes(".env")),
}, null, 2));
