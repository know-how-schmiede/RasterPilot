const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

function setup() {
  const created = [], calls = [], timers = [];
  function element(tag) {
    const handlers = {};
    const el = { tag, children: [], hidden: false, textContent: '', disabled: false,
      addEventListener: (event, handler) => { handlers[event] = handler; },
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      click() { this.clicked = true; return handlers.click?.(); },
      remove() { this.removed = true; } };
    created.push(el); return el;
  }
  const ids = Object.fromEntries(['queueSummary', 'jobsMessage', 'jobRows', 'jobsEmpty', 'jobsTable']
    .map(id => [id, element('div')]));
  let data = { jobs: [], active: 0, running: 0, capacity: 10, worker_ready: true }, error = false;
  const callbacks = { shown: [], removedIds: [],
    show: async job => { callbacks.shown.push(job.id); },
    removed: id => { callbacks.removedIds.push(id); } };
  const context = vm.createContext({
    document: { getElementById: id => ids[id], createElement: element, body: element('body') },
    URL: { createObjectURL: () => 'blob:download', revokeObjectURL() {} },
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; }, clearTimeout() {},
    Date, fetch: async (path, request) => {
      calls.push([path, request]);
      if (error) return { ok: false, json: async () => ({ error: 'Verbindung unterbrochen' }) };
      if (request.method === 'DELETE') data.jobs = data.jobs.filter(job => path !== `/api/jobs/${job.id}`);
      return { ok: true, json: async () => data, blob: async () => new Blob(['png']),
        headers: new Map([['X-Download-Name', encodeURIComponent('Eichhörnchen_rp_280_300ppi_0G.png')]]) };
    }
  });
  vm.runInContext(readFileSync('rasterpilot/static/jobs.js', 'utf8'), context);
  return { ids, calls, created, timers, callbacks, api: context.RasterPilotJobs,
    set: value => { data = value; }, fail: value => { error = value; } };
}
const job = (id, state = 'queued') => ({ id, state, original_name: '<img src=x>.png',
  position: state === 'queued' ? 2 : null, expires_at: 2000000000 });

test('Liste aktualisiert Status und eigene Originalnamen sicher als Text', async () => {
  const ui = setup();
  ui.set({ jobs: [job('a')], active: 6, running: 1, capacity: 10, worker_ready: true });
  await ui.api.start(ui.callbacks);
  assert.match(ui.ids.queueSummary.textContent, /6 von 10/);
  let row = ui.ids.jobRows.children[0];
  assert.equal(row.children[0].textContent, '<img src=x>.png');
  assert.deepEqual(row.children[0].children, []);
  assert.match(row.children[1].textContent, /Wartend.*Platz 2/);
  assert.equal(ui.timers.at(-1).delay, 2000);
  ui.set({ jobs: [job('a', 'done')], active: 0, running: 0, capacity: 10, worker_ready: true });
  await ui.timers.at(-1).callback();
  row = ui.ids.jobRows.children[0];
  assert.equal(row.children[1].textContent, 'Fertig');
  assert.match(row.children[1].children[0].textContent, /Verfügbar bis/);
  await row.children[2].children[0].click();
  assert.deepEqual(ui.callbacks.shown, ['a']);
  await row.children[2].children[1].click();
  const link = ui.created.find(el => el.tag === 'a');
  assert.equal(link.download, 'Eichhörnchen_rp_280_300ppi_0G.png');
  assert.ok(link.clicked && link.removed);
  assert.ok(ui.calls.every(([, request]) => request.headers['X-RasterPilot-Request'] === '1'));
});

test('Abbruch/Entfernen betrifft nur gewählten Auftrag; Fehler lassen Liste erhalten', async () => {
  const ui = setup();
  ui.set({ jobs: [job('a'), job('b', 'done')], active: 1, running: 0, capacity: 10, worker_ready: false });
  await ui.api.start(ui.callbacks);
  assert.match(ui.ids.queueSummary.textContent, /Hintergrunddienst nicht erreichbar/);
  ui.fail(true); await ui.api.refresh();
  assert.match(ui.ids.jobsMessage.textContent, /Verbindung unterbrochen/);
  assert.equal(ui.ids.jobRows.children.length, 2);
  ui.fail(false); await ui.api.refresh();
  await ui.ids.jobRows.children[0].children[2].children[0].click();
  assert.deepEqual(ui.callbacks.removedIds, ['a']);
  assert.equal(ui.ids.jobRows.children.length, 1);
  await ui.ids.jobRows.children[0].children[2].children[2].click();
  assert.deepEqual(ui.callbacks.removedIds, ['a', 'b']);
  assert.equal(ui.ids.jobsTable.hidden, true);
  assert.equal(ui.ids.jobsEmpty.hidden, false);
});
