import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, "data", "rehearsals.json");
const args = process.argv.slice(2);

function argValue(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

function fail(message) {
  console.error(`❌ CALENDAR SYNC ERROR: ${message}`);
  process.exit(1);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateRecord(r, index) {
  const label = `record ${index + 1}`;
  if (!r || typeof r !== "object") fail(`${label} is not an object.`);
  for (const field of ["id","start","end","title","location","status"]) {
    if (!nonEmpty(String(r[field] ?? ""))) fail(`${label} is missing ${field}.`);
  }
  if (r.publish !== true) fail(`${label} is not marked publish=true.`);

  const start = Date.parse(r.start);
  const end = Date.parse(r.end);
  if (Number.isNaN(start)) fail(`${label} has an invalid start date-time.`);
  if (Number.isNaN(end)) fail(`${label} has an invalid end date-time.`);
  if (end <= start) fail(`${label} ends before or at its start time.`);

  const forbidden = ["internalNotes","facilityStatus","calendarEventId","tfcResponse","productionAction"];
  for (const field of forbidden) {
    if (Object.hasOwn(r, field)) fail(`${label} contains private field "${field}".`);
  }
}

async function loadPayload() {
  const localFile = argValue("--file");
  if (localFile) {
    return JSON.parse(fs.readFileSync(localFile, "utf8"));
  }

  const baseUrl = process.env.CALENDAR_FEED_URL;
  if (!nonEmpty(baseUrl)) {
    fail("CALENDAR_FEED_URL repository variable is not configured.");
  }

  const url = new URL(baseUrl);
  url.searchParams.set("_ts", String(Date.now()));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: controller.signal
    });
    if (!response.ok) fail(`Feed returned HTTP ${response.status}.`);

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    if (!contentType.includes("json") && /^[\s\r\n]*</.test(text)) {
      fail("Calendar feed returned HTML, not JSON. Hub data was NOT changed.");
    }

    try {
      return JSON.parse(text);
    } catch {
      fail("Calendar feed did not return valid JSON. Hub data was NOT changed.");
    }
  } catch (error) {
    if (error?.name === "AbortError") fail("Calendar feed timed out. Hub data was NOT changed.");
    fail(`${error.message}. Hub data was NOT changed.`);
  } finally {
    clearTimeout(timer);
  }
}

const payload = await loadPayload();

if (payload?.ok === false) fail(payload.error || "Calendar feed reported an error.");

const records = Array.isArray(payload) ? payload : payload?.rehearsals;
if (!Array.isArray(records)) {
  fail('Feed must be an array or an object containing a "rehearsals" array.');
}
if (!records.length) fail("Feed returned zero publishable rehearsals; refusing to overwrite the last good schedule.");

records.forEach(validateRecord);
records.sort((a,b) => Date.parse(a.start) - Date.parse(b.start));

const seen = new Set();
for (const r of records) {
  const key = r.eventKey || `${r.id}|${r.start}`;
  if (seen.has(key)) fail(`Duplicate rehearsal key detected: ${key}`);
  seen.add(key);
}

const normalized = records.map(r => ({
  id: String(r.id),
  start: r.start,
  end: r.end,
  dateLabel: r.dateLabel || "",
  dayLabel: r.dayLabel || "",
  title: r.title,
  location: r.location,
  locationShort: r.locationShort || r.location,
  called: r.called || "",
  callGroups: r.callGroups || "",
  work: r.work || "",
  focus: r.focus || "",
  prep: r.prep || "",
  status: r.status,
  changeType: r.changeType || "",
  eventKey: r.eventKey || "",
  publish: true
}));

const tmp = OUTPUT + ".tmp";
fs.writeFileSync(tmp, JSON.stringify(normalized, null, 2) + "\n", "utf8");
fs.renameSync(tmp, OUTPUT);

console.log(`✅ Calendar sync prepared ${normalized.length} publishable rehearsal record(s).`);
console.log(`✅ Wrote ${path.relative(ROOT, OUTPUT)} only after complete validation.`);
