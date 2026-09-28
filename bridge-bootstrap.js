const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BOOTSTRAP_VERSION = '2026-09-28-bootstrap-v12';
const PROJECT_ID = 'eshop-css';
const repo = __dirname;
const pollMs = 30000;
const gitTimeoutMs = 20000;
const cycleTimeoutMs = 10 * 60 * 1000;
const stateDir = path.join(repo, 'automation', 'state');
const lockFile = path.join(stateDir, 'bridge.lock.json');
const guardDir = path.join(stateDir, 'bridge.guard-' + PROJECT_ID.replace(/[^a-z0-9.-]/gi, '_'));
const guardOwnerFile = path.join(guardDir, 'owner.json');
const errorFile = path.join(stateDir, 'last-error.local.json');
let busy = false;

fs.mkdirSync(stateDir, { recursive: true });

const lockToken = process.pid + '-' + Date.now();
const staleLockMs = 90 * 1000;
const heartbeatMs = 15 * 1000;
function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}
function readGuardOwner() {
  try { return JSON.parse(fs.readFileSync(guardOwnerFile, 'utf8')); } catch { return null; }
}
function acquireLock() {
  // Directory creation is the primary singleton primitive. Unlike the JSON
  // heartbeat file, mkdir is not replaced/truncated while the process runs.
  try {
    fs.mkdirSync(guardDir);
    fs.writeFileSync(guardOwnerFile, JSON.stringify({ pid: process.pid, token: lockToken, version: BOOTSTRAP_VERSION, createdAt: new Date().toISOString() }, null, 2));
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const owner = readGuardOwner();
    if (!owner) throw new Error('BOOTSTRAP GUARD EXISTS WITHOUT VALID OWNER; refusing unsafe takeover');
    // Version changes are expected during self-update. A live owner still wins;
    // a dead owner is stale regardless of which bootstrap version created it.
    if (pidAlive(owner.pid)) throw new Error('Another bridge bootstrap holds the singleton guard (PID ' + owner.pid + ')');
    try { fs.rmSync(guardDir, { recursive: true, force: true }); } catch (cleanupError) { throw cleanupError; }
    fs.mkdirSync(guardDir);
    fs.writeFileSync(guardOwnerFile, JSON.stringify({ pid: process.pid, token: lockToken, version: BOOTSTRAP_VERSION, createdAt: new Date().toISOString() }, null, 2));
  }
  const payload = () => JSON.stringify({ pid: process.pid, token: lockToken, version: BOOTSTRAP_VERSION, heartbeatAt: new Date().toISOString() }, null, 2);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(lockFile, 'wx');
      try { fs.writeFileSync(fd, payload()); } finally { fs.closeSync(fd); }
      return;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let stat = null;
      try { stat = fs.statSync(lockFile); } catch {}
      if (stat && Date.now() - stat.mtimeMs <= staleLockMs) {
        throw new Error('Another bridge bootstrap holds a fresh lock');
      }
      try { fs.unlinkSync(lockFile); } catch (unlinkError) {
        if (unlinkError.code !== 'ENOENT') throw unlinkError;
      }
    }
  }
  throw new Error('BOOTSTRAP LOCK ACQUIRE FAILED');
}
function heartbeatLock() {
  try {
    const current = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    if (current.token !== lockToken) throw new Error('BOOTSTRAP LOCK OWNERSHIP LOST');
    current.heartbeatAt = new Date().toISOString();
    fs.writeFileSync(lockFile, JSON.stringify(current, null, 2));
  } catch (e) {
    recordError('lock-heartbeat', e);
    console.error('BRIDGE BOOTSTRAP FATAL:', e.message);
    process.exit(3);
  }
}
function releaseLock() {
  try {
    const current = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    if (current.token === lockToken) fs.unlinkSync(lockFile);
  } catch {}
  try {
    const owner = readGuardOwner();
    if (owner && owner.token === lockToken) fs.rmSync(guardDir, { recursive: true, force: true });
  } catch {}
}
function recordError(stage, error) {
  fs.writeFileSync(errorFile, JSON.stringify({
    stage, version: BOOTSTRAP_VERSION, pid: process.pid,
    error: error && error.message ? error.message : String(error),
    at: new Date().toISOString()
  }, null, 2));
}
function git(args) {
  try {
    return execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore','pipe','pipe'], timeout: gitTimeoutMs }).trim();
  } catch (e) {
    const stderr = String(e.stderr || '').trim();
    throw new Error('git ' + args.join(' ') + ' failed' + (stderr ? ': ' + stderr : ''));
  }
}
function pushLocalAhead() {
  let ahead = 0;
  try { ahead = Number(git(['rev-list','--count','@{u}..HEAD'])) || 0; }
  catch { return; }
  if (!ahead) return;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { git(['push']); return; }
    catch (e) {
      lastError = e;
      if (attempt < 3) git(['pull','--rebase']);
    }
  }
  throw new Error('LOCAL COMMITS AHEAD: push recovery failed after 3 attempts: ' + lastError.message);
}
function cleanForUpdate() {
  const mergeHead = path.join(repo,'.git','MERGE_HEAD');
  const rebaseMerge = path.join(repo,'.git','rebase-merge');
  const rebaseApply = path.join(repo,'.git','rebase-apply');
  if (fs.existsSync(mergeHead)) { try { git(['merge','--abort']); } catch {} }
  if (fs.existsSync(rebaseMerge) || fs.existsSync(rebaseApply)) { try { git(['rebase','--abort']); } catch {} }
}
function cycle() {
  if (busy) return;
  busy = true;
  try {
    heartbeatLock();
    cleanForUpdate();
    pushLocalAhead();
    const status = git(['status','--porcelain','--untracked-files=no']);
    if (status) throw new Error('LOCAL TRACKED CHANGES: refusing automatic update: ' + status.replace(/\r?\n/g, '; '));
    const beforePull = git(['rev-parse','HEAD']);
    git(['pull','--ff-only']);
    const afterPull = git(['rev-parse','HEAD']);
    if (afterPull !== beforePull) {
      const changed = git(['diff','--name-only',beforePull,afterPull]).split(/\r?\n/).filter(Boolean);
      if (changed.includes('bridge-bootstrap.js')) {
        console.log('BRIDGE: bootstrap update detected; exiting for watchdog restart.');
        releaseLock();
        process.exit(75);
      }
    }
    const child = spawn(process.execPath, [path.join(repo,'automation','bridge','cycle.js')], {
      cwd: repo, stdio: 'inherit', windowsHide: true
    });
    let finished = false;
    const timeout = setTimeout(() => {
      if (!finished) {
        recordError('cycle-timeout', new Error('cycle timeout after ' + cycleTimeoutMs + 'ms'));
        child.kill();
      }
    }, cycleTimeoutMs);
    child.once('error', e => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      recordError('cycle-spawn', e);
      console.error('BRIDGE BOOTSTRAP ERROR:', e.message);
      busy = false;
    });
    child.once('exit', (code, signal) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (code === 0) {
        try { fs.unlinkSync(errorFile); } catch {}
      } else {
        const e = new Error('cycle exit ' + code + (signal ? ' signal ' + signal : ''));
        recordError('cycle', e);
        console.error('BRIDGE BOOTSTRAP ERROR:', e.message);
      }
      busy = false;
    });
  } catch (e) {
    recordError('cycle', e);
    console.error('BRIDGE BOOTSTRAP ERROR:', e.message);
    busy = false;
  }
}

try {
  acquireLock();
} catch (e) {
  console.error('BRIDGE BOOTSTRAP REFUSED:', e.message);
  process.exit(2);
}
process.on('exit', releaseLock);
process.on('SIGINT', () => { releaseLock(); process.exit(0); });
process.on('SIGTERM', () => { releaseLock(); process.exit(0); });
console.log('Isolated bridge bootstrap ' + PROJECT_ID + ' ' + BOOTSTRAP_VERSION + ' running.');
const heartbeatTimer = setInterval(heartbeatLock, heartbeatMs);
cycle();
setInterval(cycle, pollMs);
