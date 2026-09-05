import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const SCRIPTS_FILE = path.join(ROOT, "data", "scripts.json");
const SCENES_DIR = path.join(ROOT, "data", "scenes");

const KNOWN_SPEAKERS = new Set([
  "MARY",
  "JOSEPH",
  "GABRIEL",
  "ELIZABETH",
  "SHIRA",
  "TALIA",
  "ADINA",
  "DAFNA",
  "LEVI",
  "MALACHI",
  "CALEB",
  "EZRA",
  "NIA",
  "SIMON",
  "LUCIA",
  "ANNA",
  "HEROD",
  "ROMAN",
  "ROMAN ANNOUNCER",
  "ANNOUNCER",
  "KEEPER",
  "INNKEEPER",
  "INNKEEPER 1",
  "INNKEEPER 2",
  "INNKEEPER 3",
  "INNKEEPER'S WIFE",
  "BETHLEHEM WOMAN",
  "WOMAN",
  "MAN",
  "CHILD",
  "CHILD 1",
  "CHILD 2",
  "CHILD 3",
  "SHEPHERD",
  "SHEPHERD 1",
  "SHEPHERD 2",
  "SHEPHERD 3",
  "YOUNG SHEPHERD",
  "ANGEL",
  "ANGELS",
  "WISE MAN",
  "WISE MEN",
  "VILLAGER",
  "VILLAGERS",
  "MERCHANT",
  "MERCHANT 1",
  "MERCHANT 2",
  "CUSTOMER",
  "CUSTOMER 1",
  "COSTUMER",
  "GOSSIPER",
  "GOSSIPER 1",
  "GOSSIPER 2",
  "GOSSIPER 3",
  "GOSSIPER 4",
  "GOSSIP GIRLS",
  "COMPANY",
  "ENSEMBLE",
  "DANCERS",
  "FRIENDS",
  "MARY'S FRIENDS",
  "JOSEPH'S FRIENDS"
]);

const NON_SPEAKER_ALL_CAPS = new Set([
  "CHOSEN",
  "CHOSEN: THE STORY BEFORE THE MANGER",
  "THE STORY BEFORE THE MANGER",
  "CURRENT",
  "COMPANY VERSION",
  "OFFICIAL COMPANY MATERIAL",
  "PRESET",
  "SCENE",
  "SONG",
  "MUSIC",
  "MUSICAL NUMBER",
  "MUSICAL SEQUENCE",
  "CONTINUOUS FROM SCENE 1",
  "CONTINUOUS FROM SCENE 2",
  "CONTINUOUS FROM SCENE 3",
  "CONTINUOUS FROM SCENE 4",
  "CONTINUOUS FROM SCENE 5",
  "CONTINUOUS FROM SCENE 6",
  "CONTINUOUS FROM SCENE 7",
  "CONTINUOUS FROM SCENE 8",
  "CONTINUOUS FROM SCENE 9",
  "CONTINUOUS FROM SCENE 10",
  "CONTINUOUS FROM SCENE 11",
  "CONTINUOUS FROM SCENE 12"
]);

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
  const raw = String(value ?? "").trim();

  if (!raw) {
    return "";
  }

  if (/^full$/i.test(raw)) {
    return "FULL";
  }

  const numeric = raw.replace(/^scene[-_\s]*/i, "");

  return numeric.padStart(2, "0");
}

function sceneDisplayNumber(sceneNumber) {
  if (sceneNumber === "FULL") {
    return "Full Script";
  }

  const n = Number(sceneNumber);

  return Number.isFinite(n)
    ? `Scene ${n}`
    : `Scene ${sceneNumber}`;
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanText(value = "") {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizeCaps(value = "") {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function stripSpeakerPunctuation(value = "") {
  return cleanText(value)
    .replace(/[.:;,\-–—]+$/g, "")
    .trim();
}

function isMostlyAllCaps(value = "") {
  const text = cleanText(value);

  if (!text) {
    return false;
  }

  const letters = text.match(/[A-Za-z]/g) || [];

  if (!letters.length) {
    return false;
  }

  const lowercase = text.match(/[a-z]/g) || [];

  return lowercase.length === 0;
}

function isKnownSpeaker(value = "") {
  const normalized = normalizeCaps(stripSpeakerPunctuation(value));

  return KNOWN_SPEAKERS.has(normalized);
}

function isNonSpeakerAllCaps(value = "") {
  const normalized = normalizeCaps(stripSpeakerPunctuation(value));

  if (NON_SPEAKER_ALL_CAPS.has(normalized)) {
    return true;
  }

  if (/^SCENE\s+\d{1,2}\b/.test(normalized)) {
    return true;
  }

  if (/^ACT\s+\d{1,2}\b/.test(normalized)) {
    return true;
  }

  if (/^(APPROXIMATE|RUNNING TIME|MUSICAL|SPOKEN|SONG|CHARACTERS)\b/.test(normalized)) {
    return true;
  }

  return false;
}

function splitInlineSpeakerCue(rawText = "") {
  const text = cleanText(rawText);

  if (!text) {
    return null;
  }

  /*
   * Handles:
   *   LEVI Hold on.
   *   JOSEPH Customer's.
   *   EZRA And you've checked that corner four times.
   *   MARY: I am here.
   *   JOSEPH — I want to.
   */
  const withPunctuation = text.match(
    /^([A-Z][A-Z0-9'’/&.\- ]{1,42}?)[\s]*[:–—-][\s]+(.+)$/
  );

  if (withPunctuation) {
    const speaker = stripSpeakerPunctuation(withPunctuation[1]);
    const dialogue = cleanText(withPunctuation[2]);

    if (isKnownSpeaker(speaker) && dialogue) {
      return {
        speaker: normalizeCaps(speaker),
        dialogue
      };
    }
  }

  const words = text.split(/\s+/);

  for (let count = Math.min(4, words.length - 1); count >= 1; count -= 1) {
    const candidate = words.slice(0, count).join(" ");
    const remainder = words.slice(count).join(" ");

    if (!remainder) {
      continue;
    }

    if (!isMostlyAllCaps(candidate)) {
      continue;
    }

    if (!isKnownSpeaker(candidate)) {
      continue;
    }

    return {
      speaker: normalizeCaps(candidate),
      dialogue: remainder
    };
  }

  return null;
}

function renderCharacterCue(text) {
  return `<p class="character">${escapeHtml(normalizeCaps(text))}</p>`;
}

function renderDialogue(text) {
  return `<p class="dialogue">${escapeHtml(text)}</p>`;
}

function renderStageDirection(text) {
  return `<p class="stageDirection"><em>${escapeHtml(text)}</em></p>`;
}

function renderHeading(text) {
  return `<h3 class="scriptHeading">${escapeHtml(text)}</h3>`;
}

function renderMusicCue(text) {
  return `<p class="musicCue">${escapeHtml(text)}</p>`;
}

function renderLyric(text) {
  return `<p class="lyric">${escapeHtml(text)}</p>`;
}

function renderPlain(text) {
  return `<p>${escapeHtml(text)}</p>`;
}

function renderPossiblyInlineSpeaker(text, fallbackRenderer = renderPlain) {
  const cue = splitInlineSpeakerCue(text);

  if (cue) {
    return `${renderCharacterCue(cue.speaker)}\n${renderDialogue(cue.dialogue)}`;
  }

  return fallbackRenderer(text);
}

function renderBlock(block) {
  if (!block || typeof block !== "object") {
    return "";
  }

  const type = cleanText(block.type || "text").toLowerCase();
  const text = cleanText(block.text || block.content || block.line || "");

  if (!text && type !== "spacer") {
    return "";
  }

  /*
   * Some scene source files contain speaker/dialogue as separate fields.
   * Preserve that cleanly when present.
   */
  const speakerField =
    cleanText(block.speaker || block.character || block.name || "");

  const dialogueField =
    cleanText(block.dialogue || block.lineText || "");

  if (speakerField && dialogueField && isKnownSpeaker(speakerField)) {
    return `${renderCharacterCue(speakerField)}\n${renderDialogue(dialogueField)}`;
  }

  switch (type) {
    case "heading":
      return renderHeading(text);

    case "character": {
      const inline = splitInlineSpeakerCue(text);

      if (inline) {
        return `${renderCharacterCue(inline.speaker)}\n${renderDialogue(inline.dialogue)}`;
      }

      if (isKnownSpeaker(text)) {
        return renderCharacterCue(text);
      }

      return renderHeading(text);
    }

    case "dialogue":
      return renderPossiblyInlineSpeaker(text, renderDialogue);

    case "stage":
    case "direction":
      /*
       * Repair source files where dialogue lines were mislabeled as
       * stage directions, e.g. "LEVI Hold on." The previous build
       * rendered those as italic directions. This is the Scene 5 bug.
       */
      return renderPossiblyInlineSpeaker(text, renderStageDirection);

    case "lyric":
      return renderPossiblyInlineSpeaker(text, renderLyric);

    case "music":
      return renderMusicCue(text);

    case "transition":
      return renderMusicCue(text);

    case "spacer":
      return `<div class="scriptSpacer" aria-hidden="true"></div>`;

    case "text":
    default: {
      if (isKnownSpeaker(text)) {
        return renderCharacterCue(text);
      }

      if (isMostlyAllCaps(text) && isNonSpeakerAllCaps(text)) {
        return renderHeading(text);
      }

      return renderPossiblyInlineSpeaker(text, renderPlain);
    }
  }
}

function renderSceneReader({
  sceneNumber,
  title,
  status,
  eyebrow,
  pdfUrl,
  publicationNote,
  content
}) {
  const displayScene = sceneDisplayNumber(sceneNumber);

  const safeTitle = escapeHtml(title || displayScene);
  const safeStatus = escapeHtml(status || "CURRENT");
  const safeEyebrow = escapeHtml(eyebrow || "CURRENT · COMPANY VERSION");
  const safePdfUrl = escapeHtml(pdfUrl || "#");
  const safePublicationNote = escapeHtml(
    publicationNote || "This is the official company rehearsal version."
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#0d1726">
  <title>${safeTitle} | CHOSEN 2026</title>
  <link rel="stylesheet" href="styles.css">
  <style>
    :root {
      --chosen-navy: #0d1726;
      --chosen-gold: #e7b957;
      --chosen-cream: #f4efe5;
      --chosen-ivory: #fffaf0;
      --chosen-ink: #111827;
      --chosen-muted: #566276;
      --chosen-line: rgba(13, 23, 38, 0.14);
      --chosen-note: #fff2c7;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      background: var(--chosen-cream);
      color: var(--chosen-ink);
    }

    .readerShell {
      max-width: 860px;
      margin: 0 auto;
      padding: 64px 24px 96px;
    }

    .readerHero {
      margin-bottom: 28px;
    }

    .readerEyebrow {
      margin: 0 0 14px;
      color: #9a6a00;
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.22em;
      text-transform: uppercase;
    }

    .readerHeroGrid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 24px;
      align-items: end;
    }

    .readerHero h1 {
      margin: 0;
      color: var(--chosen-navy);
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(3.4rem, 10vw, 5.4rem);
      line-height: 0.92;
      letter-spacing: -0.055em;
    }

    .readerHero h2 {
      margin: 12px 0 0;
      color: var(--chosen-navy);
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(1.55rem, 4vw, 2rem);
      line-height: 1.1;
    }

    .readerStatus {
      margin: 16px 0 0;
      color: var(--chosen-muted);
      font-size: 1rem;
      line-height: 1.5;
    }

    .readerActions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: center;
    }

    .readerActions .btn {
      white-space: nowrap;
    }

    .readerRule {
      height: 1px;
      background: var(--chosen-line);
      margin: 26px 0 26px;
    }

    .officialNotice {
      margin: 0 0 28px;
      padding: 18px 20px;
      background: var(--chosen-note);
      border-left: 4px solid var(--chosen-gold);
      border-radius: 14px;
      box-shadow: 0 1px 0 rgba(13, 23, 38, 0.04);
    }

    .officialNotice b {
      display: block;
      margin-bottom: 6px;
      color: var(--chosen-navy);
      font-size: 0.95rem;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    .officialNotice p {
      margin: 0;
      line-height: 1.45;
    }

    .scriptPage {
      background: rgba(255, 255, 255, 0.58);
      border: 1px solid var(--chosen-line);
      border-radius: 18px;
      box-shadow: 0 18px 40px rgba(13, 23, 38, 0.06);
      padding: clamp(28px, 6vw, 52px);
    }

    .scriptContent {
      max-width: 760px;
    }

    .scriptContent p {
      margin: 0 0 1.05rem;
      font-size: 1.02rem;
      line-height: 1.62;
    }

    .scriptContent .scriptHeading {
      margin: 2rem 0 1rem;
      padding-top: 1.2rem;
      border-top: 1px solid var(--chosen-line);
      color: #9a6a00;
      font-family: inherit;
      font-size: 0.92rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      line-height: 1.35;
      text-transform: uppercase;
    }

    .scriptContent .scriptHeading:first-child {
      margin-top: 0;
      padding-top: 0;
      border-top: 0;
    }

    .scriptContent .character {
      margin: 1.25rem 0 0.25rem;
      color: var(--chosen-navy);
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .scriptContent .dialogue {
      margin-left: 1.25rem;
      max-width: 690px;
      color: var(--chosen-ink);
      font-style: normal;
    }

    .scriptContent .stageDirection {
      color: #41506a;
      font-style: italic;
    }

    .scriptContent .lyric {
      margin-left: 1.25rem;
      color: #25324a;
      font-style: italic;
    }

    .scriptContent .musicCue,
    .scriptContent .transition {
      color: #9a6a00;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .scriptSpacer {
      height: 1.25rem;
    }

    .readerFooterNav {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 28px;
    }

    @media (max-width: 760px) {
      .readerShell {
        padding: 42px 18px 72px;
      }

      .readerHeroGrid {
        grid-template-columns: 1fr;
        align-items: start;
      }

      .readerActions {
        justify-content: flex-start;
      }

      .scriptPage {
        padding: 24px 18px;
      }

      .scriptContent .dialogue,
      .scriptContent .lyric {
        margin-left: 0.5rem;
      }

      .readerFooterNav {
        flex-direction: column;
      }
    }

    @media print {
      .sitebar,
      .readerActions,
      .readerFooterNav {
        display: none !important;
      }

      body {
        background: white;
      }

      .readerShell {
        max-width: none;
        padding: 0;
      }

      .officialNotice {
        border: 1px solid #ddd;
        box-shadow: none;
      }

      .scriptPage {
        border: 0;
        box-shadow: none;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <header class="sitebar">
    <div class="inner">
      <a class="brand" href="index.html">
        <small>THE FAITH CENTER PRESENTS</small>
        <b>CHOSEN 2026</b>
        <span>Company Hub</span>
      </a>

      <nav id="nav">
        <a href="scripts.html">← Scripts</a>
      </nav>
    </div>
  </header>

  <main class="readerShell" id="top">
    <section class="readerHero" aria-labelledby="sceneTitle">
      <p class="readerEyebrow">${safeEyebrow}</p>

      <div class="readerHeroGrid">
        <div>
          <h1 id="sceneTitle">${escapeHtml(displayScene)}</h1>
          <h2>${safeTitle}</h2>
          <p class="readerStatus">${safeStatus}</p>
        </div>

        <div class="readerActions">
          <a class="btn primary" href="#script">Read scene</a>
          <a class="btn" href="${safePdfUrl}">PDF / Print</a>
        </div>
      </div>

      <div class="readerRule" aria-hidden="true"></div>
    </section>

    <aside class="officialNotice">
      <b>Official company material</b>
      <p>${safePublicationNote}</p>
    </aside>

    <article id="script" class="scriptPage">
      <div class="scriptContent">
${content}
      </div>
    </article>

    <nav class="readerFooterNav" aria-label="Scene reader navigation">
      <a class="btn" href="scripts.html">← Back to Scripts</a>
      <a class="btn primary" href="#top">Back to top</a>
    </nav>
  </main>
</body>
</html>
`;
}

const scripts = readJson(SCRIPTS_FILE);

if (!Array.isArray(scripts)) {
  fail("data/scripts.json must contain a JSON array.");
}

if (!fs.existsSync(SCENES_DIR)) {
  console.log("ℹ️ No data/scenes directory. No scene pages to build.");
  process.exit(0);
}

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

  if (!sceneNumber) {
    fail(`${path.relative(ROOT, scenePath)} has no scene number.`);
  }

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

  if (!manifest.readUrl || manifest.readUrl === "#") {
    fail(`Scene ${sceneNumber} has no usable readUrl.`);
  }

  if (!manifest.pdfUrl || manifest.pdfUrl === "#") {
    fail(`Scene ${sceneNumber} has no usable pdfUrl.`);
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

  const html = renderSceneReader({
    sceneNumber,
    title: scene.title || manifest.title,
    status: manifest.status || scene.status || "CURRENT",
    eyebrow: scene.eyebrow || "CURRENT · COMPANY VERSION",
    pdfUrl: manifest.pdfUrl,
    publicationNote:
      scene.publicationNote ||
      "This is the official company rehearsal version.",
    content
  });

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
