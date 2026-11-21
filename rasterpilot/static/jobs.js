'use strict';
globalThis.RasterPilotJobs = (() => {
  const $ = id => document.getElementById(id);
  const labels = { queued: 'Wartend', running: 'Wird berechnet', done: 'Fertig', failed: 'Fehlgeschlagen', cancelled: 'Abgebrochen' };
  let callbacks, timer, generation = 0, signature = '', refreshError = false;
  async function request(path, method = 'GET') {
    const response = await fetch(path, { method, headers: { 'X-RasterPilot-Request': '1' } });
    if (!response.ok) {
      let detail;
      try { detail = (await response.json()).error; } catch (_) { /* Proxyfehler. */ }
      throw new Error(detail || 'Die Auftragsliste konnte nicht geladen werden.');
    }
    return response;
  }
  function button(text, action) {
    const element = document.createElement('button');
    element.type = 'button'; element.textContent = text;
    element.addEventListener('click', async () => {
      element.disabled = true;
      $('jobsMessage').textContent = '';
      try { await action(); }
      catch (error) { $('jobsMessage').textContent = error.message; }
      finally { element.disabled = false; }
    });
    return element;
  }
  async function download(job) {
    const response = await request(`/api/jobs/${job.id}/result`);
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = decodeURIComponent(response.headers.get('X-Download-Name'));
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function render(data) {
    $('queueSummary').textContent = `Gesamt: ${data.active} von ${data.capacity} Plätzen belegt · ${data.running} in Bearbeitung${data.worker_ready ? '' : ' · Hintergrunddienst nicht erreichbar'}`;
    const next = JSON.stringify(data.jobs.map(job => [job.id, job.state, job.original_name, job.position,
      job.error, job.state === 'done' ? job.expires_at : null]));
    if (next === signature) return;
    signature = next;
    const rows = data.jobs.map(job => {
      const row = document.createElement('tr');
      const name = document.createElement('td'); name.textContent = job.original_name;
      const status = document.createElement('td');
      status.className = job.state === 'done' ? 'job-done' : '';
      status.textContent = `${labels[job.state] || job.state}${job.position ? ` · Platz ${job.position}` : ''}`;
      if (job.error) { const detail = document.createElement('p'); detail.textContent = job.error; status.append(detail); }
      if (job.state === 'done') {
        const expiry = document.createElement('p');
        expiry.textContent = `Verfügbar bis ${new Date(job.expires_at * 1000).toLocaleString('de-DE')}`;
        status.append(expiry);
      }
      const actions = document.createElement('td');
      if (job.state === 'done') {
        actions.append(button('Ergebnis anzeigen', () => callbacks.show(job)),
          button('PNG herunterladen', () => download(job)));
      }
      const active = ['queued', 'running'].includes(job.state);
      actions.append(button(active ? 'Abbrechen' : 'Entfernen', async () => {
        await request(`/api/jobs/${job.id}`, 'DELETE');
        callbacks.removed(job.id);
        await refresh();
      }));
      row.append(name, status, actions); return row;
    });
    $('jobRows').replaceChildren(...rows);
    $('jobsEmpty').hidden = rows.length > 0;
    $('jobsTable').hidden = rows.length === 0;
  }
  async function refresh() {
    const current = ++generation;
    try {
      const data = await (await request('/api/jobs')).json();
      if (current !== generation) return;
      render(data);
      if (refreshError) { $('jobsMessage').textContent = ''; refreshError = false; }
    } catch (error) {
      if (current === generation) {
        refreshError = true;
        $('jobsMessage').textContent = `${error.message} Die Liste wird erneut abgefragt.`;
      }
    }
  }
  function start(options) {
    callbacks = options;
    async function tick() { await refresh(); timer = setTimeout(tick, 2000); }
    clearTimeout(timer); return tick();
  }
  return Object.freeze({ start, refresh });
})();
