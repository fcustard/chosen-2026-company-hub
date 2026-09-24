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

function cleanCharacterCue(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function validateCharacterCues(scene, fileName) {
  for (const [index, block] of scene.blocks.entries()) {
    if (String(block?.type || "").trim().toLowerCase() !== "character") {
      continue;
    }

    const cue = cleanCharacterCue(
      block.text ||
      block.content ||
      block.line ||
      block.speaker ||
      block.character ||
      block.name ||
      ""
    );

    if (!cue) {
      fail(`${fileName} block ${index + 1} has an empty character cue.`);
    }

    if (/\r|\n/.test(cue)) {
      fail(
        `${fileName} block ${index + 1} splits character cue "${cue}" across multiple lines.`
      );
    }

    if (!/[A-Za-z]/.test(cue) || !/^[A-Za-z0-9 &'’.\/\-–—]+$/.test(cue)) {
      fail(
        `${fileName} block ${index + 1} contains a malformed character cue: "${cue}".`
      );
    }
  }
}

const STYLE_TYPES = new Map([
  ["HEADING_1", "heading"],
  ["HEADING_2", "heading"],
  ["HEADING_3", "character"],
  ["HEADING_4", "music"],
  ["HEADING_5", "transition"],
  ["HEADING_6", "stage"],
  ["SUBTITLE", "production-note"],
  ["TITLE", "lyric"],
  ["NORMAL_TEXT", "dialogue"]
]);

function validateNamedStyles(scene, fileName) {
  for (const [index, block] of scene.blocks.entries()) {
    if (block?.type === "spacer" || !cleanCharacterCue(block?.text || "")) continue;

    const namedStyleType = String(block?.namedStyleType || "").trim().toUpperCase();
    if (!namedStyleType) {
      fail(`${fileName} block ${index + 1} is missing the source namedStyleType.`);
    }

    const expectedType = STYLE_TYPES.get(namedStyleType);
    if (!expectedType) {
      fail(`${fileName} block ${index + 1} uses unsupported namedStyleType "${namedStyleType}".`);
    }

    const actualType = String(block?.type || "").trim().toLowerCase();
    if (expectedType !== actualType) {
      fail(
        `${fileName} block ${index + 1} maps ${namedStyleType} to ${expectedType}, ` +
        `but the generated block is ${actualType || "untyped"}.`
      );
    }
  }
}

function normalizedCue(value) {
  return cleanCharacterCue(value).replace(/[:：]+$/, "").toUpperCase();
}

const KNOWN_CHARACTER_CUES = new Set([
  "ADINA", "ANGEL", "ANGEL VOICE", "ANNA", "ANNOUNCER", "BETHLEHEM WOMAN",
  "CALEB", "CHILD", "CHILD 1", "CHILD 2", "CHILD 3", "CUSTOMER", "CUSTOMER 1",
  "DAFNA", "ELI", "ELIZABETH", "EZRA", "GABRIEL", "GOSSIPER", "GOSSIPER 1",
  "GOSSIPER 2", "GOSSIPER 3", "GOSSIPER 4", "HEROD", "INNKEEPER", "INNKEEPER 1",
  "INNKEEPER 2", "INNKEEPER 3", "INNKEEPER'S WIFE", "JOSEPH", "KEEPER", "LEVI",
  "LUCIA", "MALACHI", "MAN", "MARY", "MERCHANT", "MERCHANT 1", "MERCHANT 2",
  "NIA", "ROMAN", "ROMAN ANNOUNCER", "SHEPHERD", "SHEPHERD 1", "SHEPHERD 2",
  "SHEPHERD 3", "SHIRA", "SIMON", "TALIA", "VILLAGER", "VILLAGER MAN",
  "VILLAGER MAN 2", "VILLAGER 1", "VILLAGER 2", "VILLAGER 3", "VILLAGER WOMAN 1",
  "VILLAGER WOMAN 2", "WISE MAN", "WOMAN", "WOMAN CUSTOMER 1", "YOUNG SHEPHERD"
]);

function looksLikeCharacter(value) {
  const cue = normalizedCue(value);
  return KNOWN_CHARACTER_CUES.has(cue) ||
    /^(?:CHILD|CUSTOMER|GOSSIPER|INNKEEPER|MERCHANT|SHEPHERD|VILLAGER(?: MAN| WOMAN)?|WOMAN CUSTOMER) \d{1,2}$/.test(cue);
}

function looksLikeStageDirection(value) {
  const text = cleanCharacterCue(value);
  const subject = "(?:Mary|Joseph|Nia|Simon|Shira|Talia|Adina|Dafna|Levi|Caleb|Ezra|Gabriel|Eli|Malachi|Child(?:ren)?|Shepherd(?: \\d+)?|Villager(?: Woman| Man)?(?: \\d+)?|Gossiper(?: \\d+)?|The children|The company|Everyone|No one|He|She|They)";
  const action = "(?:answers?|arrives?|begins?|crosses?|enters?|exits?|exhales?|finishes?|follows?|freezes?|hesitates?|imagines?|joins?|looks?|lowers?|moves?|nods?|notices?|pauses?|reacts?|remains?|runs?|sees?|shifts?|sits?|smiles?|stares?|stays?|steps?|stops?|takes?|turns?|walks?|watches?)";
  return new RegExp(`^${subject}\\s+${action}\\b`, "i").test(text) ||
    /^(Beat\.?|Silence\.?|Immediate murmuring\.?|A conversation slows\.?|A light musical pulse begins\.?|The simple line hangs there\.?|That (?:hurts|surprises)\b)/i.test(text);
}

function validateSemanticSequence(scene, fileName) {
  const blocks = scene.blocks || [];
  let inCharacterList = false;
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index] || {};
    const type = String(block.type || "").trim().toLowerCase();
    const text = cleanCharacterCue(block.text || "");
    const next = blocks.slice(index + 1).find((item) => item?.type !== "spacer");

    if (/^characters:?$/i.test(text)) inCharacterList = true;
    if (inCharacterList && type === "spacer") inCharacterList = false;
    if (inCharacterList && ["heading", "transition"].includes(type)) inCharacterList = false;

    const isGroupLabel = /^(CHILD STORYTELLERS|MARY'S FRIENDS|JOSEPH'S FRIENDS|GOSSIP GIRLS|WISE MEN|VILLAGERS|DANCERS|ENSEMBLE|COMPANY)$/i.test(text);

    if (type === "character" && !inCharacterList && !isGroupLabel && next && String(next.type).toLowerCase() === "character") {
      fail(`${fileName} block ${index + 1} character "${text}" is followed by another character cue without dialogue.`);
    }

    if (type === "character" && /^(CHILD|CUSTOMER|GOSSIPER|INNKEEPER|MERCHANT|SHEPHERD|VILLAGER WOMAN|WOMAN CUSTOMER)$/i.test(text)) {
      if (next && /^\d{1,2}$/.test(cleanCharacterCue(next.text || ""))) {
        fail(`${fileName} block ${index + 1} splits numbered character name "${text} ${next.text}".`);
      }
    }

    if (type === "heading" && looksLikeCharacter(text)) {
      const followingType = String(next?.type || "").toLowerCase();
      if (followingType === "dialogue") {
        fail(`${fileName} block ${index + 1} classifies apparent character "${text}" as a section heading.`);
      }
    }

    if (["text", "normal", "unknown", ""].includes(type) && text) {
      fail(`${fileName} block ${index + 1} is ambiguous and must be classified as dialogue, stage, heading, music, transition, lyric, production-note, or character.`);
    }

    if (type === "dialogue" && looksLikeStageDirection(text)) {
      fail(`${fileName} block ${index + 1} looks like a stage direction but is classified as dialogue: "${text}".`);
    }

    if (inCharacterList && type === "character") {
      fail(`${fileName} block ${index + 1} publishes cast-list entry "${text}" as an active character cue.`);
    }
  }
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

  validateCharacterCues(scene, fileName);
  validateNamedStyles(scene, fileName);
  validateSemanticSequence(scene, fileName);

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
