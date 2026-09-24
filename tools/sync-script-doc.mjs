#!/usr/bin/env node
/**
 * CHOSEN 2026 — Master Script Direct Publish Sync V1.7 FINAL
 *
 * Purpose:
 * - Fetch the current master script feed from Google Docs Apps Script.
 * - Split the script into Scene 01–12 sections, including Google Doc line-break variants and split numbered speaker names across every scene, including split feed blocks, embedded line breaks, and final pre-write cleanup guards.
 * - Overwrite data/scenes/scene-##.json.
 * - Overwrite data/scripts.json so the Hub builds the newest scene readers.
 *
 * This script intentionally does NOT touch:
 * - app.js
 * - schedule logic
 * - company data
 * - resources
 * - music
 *
 * Required for live use:
 * - GitHub Actions secret: SCRIPT_DOC_FEED_URL
 *
 * Optional for local testing:
 * - SCRIPT_DOC_FEED_FILE=/path/to/feed.json
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const SCENES_DIR = path.join(ROOT, "data", "scenes");
const SCRIPTS_FILE = path.join(ROOT, "data", "scripts.json");

const EXPECTED_SCENES = new Set(
  Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"))
);

const CANONICAL_TITLES = new Map([
  ["01", "Welcome to Nazareth"],
  ["02", "Mary & Joseph / My Beloved"],
  ["03", "Gabriel / Chosen"],
  ["04", "The Secret"],
  ["05", "Brotherhood"],
  ["06", "Mary Tells Joseph / It’s Not Mine"],
  ["07", "Two Roads of Faith"],
  ["08", "Reunion / Still Yours"],
  ["09", "What Will He Be? / The Town Turns"],
  ["10", "The Census and the Journey"],
  ["11", "No Room"],
  ["12", "Good News / Shepherds / Finale"]
]);

const KNOWN_SPEAKERS = new Set([
  "ADINA",
  "ANGEL",
  "ANGEL VOICE",
  "ANGELS",
  "ANNA",
  "ANNOUNCER",
  "BETHLEHEM WOMAN",
  "CALEB",
  "CHILD",
  "CHILD 1",
  "CHILD 2",
  "CHILD 3",
  "CHILDREN",
  "CHILD STORYTELLERS",
  "COMPANY",
  "CUSTOMER",
  "CUSTOMER 1",
  "DAFNA",
  "DANCERS",
  "ELI",
  "ELIZABETH",
  "ENSEMBLE",
  "EZRA",
  "FRIENDS",
  "GABRIEL",
  "GOSSIPER",
  "GOSSIPER 1",
  "GOSSIPER 2",
  "GOSSIPER 3",
  "GOSSIPER 4",
  "GOSSIP GIRLS",
  "HEROD",
  "INNKEEPER",
  "INNKEEPER 1",
  "INNKEEPER 2",
  "INNKEEPER 3",
  "INNKEEPER'S WIFE",
  "JOSEPH",
  "JOSEPH'S FRIENDS",
  "KEEPER",
  "LEVI",
  "LUCIA",
  "MALACHI",
  "MAN",
  "MARY",
  "MARY & JOSEPH",
  "MARY AND JOSEPH",
  "MARY'S FRIENDS",
  "MERCHANT",
  "MERCHANT 1",
  "MERCHANT 2",
  "NIA",
  "ROMAN",
  "ROMAN ANNOUNCER",
  "SHEPHERD",
  "SHEPHERD 1",
  "SHEPHERD 2",
  "SHEPHERD 3",
  "SHIRA",
  "SIMON",
  "TALIA",
  "VILLAGER",
  "VILLAGER MAN",
  "VILLAGER WOMAN 1",
  "VILLAGER WOMAN 2",
  "VILLAGERS",
  "WISE MAN",
  "WISE MEN",
  "WOMAN",
  "WOMAN CUSTOMER 1",
  "YOUNG SHEPHERD"
]);


const NUMBERED_SPEAKER_BASES = new Set([
  "CHILD",
  "CUSTOMER",
  "GOSSIPER",
  "INNKEEPER",
  "MERCHANT",
  "SHEPHERD",
  "VILLAGER WOMAN",
  "WOMAN CUSTOMER"
]);

const SEMANTIC_BLOCK_TYPES = new Set([
  "character", "dialogue", "stage", "heading", "music", "transition",
  "lyric", "production-note", "spacer"
]);

const STYLE_TO_BLOCK_TYPE = new Map([
  ["SCRIPT CHARACTER", "character"],
  ["SCRIPT DIALOGUE", "dialogue"],
  ["SCRIPT STAGE DIRECTION", "stage"],
  ["SCRIPT SECTION", "heading"],
  ["SCRIPT MUSIC CUE", "music"],
  ["SCRIPT TRANSITION", "transition"],
  ["SCRIPT LYRIC", "lyric"],
  ["SCRIPT PRODUCTION NOTE", "production-note"],
  ["HEADING_1", "heading"],
  ["HEADING 1", "heading"],
  ["HEADING_3", "character"],
  ["HEADING 3", "character"],
  ["HEADING_2", "heading"],
  ["HEADING 2", "heading"],
  ["HEADING_4", "music"],
  ["HEADING 4", "music"],
  ["HEADING_5", "transition"],
  ["HEADING 5", "transition"],
  ["HEADING_6", "stage"],
  ["HEADING 6", "stage"],
  ["SUBTITLE", "production-note"],
  ["NORMAL_TEXT", "dialogue"],
  ["NORMAL TEXT", "dialogue"]
]);

function explicitBlockType(block = {}) {
  const text = cleanBlockText(block.text || "");

  // A known cast cue is never a section heading. This guard also repairs older
  // feed payloads that flattened every Google Docs heading level to `heading`.
  if (isKnownSpeaker(text)) return "character";

  const style = String(
    block.styleName || block.namedStyleType || block.paragraphStyle || block.style || ""
  ).trim().toUpperCase().replace(/[\s-]+/g, " ");
  const styledType = STYLE_TO_BLOCK_TYPE.get(style) || STYLE_TO_BLOCK_TYPE.get(style.replace(/ /g, "_"));
  if (styledType) return styledType;

  const rawType = String(block.type || block.blockType || block.semanticType || "")
    .trim()
    .toLowerCase();
  return SEMANTIC_BLOCK_TYPES.has(rawType) ? rawType : "";
}


const STOP_MARKERS = [
  /^CHARACTERS BY SCENE\b/i,
  /^SIMPLE CASTING GUIDE\b/i,
  /^CASTING GUIDE\b/i,
  /^CHARACTER BREAKDOWN\b/i,
  /^APPENDIX\b/i,
  /^PRODUCTION NOTES\b/i,
  /^WARDROBE\b/i
];

function fail(message) {
  console.error(`❌ SCRIPT SYNC ERROR: ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`🎭 ${message}`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeNewlines(value = "") {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function normalizeSceneNumber(value) {
  const match = String(value ?? "").match(/\d{1,2}/);
  if (!match) return "";
  return match[0].padStart(2, "0");
}

function cleanTitle(value = "") {
  return String(value ?? "")
    .replace(/^[-—:–\s]+/, "")
    .replace(/\s+/g, " ")
    .replace(/^["“]+|["”]+$/g, "")
    .replace(/\s*-\s*/g, " - ")
    .trim();
}

function slugify(value = "") {
  return String(value || "script")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "script";
}

function sha256(value = "") {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function isStopLine(line) {
  const text = String(line || "").trim();
  return STOP_MARKERS.some((pattern) => pattern.test(text));
}

function splitEmbeddedSceneHeaders(line) {
  const text = String(line || "")
    .replace(/\u200b/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (!text) return [""];

  // Google Docs can sometimes export styled title pages as one paragraph.
  // Split only on clear scene-heading patterns that use a dash/colon after the number.
  // This avoids breaking ordinary references like "Scene 1 should feel..."
  const prepared = text
    .replace(/(CHOSEN:\s*THE STORY BEFORE THE\s*MANGER)/gi, "\n$1\n")
    .replace(/(\bSCENE\s+\d{1,2}\s*[-—–:])/gi, "\n$1");

  return prepared
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function mergeBrokenSceneHeaderLines(lines) {
  const merged = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = String(lines[index] || "").trim();
    const next = String(lines[index + 1] || "").trim();
    const afterNext = String(lines[index + 2] || "").trim();

    // Handles Google Doc exports like:
    // SCENE
    // 1-WELCOME TO NAZARETH
    const nextHasSceneNumberAndTitle = next.match(/^(\d{1,2})(?:\s*[-—–:]\s*(.+))$/);

    if (/^SCENE$/i.test(line) && nextHasSceneNumberAndTitle) {
      merged.push(`SCENE ${next}`);
      index += 1;
      continue;
    }

    // Handles exports like:
    // SCENE
    // 1
    // WELCOME TO NAZARETH
    if (/^SCENE$/i.test(line) && /^\d{1,2}$/.test(next) && afterNext) {
      merged.push(`SCENE ${next} - ${afterNext}`);
      index += 2;
      continue;
    }

    // Handles exports like:
    // SCENE 1
    // WELCOME TO NAZARETH
    // The canonical title map will still protect public titles, but this keeps
    // the scene boundary obvious to the extractor.
    if (/^SCENE\s+\d{1,2}$/i.test(line) && afterNext !== "" && next) {
      if (/^[A-Z0-9\s&/'"“”’.!?(),-]+$/.test(next) && next.length <= 100) {
        merged.push(`${line} - ${next}`);
        index += 1;
        continue;
      }
    }

    merged.push(line);
  }

  return merged;
}

function mergeBrokenSpeakerNumberLines(lines) {
  const merged = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = String(lines[index] || "").trim();

    // Google Docs can export numbered character names as:
    // MERCHANT
    // 1
    // or:
    // MERCHANT
    //
    // 1
    //
    // This repairs them back to MERCHANT 1 before the scene reader is built.
    if (line) {
      let numberIndex = index + 1;

      while (numberIndex < lines.length && !String(lines[numberIndex] || "").trim()) {
        numberIndex += 1;
      }

      const next = String(lines[numberIndex] || "").trim();

      if (/^\d{1,2}$/.test(next)) {
        const combined = `${line} ${next}`.replace(/\s+/g, " ").trim();

        if (isKnownSpeaker(combined)) {
          merged.push(combined);
          index = numberIndex;
          continue;
        }
      }
    }

    merged.push(line);
  }

  return merged;
}

function sceneHeaderMatch(line) {
  const text = String(line || "").trim();

  // Matches:
  // SCENE 1-WELCOME TO NAZARETH
  // SCENE 1 — WELCOME TO NAZARETH
  // SCENE 3 — Mary (Jordyn), Talia...
  const match = text.match(/^SCENE\s+(\d{1,2})(?:\s*[-—–:]\s*(.*))?$/i);
  if (!match) return null;

  const sceneNumber = normalizeSceneNumber(match[1]);
  if (!EXPECTED_SCENES.has(sceneNumber)) return null;

  return {
    sceneNumber,
    title: cleanTitle(match[2] || "")
  };
}

function compactScriptLines(text) {
  const rawLines = normalizeNewlines(text).split("\n");
  const expandedLines = [];

  for (const rawLine of rawLines) {
    for (const part of splitEmbeddedSceneHeaders(rawLine)) {
      expandedLines.push(part);
    }
  }

  const cleanedLines = expandedLines
    .map((line) =>
      String(line || "")
        .replace(/\u200b/g, "")
        .replace(/[ \t]+/g, " ")
        .trim()
    )
    .filter((line) => {
      if (!line) return true;

      // Remove repeated page/source artifact lines.
      if (/^CHOSEN:\s*THE STORY BEFORE THE\s*MANGER$/i.test(line)) return false;
      if (/^THE STORY BEFORE THE MANGER$/i.test(line)) return false;

      return true;
    });

  const mergedSceneHeaders = mergeBrokenSceneHeaderLines(cleanedLines);
  const mergedSpeakerNumbers = mergeBrokenSpeakerNumberLines(mergedSceneHeaders);

  return mergedSpeakerNumbers.filter((line, index, lines) => {
    // Preserve single blank lines, but not runs.
    if (!line && !lines[index - 1]) return false;
    return true;
  });
}

function extractScenesFromText(text) {
  const lines = compactScriptLines(text);
  const candidates = [];

  let current = null;

  function closeCurrent() {
    if (current && current.lines.join("").trim()) {
      candidates.push(current);
    }
  }

  for (const line of lines) {
    if (isStopLine(line)) {
      closeCurrent();
      current = null;
      break;
    }

    const header = sceneHeaderMatch(line);

    if (header) {
      closeCurrent();

      current = {
        scene: header.sceneNumber,
        title: header.title,
        lines: [],
        header: line
      };

      continue;
    }

    if (current) {
      current.lines.push(line);
    }
  }

  closeCurrent();

  const byScene = new Map();

  for (const item of candidates) {
    const existing = byScene.get(item.scene);
    const currentLength = item.lines.join("\n").length;
    const existingLength = existing ? existing.lines.join("\n").length : -1;

    // If the same scene header appears twice because of title pages or exports,
    // keep the longer scene section. This prevents short title-page fragments from winning.
    if (!existing || currentLength > existingLength) {
      byScene.set(item.scene, item);
    }
  }

  const scenes = Array.from(byScene.values()).sort((a, b) =>
    a.scene.localeCompare(b.scene)
  );

  return scenes.map((scene) => {
    const title = scene.title || findTitleInScene(scene) || CANONICAL_TITLES.get(scene.scene) || `Scene ${Number(scene.scene)}`;

    const cleanedLines = scene.lines
      .filter((line) => !/^CHOSEN:\s*THE STORY BEFORE THE\s*MANGER$/i.test(line))
      .filter((line) => !sceneHeaderMatch(line))
      .filter((line) => !/^Approximate Running Time:/i.test(line))
      .filter((line) => !/^Spoken Dialogue:/i.test(line))
      .filter((line) => !/^Song:/i.test(line))
      .filter((line) => !/^Musical Number:/i.test(line))
      .filter((line) => !/^Musical Sequence:/i.test(line));

    const sceneText = cleanedLines.join("\n").trim();

    return {
      scene: scene.scene,
      title: titleForManifest(scene.scene, title),
      sourceText: sceneText,
      blocks: repairSpeakerNumberBlocks(linesToBlocks(cleanedLines))
    };
  });
}

function findTitleInScene(scene) {
  for (const line of scene.lines.slice(0, 8)) {
    const match = String(line || "").match(/^SCENE\s+\d{1,2}\s*[-—–:]\s*(.+)$/i);
    if (match) return cleanTitle(match[1]);
  }

  return "";
}

function titleForManifest(sceneNumber, title) {
  const clean = cleanTitle(title);

  // The source document sometimes has casting notes after the title.
  // Keep canonical public titles for consistency with the existing Scripts page.
  return CANONICAL_TITLES.get(sceneNumber) || clean || `Scene ${Number(sceneNumber)}`;
}

function isAllCaps(line) {
  const text = String(line || "").trim();
  if (!text) return false;
  const letters = text.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "");
  if (letters.length < 2) return false;
  return text === text.toUpperCase();
}

function isKnownSpeaker(line) {
  const text = String(line || "")
    .trim()
    .replace(/[:：]+$/, "")
    .replace(/\s+/g, " ")
    .toUpperCase();

  return KNOWN_SPEAKERS.has(text);
}

function normalizedSpeakerText(line) {
  return String(line || "")
    .trim()
    .replace(/[:：]+$/, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function isNumberedSpeakerBase(line) {
  const text = normalizedSpeakerText(line);
  return NUMBERED_SPEAKER_BASES.has(text);
}

function isRepairableNumberedSpeaker(base, number) {
  const baseText = normalizedSpeakerText(base);
  const numberText = String(number || "").trim();

  if (!/^\d{1,2}$/.test(numberText)) return false;

  const combined = `${baseText} ${numberText}`.replace(/\s+/g, " ").trim();

  return isKnownSpeaker(combined) || isNumberedSpeakerBase(baseText);
}

function isHeadingLine(line) {
  const text = String(line || "").trim();
  if (!text) return false;

  if (/^(PRESET|OPENING|NOTES?|VERSE\s|CHORUS\s|BRIDGE|SECTION\s|SONG JOURNEY|LYRICAL TERRITORY|IMPORTANT SONG MOMENT|MUSIC|LIGHT CUE|BLACKOUT|RUPTURE|TRANSITION|END SCENE|FINAL|DANCE|FULL INSTRUMENTAL|MUSICAL|GOSSIP BREAK|THE CALLING|THE REVELATION|THE FIRST TEST|THE COST ARRIVES|THE INTERRUPTION)/i.test(text)) {
    return true;
  }

  return isAllCaps(text) && text.length <= 90 && !isKnownSpeaker(text);
}

function isLyricLine(line) {
  const text = String(line || "").trim();
  if (!text) return false;

  if (/^\[.*\]$/.test(text)) return true;
  if (/[♪]/.test(text)) return true;
  if (/^(O+H+|O+O+H+|WELCOME TO|GLORIA|HALLELUJAH)/i.test(text)) return true;

  return false;
}

function lineType(line, previousType) {
  const text = String(line || "").trim();

  if (!text) return "spacer";
  if (isKnownSpeaker(text)) return "character";
  if (isHeadingLine(text)) {
    if (/^(MUSIC|MUSICAL|LIGHT CUE|SOUND|RUPTURE|BLACKOUT)/i.test(text)) return "music";
    if (/^(TRANSITION|END SCENE|FINAL)/i.test(text)) return "transition";
    return "heading";
  }
  if (/^[●•*-]\s+/.test(text)) return "stage";
  if (/^\(.+\)$/.test(text)) return "stage";
  if (isLyricLine(text)) return "lyric";
  if (previousType === "character") return "dialogue";

  // Short sentence after dialogue is often continuing dialogue only when prior type is dialogue.
  if (previousType === "dialogue" && !/^(The|A|An|Beat|Silence|Lights?|Music|Mary|Joseph|Gabriel|They|He|She|Everyone|The stage)/.test(text)) {
    return "dialogue";
  }

  return "stage";
}

function linesToBlocks(lines) {
  const blocks = [];
  let previousType = "";

  for (const raw of lines) {
    const text = String(raw || "").trim();

    if (!text) {
      if (blocks.length && blocks[blocks.length - 1].type !== "spacer") {
        blocks.push({ type: "spacer" });
      }
      previousType = "spacer";
      continue;
    }

    // Remove page/export artifacts and duplicated source document title lines.
    if (/^CHOSEN:\s*THE STORY BEFORE THE\s*MANGER$/i.test(text)) continue;
    if (/^THE STORY BEFORE THE MANGER$/i.test(text)) continue;

    const type = lineType(text, previousType);

    blocks.push({
      type,
      text
    });

    if (type !== "spacer") {
      previousType = type;
    }
  }

  while (blocks[0]?.type === "spacer") blocks.shift();
  while (blocks[blocks.length - 1]?.type === "spacer") blocks.pop();

  return blocks;
}

function cleanBlockText(value = "") {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "")
    .trim()
    .replace(/[:：]+$/, "")
    .replace(/\s+/g, " ");
}

function explodeBlocksForSpeakerRepair(blocks = []) {
  const expanded = [];

  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;

    const type = String(block.type || "").trim() || "text";
    const rawText = String(block.text || "")
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/\u200b/g, "")
      .trim();

    if (!rawText) {
      expanded.push({ ...block, type: "spacer", text: "" });
      continue;
    }

    const parts = rawText
      .split(/\n+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length <= 1) {
      expanded.push({ ...block, type, text: rawText });
      continue;
    }

    for (const part of parts) {
      expanded.push({ ...block, type, text: part });
    }
  }

  return expanded;
}

function nextNonEmptyBlockIndex(blocks, startIndex) {
  let index = startIndex;

  while (index < blocks.length) {
    const text = cleanBlockText(blocks[index]?.text || "");
    if (text) return index;
    index += 1;
  }

  return -1;
}

function reclassifyBlocksForReader(blocks = []) {
  const output = [];
  let previousType = "";

  for (const block of blocks) {
    const text = cleanBlockText(block?.text || "");

    if (!text) {
      if (output.length && output[output.length - 1].type !== "spacer") {
        output.push({ type: "spacer" });
      }
      previousType = "spacer";
      continue;
    }

    const type = block._semantic === true && SEMANTIC_BLOCK_TYPES.has(block.type)
      ? block.type
      : lineType(text, previousType);

    output.push({ type, text });

    if (type !== "spacer") {
      previousType = type;
    }
  }

  while (output[0]?.type === "spacer") output.shift();
  while (output[output.length - 1]?.type === "spacer") output.pop();

  return output;
}

function repairSpeakerNumberBlocks(blocks = []) {
  const work = explodeBlocksForSpeakerRepair(blocks);
  const repaired = [];

  for (let index = 0; index < work.length; index += 1) {
    const block = work[index] || {};
    const text = cleanBlockText(block.text || "");

    if (!text) {
      if (repaired.length && repaired[repaired.length - 1].type !== "spacer") {
        repaired.push({ type: "spacer" });
      }
      continue;
    }

    const numberIndex = nextNonEmptyBlockIndex(work, index + 1);
    const nextText = numberIndex >= 0 ? cleanBlockText(work[numberIndex]?.text || "") : "";

    if (isRepairableNumberedSpeaker(text, nextText)) {
      const combined = `${text} ${nextText}`.replace(/\s+/g, " ").trim();

      repaired.push({
        ...block,
        type: "character",
        text: combined
      });

      index = numberIndex;
      continue;
    }

    repaired.push({
      ...block,
      text
    });
  }

  return reclassifyBlocksForReader(repaired);
}

function finalRepairBlocksForPublication(blocks = []) {
  // Belt-and-suspenders cleanup immediately before writing JSON.
  // This makes the fix permanent even if a future Google Docs feed shape changes.
  return repairContextualSemantics(repairSpeakerNumberBlocks(blocks));
}

function isNarrativeStageDirection(text = "") {
  const value = cleanBlockText(text);
  if (!value) return false;

  const subject = "(?:Mary|Joseph|Nia|Simon|Shira|Talia|Adina|Dafna|Levi|Caleb|Ezra|Gabriel|Eli|Malachi|Child(?:ren)?|Shepherd(?: \\d+)?|Villager(?: Woman| Man)?(?: \\d+)?|Gossiper(?: \\d+)?|The children|The company|Everyone|No one|He|She|They)";
  const action = "(?:answers?|arrives?|begins?|crosses?|enters?|exits?|exhales?|finishes?|follows?|freezes?|hesitates?|imagines?|joins?|looks?|lowers?|moves?|nods?|notices?|pauses?|reacts?|remains?|runs?|sees?|shifts?|sits?|smiles?|stares?|stays?|steps?|stops?|takes?|turns?|walks?|watches?)";

  return new RegExp(`^${subject}\\s+${action}\\b`, "i").test(value) ||
    /^(Beat\.?|Silence\.?|Immediate murmuring\.?|A conversation slows\.?|A light musical pulse begins\.?|The simple line hangs there\.?|That (?:hurts|surprises)\b)/i.test(value);
}

function isSongSectionHeading(text = "") {
  return /^(?:VERSE|CHORUS|BRIDGE|REFRAIN|PRE-CHORUS|TAG|OUTRO|SONG(?: BEGINS)?|MUSICAL NUMBER)\b/i.test(cleanBlockText(text));
}

function isSongEndHeading(text = "") {
  return /^(?:SONG|MUSIC|NUMBER)\s+ENDS?\b/i.test(cleanBlockText(text));
}

function repairContextualSemantics(blocks = []) {
  const output = [];
  let inCastList = false;
  let inSong = false;

  for (const original of blocks) {
    const block = { ...original };
    const text = cleanBlockText(block.text || "");
    const type = String(block.type || "").toLowerCase();

    if (/^characters:?$/i.test(text)) {
      inCastList = true;
      block.type = "production-note";
      output.push(block);
      continue;
    }

    if (inCastList) {
      if (type === "spacer" || ["heading", "transition", "music"].includes(type)) {
        inCastList = false;
      } else {
        block.type = "production-note";
        output.push(block);
        continue;
      }
    }

    if (isSongEndHeading(text)) {
      block.type = "transition";
      inSong = false;
      output.push(block);
      continue;
    }

    if (isSongSectionHeading(text)) {
      block.type = "music";
      inSong = true;
      output.push(block);
      continue;
    }

    if (isKnownSpeaker(text)) {
      block.type = "character";
    } else if (isNarrativeStageDirection(text)) {
      block.type = "stage";
    } else if (inSong && ["dialogue", "stage", "lyric"].includes(type)) {
      block.type = "lyric";
    }

    output.push(block);
  }

  return output;
}

function blocksToSourceText(blocks = []) {
  return blocks
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      if (String(block.type || "").trim() === "spacer") return "";
      return String(block.text || "").trim();
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}



function normalizeBlocksForPublication(scene = {}) {
  const rawText = normalizeNewlines(scene.text || scene.sourceText || "");
  const rawBlocks = Array.isArray(scene.blocks) ? scene.blocks : [];

  // Preferred path: preserve explicit semantic types/styles supplied by the
  // document feed. Text heuristics are only a compatibility fallback.
  const semanticBlocks = rawBlocks.map((block) => {
    const semanticType = explicitBlockType(block);
    return semanticType ? { ...block, type: semanticType, _semantic: true } : { ...block };
  });
  const hasSemanticBlocks = semanticBlocks.some((block) => block._semantic === true);

  if (hasSemanticBlocks) {
    return finalRepairBlocksForPublication(semanticBlocks);
  }

  // Legacy path: treat unstyled scene content as lines.
  // This catches every form Google Docs has produced so far and keeps the repair global:
  // - MERCHANT + 1 as separate blocks
  // - MERCHANT + blank/spacer + 1
  // - "MERCHANT\n1" inside one block
  // - source text containing "MERCHANT\n1"
  const textForLineRepair = rawText || blocksToSourceText(explodeBlocksForSpeakerRepair(rawBlocks));

  if (textForLineRepair) {
    return finalRepairBlocksForPublication(
      linesToBlocks(compactScriptLines(textForLineRepair))
    );
  }

  return finalRepairBlocksForPublication(rawBlocks);
}


function assertNoSplitSpeakerNumberBlocks(scenes = []) {
  const problems = [];

  for (const scene of scenes) {
    const blocks = explodeBlocksForSpeakerRepair(
      Array.isArray(scene.blocks) ? scene.blocks : []
    );

    for (let index = 0; index < blocks.length; index += 1) {
      const text = cleanBlockText(blocks[index]?.text || "");
      if (!text) continue;

      const numberIndex = nextNonEmptyBlockIndex(blocks, index + 1);
      const nextText = numberIndex >= 0 ? cleanBlockText(blocks[numberIndex]?.text || "") : "";

      if (isRepairableNumberedSpeaker(text, nextText)) {
        const combined = `${text} ${nextText}`.replace(/\s+/g, " ").trim();
        problems.push(`Scene ${scene.scene}: ${text} + ${nextText} should be ${combined}`);
      }
    }
  }

  if (problems.length) {
    fail(
      `Split numbered speaker names remain after final repair: ${problems
        .slice(0, 20)
        .join("; ")}${problems.length > 20 ? " ..." : ""}`
    );
  }
}

async function fetchFeed() {
  if (process.env.SCRIPT_DOC_FEED_FILE) {
    const file = path.resolve(process.env.SCRIPT_DOC_FEED_FILE);
    if (!fs.existsSync(file)) {
      fail(`SCRIPT_DOC_FEED_FILE does not exist: ${file}`);
    }

    return JSON.parse(fs.readFileSync(file, "utf8"));
  }

  const url = process.env.SCRIPT_DOC_FEED_URL;

  if (!url) {
    if (process.env.GITHUB_EVENT_NAME === "repository_dispatch") {
      fail("SCRIPT_DOC_FEED_URL secret is required for publish-script dispatch runs.");
    }

    info("SCRIPT_DOC_FEED_URL is not set. Skipping master script sync.");
    process.exit(0);
  }

  const response = await fetch(url, {
    headers: {
      "Accept": "application/json"
    }
  });

  const body = await response.text();

  if (!response.ok) {
    fail(`Script feed request failed with HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    fail(`Script feed did not return JSON: ${error.message}. First 300 chars: ${body.slice(0, 300)}`);
  }
}

function normalizeFeedToScenes(feed) {
  if (!feed || typeof feed !== "object") {
    fail("Script feed is empty or invalid.");
  }

  if (feed.ok === false) {
    fail(feed.error || "Script feed returned ok=false.");
  }

  let scenes = [];

  if (Array.isArray(feed.scenes) && feed.scenes.length) {
    scenes = feed.scenes.map((scene) => {
      const sceneNumber = normalizeSceneNumber(scene.scene || scene.sceneNumber);
      const rawText = normalizeNewlines(scene.text || scene.sourceText || "");
      const repairedBlocks = normalizeBlocksForPublication(scene);

      return {
        scene: sceneNumber,
        title: titleForManifest(sceneNumber, scene.title || ""),
        sourceText: blocksToSourceText(repairedBlocks) || rawText,
        blocks: repairedBlocks
      };
    });
  } else {
    const text = feed.text || feed.sourceText || "";
    if (!text) {
      fail("Script feed must include either scenes[] or text.");
    }

    scenes = extractScenesFromText(text);
  }

  const feedText = normalizeNewlines(feed.text || feed.sourceText || "");
  let missing = [];

  for (const sceneNumber of EXPECTED_SCENES) {
    if (!scenes.find((scene) => scene.scene === sceneNumber)) {
      missing.push(sceneNumber);
    }
  }

  // If a future feed sends scenes[] but one is missing, try the full text as a repair source.
  if (missing.length && feedText) {
    const parsedFromText = extractScenesFromText(feedText);
    for (const repaired of parsedFromText) {
      if (missing.includes(repaired.scene) && !scenes.find((scene) => scene.scene === repaired.scene)) {
        scenes.push(repaired);
      }
    }

    missing = [];
    for (const sceneNumber of EXPECTED_SCENES) {
      if (!scenes.find((scene) => scene.scene === sceneNumber)) {
        missing.push(sceneNumber);
      }
    }
  }

  if (missing.length) {
    const found = scenes
      .filter((scene) => EXPECTED_SCENES.has(scene.scene))
      .map((scene) => scene.scene)
      .sort()
      .join(", ") || "none";

    const sceneLikeLines = feedText
      ? compactScriptLines(feedText)
          .filter((line) => /\bSCENE\b/i.test(line))
          .slice(0, 20)
          .join(" | ")
      : "no full text available";

    console.error(`Found scene(s): ${found}.`);
    console.error(`First scene-like feed lines: ${sceneLikeLines}`);
    fail(`Missing scene(s) from master script feed: ${missing.join(", ")}.`);
  }

  return scenes
    .filter((scene) => EXPECTED_SCENES.has(scene.scene))
    .sort((a, b) => a.scene.localeCompare(b.scene));
}

function writeSceneJson(scene, feedMeta = {}) {
  const fileName = `scene-${scene.scene}.json`;
  const filePath = path.join(SCENES_DIR, fileName);
  const finalBlocks = finalRepairBlocksForPublication(Array.isArray(scene.blocks) ? scene.blocks : []);
  const sourceText = normalizeNewlines(blocksToSourceText(finalBlocks) || scene.sourceText || "");

  const payload = {
    scene: scene.scene,
    title: scene.title,
    status: "CURRENT · Auto-published from master script",
    approved: true,
    companyPublish: true,
    source: "Master script Google Doc",
    sourceDocTitle: feedMeta.documentName || feedMeta.title || "",
    sourceUpdated: feedMeta.updated || new Date().toISOString(),
    contentHash: sha256(sourceText),
    publicationNote: "This scene was auto-published from the CHOSEN master script.",
    blocks: finalBlocks
      .filter((block) => block && typeof block === "object")
      .map((block) => ({
        type: String(block.type || "text").trim() || "text",
        text: String(block.text || "").trim()
      }))
      .filter((block) => block.type === "spacer" || block.text)
  };

  if (!payload.blocks.length) {
    fail(`Scene ${scene.scene} has no publishable blocks.`);
  }

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + "\n", "utf8");

  return fileName;
}

function writeScriptsManifest(scenes, feedMeta = {}) {
  const updated = feedMeta.updated || new Date().toISOString();

  const items = scenes.map((scene) => ({
    scene: scene.scene,
    title: scene.title,
    status: "CURRENT · Auto-published from master script",
    approved: true,
    companyPublish: true,
    source: `data/scenes/scene-${scene.scene}.json`,
    readUrl: `scene-${scene.scene}.html`,
    pdfUrl: `scene-${scene.scene}.pdf`,
    id: slugify(scene.title),
    name: scene.title,
    current: true,
    updated
  }));

  fs.writeFileSync(SCRIPTS_FILE, JSON.stringify(items, null, 2) + "\n", "utf8");
}

function main() {
  return fetchFeed().then((feed) => {
    const scenes = normalizeFeedToScenes(feed);
    assertNoSplitSpeakerNumberBlocks(scenes);
    ensureDir(SCENES_DIR);

    for (const scene of scenes) {
      writeSceneJson(scene, feed);
      console.log(`✅ Scene ${scene.scene}: synced ${scene.title}`);
    }

    writeScriptsManifest(scenes, feed);

    console.log("");
    console.log(`✅ Synced ${scenes.length} scenes from master script.`);
    console.log("✅ Verified no split numbered speaker names remain across all synced scenes after final pre-write repair.");
    console.log("✅ Wrote data/scripts.json.");
    console.log("✅ Wrote data/scenes/scene-##.json.");
  });
}

main().catch((error) => {
  fail(error?.stack || error?.message || String(error));
});
