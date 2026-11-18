// Die vollständigen Skripte mit isolierten Pfaden und Paket-/Git-Stubs prüfen.
// apt-get und git führen keinerlei System- oder Netzwerkaktionen aus.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

function runScript(name, { sudo = false, uid = '0', installStatus = '0' } = {}) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'rasterpilot-scripts-'));
  const shell = process.platform === 'win32' ? 'C:/Program Files/Git/bin/sh.exe' : '/bin/sh';
  const unixPath = value => value.replaceAll('\\', '/');
  try {
    const base = path.join(folder, 'app');
    fs.mkdirSync(path.join(base, 'current/venv/bin'), { recursive: true });
    fs.mkdirSync(path.join(base, 'releases'));
    fs.writeFileSync(path.join(base, 'current/venv/bin/gunicorn'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    // Der Installer muss eine frische Installation sehen.
    if (name === 'install') fs.renameSync(path.join(base, 'current'), path.join(base, 'unused'));
    const osFile = path.join(folder, 'os-release');
    fs.writeFileSync(osFile, 'ID=debian\nVERSION_ID=13\n');
    const logFile = path.join(folder, 'calls');
    fs.writeFileSync(logFile, '');
    const original = fs.readFileSync(`scripts/${name}.sh`, 'utf8');
    const script = original.replace('BASE=/opt/rasterpilot', 'BASE="$RASTERPILOT_TEST_BASE"')
      .replace('[ ! -f /etc/debian_version ]', '[ ! -f "$RASTERPILOT_TEST_OS" ]')
      .replace('. /etc/os-release;', '. "$RASTERPILOT_TEST_OS";');
    const testFile = path.join(folder, `${name}.sh`);
    fs.writeFileSync(testFile, script);
    const harness = `
id() { printf '%s\\n' "$TEST_UID"; }
command() { [ "$TEST_HAS_SUDO" = yes ]; }
apt-get() {
    printf 'apt-get %s\\n' "$*" >> "$TEST_LOG"
    if [ "$1" = install ]; then return "$TEST_INSTALL_STATUS"; fi
}
git() { printf 'git %s\\n' "$*" >> "$TEST_LOG"; return 73; }
rm() { :; } # Räumt nur der JavaScript-Test nach geprüfter Pfadauflösung auf.
. "$TEST_SCRIPT"
`;
    const result = spawnSync(shell, ['-c', harness], {
      encoding: 'utf8', env: { ...process.env,
        RASTERPILOT_TEST_BASE: unixPath(base), RASTERPILOT_TEST_OS: unixPath(osFile),
        TEST_LOG: unixPath(logFile), TEST_SCRIPT: unixPath(testFile), TEST_UID: uid,
        TEST_HAS_SUDO: sudo ? 'yes' : 'no', TEST_INSTALL_STATUS: installStatus }
    });
    if (result.error) throw result.error;
    return { ...result, calls: fs.readFileSync(logFile, 'utf8') };
  } finally {
    const resolved = path.resolve(folder);
    const expectedPrefix = path.resolve(os.tmpdir()) + path.sep + 'rasterpilot-scripts-';
    assert.ok(resolved.startsWith(expectedPrefix));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

test('Update installiert fehlendes sudo vor der Versionsvorbereitung', () => {
  const result = runScript('update');
  assert.equal(result.status, 73, result.stderr);
  assert.match(result.calls, /^apt-get update\napt-get install -y sudo\ngit clone/m);
});

test('Update mit vorhandenem sudo benötigt keinen Paketmanagerlauf', () => {
  const result = runScript('update', { sudo: true });
  assert.equal(result.status, 73, result.stderr);
  assert.doesNotMatch(result.calls, /apt-get/);
  assert.match(result.calls, /^git clone/);
});

test('Fehlgeschlagene sudo-Installation bricht vor Git und Umschalten ab', () => {
  const result = runScript('update', { installStatus: '75' });
  assert.equal(result.status, 75, result.stderr);
  assert.doesNotMatch(result.calls, /git/);
});

test('Installer nimmt sudo in die Systempakete auf', () => {
  const result = runScript('install', { installStatus: '75' });
  assert.equal(result.status, 75, result.stderr);
  assert.match(result.calls, /apt-get install -y sudo git python3/);
});

test('Beide Skripte verlangen root und erklären den Einstieg ohne sudo', () => {
  for (const name of ['install', 'update']) {
    const result = runScript(name, { uid: '1000' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /su -/);
    assert.equal(result.calls, '');
  }
});
