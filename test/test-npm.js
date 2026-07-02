const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BIN = path.join(ROOT, 'bin', 'node-power-user');

// Run the real npu bin end-to-end (same harness as test-npx.js)
function runNpu(args) {
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60000,
  });
  result.combined = `${result.stdout || ''}${result.stderr || ''}`;
  return result;
}

describe('commands/npm (sfw-wrapped passthrough, end-to-end via bin)', function () {
  this.timeout(60000);

  it('should pass args through to npm verbatim (--force plain path)', () => {
    // `npm create --help` maps to init help — proves subcommands like create
    // survive untouched (the old shell routing rewrote `npm create X` to
    // `npx X`, which runs the WRONG package)
    const result = runNpu(['--force', 'npm', 'create', '--help']);
    assert.strictEqual(result.status, 0, `expected exit 0, got ${result.status}:\n${result.combined}`);
    assert.match(result.combined, /npm init/);
  });

  it('should run wrapped with sfw when available', async () => {
    const socket = require('../dist/lib/socket');
    const available = await socket.isAvailable();
    if (!available) {
      return; // skip if sfw not installed
    }

    const result = runNpu(['npm', '--version']);
    assert.strictEqual(result.status, 0, `expected exit 0, got ${result.status}:\n${result.combined}`);
    assert.match(result.stdout, /\d+\.\d+\.\d+/);
    assert.match(result.combined, /supply chain protection enabled/);
  });

  it('should propagate npm\'s non-zero exit code without claiming a block', () => {
    const result = runNpu(['--force', 'npm', 'run', 'no-such-script-xyz']);
    assert.notStrictEqual(result.status, 0, `expected non-zero exit:\n${result.combined}`);
    assert.doesNotMatch(result.combined, /blocked by Socket Firewall/i);
  });

  it('should exit non-zero with usage when no npm args are given', () => {
    const result = runNpu(['npm']);
    assert.notStrictEqual(result.status, 0);
    assert.match(result.combined, /Usage: npu \[--force\] npm/);
  });
});
