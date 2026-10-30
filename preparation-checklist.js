import { personMatchesCall, personalCallSummary } from './personal-calls.js?v=20261030-flow1';

export const preparationKey = 'chosen2026-preparation-v1';
const signature = value => JSON.stringify(value);

// Reminders acknowledge the published instructions, never attendance or call approval.
export function preparationChecklist(person, call, prep) {
  if (!person || !call || !personMatchesCall(person, call) ||
      /^(?:CANCELLED|CANCELED|NO REHEARSAL)$/i.test(call.status || '')) return null;
  const instructions = [call.title, call.start, call.end, call.time, call.location,
    call.locationShort, personalCallSummary(person, call), call.work, call.focus,
    call.prep, call.notice, call.exactCallStatus];
  const tasks = [{ id:'call', label:'I checked the full call instructions', signature:signature(instructions) }];
  if (prep.scripts.length) tasks.push({ id:'scripts', label:'I reviewed my assigned scene scripts',
    signature:signature(prep.scripts.map(item => [item.scene, item.title, item.readUrl, item.contentHash || ''])) });
  if (prep.music.length) tasks.push({ id:'music', label:'I practiced the tracks my leader assigned',
    signature:signature(prep.music.map(item => [item.id || item.title, item.title, item.playUrl, item.version || ''])) });
  tasks.push({ id:'pack', label:'I checked what to prepare and bring', signature:signature(instructions) });
  return { scope:signature([person.id, call.eventKey || call.id || call.start, call.start]), tasks };
}

export function createPreparationStore(storage) {
  let memory = {}, persistent = true;
  function read() {
    if (!persistent) return memory;
    try {
      const value = JSON.parse(storage.getItem(preparationKey) || '{}');
      if (value && typeof value === 'object' && !Array.isArray(value)) memory = value;
    } catch (_) { persistent = false; }
    return memory;
  }
  function completed(model) {
    if (!model) return [];
    const saved = read()[model.scope];
    return model.tasks.filter(task => saved?.[task.id] === task.signature).map(task => task.id);
  }
  function mark(model, id, checked) {
    const task = model?.tasks.find(item => item.id === id);
    if (!task) return;
    const value = read();
    const saved = value[model.scope];
    const entry = saved && typeof saved === 'object' && !Array.isArray(saved) ? {...saved} : {};
    if (checked) entry[id] = task.signature; else delete entry[id];
    delete value[model.scope];
    value[model.scope] = entry;
    // Keep recent rehearsal reminders without accumulating years of device data.
    for (const key of Object.keys(value).slice(0, -50)) delete value[key];
    memory = value;
    try { storage.setItem(preparationKey, JSON.stringify(value)); }
    catch (_) { persistent = false; }
  }
  return { completed, mark, get persistent() { return persistent; } };
}
