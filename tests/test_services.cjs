// Dienst- und Updateablauf mit privaten Pfaden und vollständig gestubbten
// System-/Paket-/Netzwerkbefehlen; keine echte Installation auf dem Rechner.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const shell = process.platform === 'win32' ? 'C:/Program Files/Git/bin/sh.exe' : '/bin/sh';
const unix = value => value.replaceAll('\\', '/');

function fixture(callback) {
  const root = path.resolve('.cache');
  fs.mkdirSync(root, { recursive: true });
  const folder = fs.mkdtempSync(path.join(root, 'rasterpilot-services-'));
  try { return callback(folder); }
  finally {
    const resolved = path.resolve(folder);
    assert.ok(resolved.startsWith(root + path.sep + 'rasterpilot-services-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

function runUpdate(folder, { oldWorker = false, oldModule = true, failure = '' } = {}) {
  const base = path.join(folder, 'app'), bin = path.join(folder, 'bin');
  fs.mkdirSync(path.join(base, 'current/venv/bin'), { recursive: true });
  fs.mkdirSync(path.join(base, 'releases'));
  if (oldWorker && oldModule) {
    fs.mkdirSync(path.join(base, 'previous/source/rasterpilot'), { recursive: true });
    fs.writeFileSync(path.join(base, 'previous/source/rasterpilot/worker.py'), '');
  }
  fs.mkdirSync(bin);
  const custom = path.join(folder, 'etc/systemd/system/rasterpilot.service.d/custom.conf');
  fs.mkdirSync(path.dirname(custom), { recursive: true });
  fs.writeFileSync(custom, '[Service]\nNice=5\n');
  fs.writeFileSync(path.join(base, 'current/venv/bin/gunicorn'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const write = (name, text) => fs.writeFileSync(path.join(bin, name), '#!/bin/sh\n' + text, { mode: 0o755 });
  write('systemctl', `printf 'systemctl %s\\n' "$*" >> "$TEST_LOG"
if [ "$1" = cat ]; then [ "$TEST_OLD_WORKER" = yes ]; exit $?; fi
if [ "$1" = daemon-reload ] && [ "$TEST_FAILURE" = configure ]; then exit 75; fi
exit 0
`);
  write('chown', 'exit 0\n');
  write('install', `printf 'install %s\\n' "$*" >> "$TEST_LOG"
for target in "$@"; do :; done
if [ "$1" = -d ]; then mkdir -p "$target"; else cp "$3" "$4"; fi
`);
  const update = fs.readFileSync('scripts/update.sh', 'utf8')
    .replace('BASE=/opt/rasterpilot', 'BASE="$TEST_BASE"')
    .replaceAll('/var/lib/rasterpilot/jobs', '$TEST_SYSTEM/var/lib/rasterpilot/jobs')
    .replaceAll('/usr/local/bin/rasterpilot-update', '$TEST_SYSTEM/updater');
  const updatePath = path.join(folder, 'update.sh');
  fs.writeFileSync(updatePath, update);
  const log = path.join(folder, 'calls');
  fs.writeFileSync(log, '');
  const harness = `
PATH="$TEST_BIN:$PATH"
export PATH
id() { printf '0\\n'; }
command() { return 0; }
readlink() { printf '%s/previous\\n' "$TEST_BASE"; }
git() {
    printf 'git %s\\n' "$*" >> "$TEST_LOG"
    for target in "$@"; do :; done
    mkdir -p "$target/scripts"
    cp "$TEST_CONFIGURE" "$target/scripts/configure_services.sh"
    cp "$TEST_SCRIPT" "$target/scripts/update.sh"
}
python3() {
    mkdir -p "$3/bin"
    printf '#!/bin/sh\\nexit 0\\n' > "$3/bin/pip"
    chmod +x "$3/bin/pip"
}
runuser() { printf 'runuser %s\\n' "$*" >> "$TEST_LOG"; }
ln() { printf 'ln %s\\n' "$*" >> "$TEST_LOG"; }
mv() { printf 'mv %s\\n' "$*" >> "$TEST_LOG"; }
rm() { :; }
curl() {
    printf 'curl %s\\n' "$*" >> "$TEST_LOG"
    [ "$TEST_FAILURE" != ready ]
}
. "$TEST_SCRIPT"
`;
  const result = spawnSync(shell, ['-c', harness], { encoding: 'utf8', env: { ...process.env,
    PATH: unix(bin) + path.delimiter + process.env.PATH,
    TEST_BIN: process.platform === 'win32' ? unix(bin).replace(/^([a-zA-Z]):/, (_, drive) => '/' + drive.toLowerCase()) : bin,
    TEST_BASE: unix(base), TEST_SYSTEM: unix(folder), TEST_SCRIPT: unix(updatePath),
    TEST_CONFIGURE: unix(path.resolve('scripts/configure_services.sh')), TEST_LOG: unix(log),
    RASTERPILOT_SYSTEM_ROOT: unix(folder), TEST_FAILURE: failure, TEST_OLD_WORKER: oldWorker ? 'yes' : 'no' } });
  if (result.error) throw result.error;
  return { ...result, calls: fs.readFileSync(log, 'utf8') };
}

test('Worker-Einrichtung schreibt getrennte Dienste und erhält fremde Drop-ins', () => fixture(folder => {
  const result = runUpdate(folder);
  assert.equal(result.status, 0, result.stderr);
  const worker = fs.readFileSync(path.join(folder, 'etc/systemd/system/rasterpilot-worker.service'), 'utf8');
  const web = fs.readFileSync(path.join(folder, 'etc/systemd/system/rasterpilot.service.d/worker.conf'), 'utf8');
  assert.match(worker, /python -m rasterpilot.worker/);
  assert.match(worker, /KillMode=control-group/);
  assert.match(worker, /UMask=0077/);
  assert.match(worker, /EnvironmentFile=-\/etc\/rasterpilot\/environment/);
  assert.match(web, /RASTERPILOT_DATA_DIR=\/var\/lib\/rasterpilot\/jobs/);
  assert.equal(fs.readFileSync(path.join(folder, 'etc/systemd/system/rasterpilot.service.d/custom.conf'), 'utf8'), '[Service]\nNice=5\n');
  assert.match(result.calls, /install -d -m 700 .*\/var\/lib\/rasterpilot\/jobs/);
  assert.ok(result.calls.indexOf('runuser ') < result.calls.indexOf('systemctl stop rasterpilot\n'));
  assert.match(result.calls, /systemctl restart rasterpilot-worker rasterpilot/);
  assert.match(result.calls, /curl .*\/ready/);
}));

test('Fehlgeschlagene Bereitschaft stellt vorherige Webversion und Worker wieder her', () => fixture(folder => {
  const result = runUpdate(folder, { oldWorker: true, failure: 'ready' });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /vorherige Version/);
  assert.match(result.calls, /systemctl stop rasterpilot-worker\n/);
  assert.match(result.calls, /ln -s .*previous .*current.new/);
  assert.match(result.calls, /systemctl restart rasterpilot-worker\nsystemctl restart rasterpilot\n/);
}));

test('Fehler bei Diensteinrichtung startet auch vor dem Umschalten die alte Version', () => fixture(folder => {
  const result = runUpdate(folder, { failure: 'configure' });
  assert.equal(result.status, 75, result.stderr);
  assert.match(result.calls, /systemctl disable rasterpilot-worker/);
  assert.match(result.calls, /systemctl restart rasterpilot\n/);
  assert.doesNotMatch(result.calls, /curl/);
}));

test('Zurückgebliebene Worker-Unit wird beim Rückfall auf 0.3 nicht gestartet', () => fixture(folder => {
  const result = runUpdate(folder, { oldWorker: true, oldModule: false, failure: 'ready' });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.calls, /systemctl disable rasterpilot-worker/);
  assert.doesNotMatch(result.calls, /systemctl restart rasterpilot-worker\n/);
  assert.match(result.calls, /systemctl restart rasterpilot\n/);
}));
