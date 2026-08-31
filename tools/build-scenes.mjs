import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const SCRIPTS_FILE = path.join(ROOT, "data", "scripts.json");
const SCENES_DIR = path.join(ROOT, "data", "scenes");
const TEMPLATE_FILE = path.join(ROOT, "templates", "scene-reader.html");

function fail(message) {
  console.error(`❌ SCENE BUILD ERROR: ${message}`);
  process.exit(1);
}

function readJson(file) {
  if (!fs.existsSync(file)) {
    fail(`Required file not found: ${path.relative(ROOT, file)}`);
  }

  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`Invalid JSON in ${path.relative(ROOT, file)}: ${error.message}`);
  }
}

function normalizeSceneNumber(value) {
  return String(value).padStart(2, "0");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderBlock(block) {
  if (!block || typeof block !== "object") {
    return "";
  }

  const type = block.type || "text";

  switch (type) {
    case "heading":
      return `<h3 class="scriptHeading">${escapeHtml(block.text)}</h3>`;

    case "character":
      return `<p class="character">${escapeHtml(block.text)}</p>`;

    case "dialogue":
      return `<p class="dialogue">${escapeHtml(block.text)}</p>`;

    case "stage":
    case "direction":
      return `<p class="stageDirection"><em>${escapeHtml(block.text)}</em></p>`;

    case "lyric":
      return `<p class="lyric">${escapeHtml(block.text)}</p>`;

    case "music":
      return `<p class="musicCue">${escapeHtml(block.text)}</p>`;

    case "transition":
      return `<p class="transition">${escapeHtml(block.text)}</p>`;

    case "spacer":
      return `<div class="scriptSpacer" aria-hidden="true"></div>`;

    case "text":
    default:
      return `<p>${escapeHtml(block.text || "")}</p>`;
  }
}

function replaceToken(html, token, value) {
  return html.replaceAll(`{{${token}}}`, String(value ?? ""));
}

const scripts = readJson(SCRIPTS_FILE);

if (!Array.isArray(scripts)) {
  fail("data/scripts.json must contain a JSON array.");
}

if (!fs.existsSync(TEMPLATE_FILE)) {
  fail("templates/scene-reader.html does not exist.");
}

if (!fs.existsSync(SCENES_DIR)) {
  console.log("ℹ️ No data/scenes directory. No scene pages to build.");
  process.exit(0);
}

const template = fs.readFileSync(TEMPLATE_FILE, "utf8");

const sceneFiles = fs
  .readdirSync(SCENES_DIR)
  .filter((file) => /^scene-\d{2}\.json$/i.test(file))
  .sort();

let built = 0;
let skipped = 0;

for (const fileName of sceneFiles) {
  const scenePath = path.join(SCENES_DIR, fileName);
  const scene = readJson(scenePath);

  const sceneNumber = normalizeSceneNumber(scene.scene);

  const manifest = scripts.find(
    (item) => normalizeSceneNumber(item.scene) === sceneNumber
  );

  if (!manifest) {
    console.log(
      `⏭️ Scene ${sceneNumber}: no scripts.json manifest record. Skipping.`
    );
    skipped += 1;
    continue;
  }

  const publish =
    manifest.approved === true &&
    manifest.companyPublish === true;

  if (!publish) {
    console.log(
      `🔒 Scene ${sceneNumber}: not authorized for company publication. Skipping.`
    );
    skipped += 1;
    continue;
  }

  if (!Array.isArray(scene.blocks) || scene.blocks.length === 0) {
    fail(
      `Scene ${sceneNumber} is authorized for publication but has no script content.`
    );
  }

  if (!manifest.readUrl) {
    fail(`Scene ${sceneNumber} has no readUrl.`);
  }

  if (!manifest.pdfUrl) {
    fail(`Scene ${sceneNumber} has no pdfUrl.`);
  }

  const pdfPath = path.join(ROOT, manifest.pdfUrl);

  if (!fs.existsSync(pdfPath)) {
    fail(
      `Scene ${sceneNumber} cannot build because ${manifest.pdfUrl} does not exist.`
    );
  }

  const content = scene.blocks
    .map(renderBlock)
    .filter(Boolean)
    .join("\n");

  let html = template;

  html = replaceToken(html, "SCENE", sceneNumber);
  html = replaceToken(html, "TITLE", escapeHtml(scene.title));
  html = replaceToken(
    html,
    "EYEBROW",
    escapeHtml(scene.eyebrow || "CURRENT · COMPANY VERSION")
  );
  html = replaceToken(
    html,
    "STATUS",
    escapeHtml(manifest.status || "CURRENT")
  );
  html = replaceToken(
    html,
    "PDF_URL",
    escapeHtml(manifest.pdfUrl)
  );
  html = replaceToken(
    html,
    "PUBLICATION_NOTE",
    escapeHtml(
      scene.publicationNote ||
        "This is the official company rehearsal version."
    )
  );
  html = replaceToken(html, "CONTENT", content);

  const outputFile = path.join(ROOT, manifest.readUrl);

  fs.writeFileSync(outputFile, html, "utf8");

  console.log(
    `✅ Scene ${sceneNumber}: generated ${manifest.readUrl}`
  );

  built += 1;
}

console.log("");
console.log(
  `🎭 Scene reader build complete: ${built} built, ${skipped} skipped.`
);
