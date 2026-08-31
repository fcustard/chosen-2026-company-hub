import fs from 'node:fs';

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));

const scripts = read('data/scripts.json');
const music = read('data/music.json');
const rehearsals = read('data/rehearsals.json');

const errors = [];

// SCRIPT SAFETY CHECKS
for (const s of scripts) {
  if (s.companyPublish && !s.approved) {
    errors.push(
      `SCRIPT ${s.scene}: companyPublish=true but approved=false`
    );
  }

  if (
    s.companyPublish &&
    (!s.readUrl ||
      s.readUrl === '#' ||
      !s.pdfUrl ||
      s.pdfUrl === '#')
  ) {
    errors.push(
      `SCRIPT ${s.scene}: published script is missing Read/PDF URLs`
    );
  }
}

// MUSIC SAFETY CHECKS
for (const m of music) {
  if (m.companyPublish && !m.approved) {
    errors.push(
      `MUSIC ${m.title}: companyPublish=true but approved=false`
    );
  }

  if (
    m.companyPublish &&
    (!m.playUrl || m.playUrl === '#')
  ) {
    errors.push(
      `MUSIC ${m.title}: published track has no playUrl`
    );
  }
}

// REHEARSAL DATA CHECKS
for (const r of rehearsals) {
  if (!r.id || !r.start || !r.end || !r.title) {
    errors.push(
      `REHEARSAL: missing required field in ${r.id || 'unknown rehearsal'}`
    );
  }

  if (new Date(r.end) <= new Date(r.start)) {
    errors.push(
      `REHEARSAL ${r.id}: end must be after start`
    );
  }
}

// STOP AUTOMATION IF SOMETHING IS WRONG
if (errors.length) {
  console.error('\nCHOSEN HUB VALIDATION FAILED\n');

  errors.forEach(error => {
    console.error('• ' + error);
  });

  process.exit(1);
}

console.log(
  `Validation passed: ${scripts.length} script records, ` +
  `${music.length} music records, ` +
  `${rehearsals.length} rehearsal records.`
);
