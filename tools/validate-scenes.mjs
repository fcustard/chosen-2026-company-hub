import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCRIPTS_FILE = path.join(ROOT, "data", "scripts.json");
const SCENES_DIR = path.join(ROOT, "data", "scenes");

function fail(message) {
  console.error(`❌ SCENE PUBLISHING ERROR: ${message}`);
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

const scripts = readJson(SCRIPTS_FILE);

if (!Array.isArray(scripts)) {
  fail("data/scripts.json must contain a JSON array.");
}

if (!fs.existsSync(SCENES_DIR)) {
  console.log("ℹ️ No data/scenes directory yet. Nothing to validate.");
  process.exit(0);
}

const sceneFiles = fs
  .readdirSync(SCENES_DIR)
  .filter((file) => /^scene-\d{2}\.json$/i.test(file))
  .sort();

for (const fileName of sceneFiles) {
  const filePath = path.join(SCENES_DIR, fileName);
  const scene = readJson(filePath);

  const expectedNumber = fileName.match(/\d{2}/)?.[0];

  if (!scene.scene) {
    fail(`${fileName} is missing "scene".`);
  }

  const sceneNumber = normalizeSceneNumber(scene.scene);

  if (sceneNumber !== expectedNumber) {
    fail(
      `${fileName} says scene "${scene.scene}", but its filename represents Scene ${expectedNumber}.`
    );
  }

  if (!scene.title || !String(scene.title).trim()) {
    fail(`${fileName} is missing a title.`);
  }

  if (!Array.isArray(scene.blocks)) {
    fail(`${fileName} must contain a "blocks" array.`);
  }

  const manifest = scripts.find(
    (item) => normalizeSceneNumber(item.scene) === sceneNumber
  );

  if (!manifest) {
    console.log(
      `ℹ️ Scene ${sceneNumber}: data file exists, but no scripts.json manifest record exists yet. Not publishable.`
    );
    continue;
  }

  const wantsPublication =
    manifest.approved === true || manifest.companyPublish === true;

  if (!wantsPublication) {
    console.log(
      `🔒 Scene ${sceneNumber}: staged but unpublished. Validation passed.`
    );
    continue;
  }

  if (manifest.approved !== true) {
    fail(
      `Scene ${sceneNumber} requests company publication but is not approved.`
    );
  }

  if (manifest.companyPublish !== true) {
    fail(
      `Scene ${sceneNumber} is approved but companyPublish is not true.`
    );
  }

  if (scene.blocks.length === 0) {
    fail(
      `Scene ${sceneNumber} is marked for publication but contains no script blocks.`
    );
  }

  if (!manifest.readUrl || !String(manifest.readUrl).trim()) {
    fail(`Scene ${sceneNumber} is publishable but has no readUrl.`);
  }

  if (!manifest.pdfUrl || !String(manifest.pdfUrl).trim()) {
    fail(`Scene ${sceneNumber} is publishable but has no pdfUrl.`);
  }

  const pdfPath = path.join(ROOT, manifest.pdfUrl);

  if (!fs.existsSync(pdfPath)) {
    fail(
      `Scene ${sceneNumber} references ${manifest.pdfUrl}, but that PDF does not exist.`
    );
  }

  console.log(
    `✅ Scene ${sceneNumber}: approved company publication record passed safety validation.`
  );
}

console.log("✅ Scene publication safety validation complete.");
