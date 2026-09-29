/**
 * Source for the bound Master Calendar Apps Script deployment (version 14).
 * The hub-v2 builder calls:
 *   const rehearsals = attachPersonalCallsToHubFeed_(
 *     exactReadRehearsals_(master, peopleIndex), calendarSS);
 * Personal Calls is the editable source of individual report and release times.
 */
function attachPersonalCallsToHubFeed_(rehearsals, spreadsheet) {
  const sheet = spreadsheet.getSheetByName('Personal Calls');
  if (!sheet) throw new Error('Personal Calls tab is missing.');
  const values = sheet.getDataRange().getDisplayValues();
  const expected = ['Event Key', 'Date', 'Person ID', 'Person',
    'Report Time', 'Release Time', 'Status'];
  if (expected.some((name, index) => values[0]?.[index] !== name)) {
    throw new Error('Personal Calls header does not match the feed contract.');
  }

  const byEvent = new Map();
  const clock = value => {
    const match = String(value || '').trim().match(/^([0-9]{1,2}):([0-9]{2}) (AM|PM)$/);
    if (!match || Number(match[1]) < 1 || Number(match[1]) > 12 ||
        Number(match[2]) > 59) return NaN;
    return (Number(match[1]) % 12) * 60 + Number(match[2]) +
      (match[3] === 'PM' ? 720 : 0);
  };

  for (let index = 1; index < values.length; index += 1) {
    const [key, , personId, name, report, release, status] = values[index];
    if (!key && !personId && !name && !report && !release && !status) continue;
    if (status !== 'READY' || !key || !personId || !name ||
        !Number.isFinite(clock(report)) || !Number.isFinite(clock(release)) ||
        clock(release) <= clock(report)) {
      throw new Error(`Invalid Personal Calls row ${index + 1}.`);
    }
    if (!byEvent.has(key)) byEvent.set(key, []);
    const rows = byEvent.get(key);
    if (rows.some(row => row.personId === personId)) {
      throw new Error(`Duplicate Personal Calls event/person at row ${index + 1}.`);
    }
    rows.push({ personId, name, report, release });
  }

  const rehearsalsByKey = new Map(rehearsals.map(event => [
    String(event.eventKey || event.id), event
  ]));
  for (const [key, rows] of byEvent) {
    const event = rehearsalsByKey.get(key);
    if (!event || event.exactCallStatus !== 'READY') {
      throw new Error(`${key}: Personal Calls has no matching READY rehearsal.`);
    }
    const ids = new Set(rows.map(row => row.personId));
    for (const id of event.calledPeopleIds || []) {
      if (!ids.has(id)) {
        throw new Error(`${key}: source called person ${id} has no personal window.`);
      }
    }
    // The tab provides the complete roster, including members previously
    // represented by a broad group. Every person has an explicit window.
    event.calledPeopleIds = rows.map(row => row.personId);
    event.calledPeople = rows.map(row => row.name);
    event.calledGroups = [];
    event.personalCallTimes = Object.fromEntries(
      rows.map(row => [row.personId, row.report]));
    event.personalCallEndTimes = Object.fromEntries(
      rows.map(row => [row.personId, row.release]));
  }
  return rehearsals;
}

function validatePersonalCallsFeed() {
  const data = JSON.parse(buildChosenHubV2Response_().getContent());
  const enriched = data.rehearsals.filter(event => event.personalCallTimes);
  if (enriched.length !== 5) throw new Error('Expected five personal-call events, got ' + enriched.length);
  Logger.log('Validated ' + enriched.length + ' personal-call events and ' + enriched.reduce((n, event) => n + Object.keys(event.personalCallTimes).length, 0) + ' person windows.');
}
