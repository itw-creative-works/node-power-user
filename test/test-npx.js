const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');
const pkg = require('../package.json');

const ROOT = path.join(__dirname, '..');
const BIN = path.join(ROOT, 'bin', 'node-power-user');

// Run the real npu bin end-to-end. mocha is a local devDependency, so
// `npu npx mocha ...` exercises the local-binary fast path: no registry
// download, no sfw requirement, no network.
function runNpu(args) {
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60000,
  });
  result.combined = `${result.stdout || ''}${result.stderr || ''}`;
  return result;
}

describe('commands/npx (end-to-end via bin)', function () {
  this.timeout(60000);

  describe('local-binary fast path', () => {
    it('should run a locally installed binary and exit 0', () => {
      const result = runNpu(['npx', 'mocha', '--version']);
      assert.strictEqual(result.status, 0, `expected exit 0, got ${result.status}:\n${result.combined}`);
      assert.match(result.stdout, /\d+\.\d+\.\d+/);
      // Guard against yargs intercepting --version and printing npu's own
      // version instead of ever running mocha
      assert.ok(!result.stdout.includes(pkg.version), `got npu's own version instead of mocha's:\n${result.combined}`);
    });

    it('should skip the firewall entirely for local binaries (nothing to download)', () => {
      const result = runNpu(['npx', 'mocha', '--version']);
      assert.doesNotMatch(result.combined, /supply chain protection/i);
      assert.doesNotMatch(result.combined, /blocked/i);
    });

    it('should NOT take the fast path when --package forces a download', () => {
      // `npx --package=X` downloads X even when the named binary is local —
      // that download must stay behind the firewall (--force keeps the test
      // deterministic; we only assert the fast path was not taken)
      const result = runNpu(['--force', 'npx', '--package=mocha', 'mocha', '--version']);
      assert.doesNotMatch(result.combined, /installed locally/);
    });
  });

  describe('flag pass-through', () => {
    it('should pass trailing flags to the child instead of eating them', () => {
      // Old bug: yargs consumed --help (and any other trailing flag), so the
      // child never received it. mocha --help output proves pass-through.
      const result = runNpu(['npx', 'mocha', '--help']);
      assert.strictEqual(result.status, 0, `expected exit 0, got ${result.status}:\n${result.combined}`);
      assert.match(result.stdout, /--reporter/);
    });

    it('should accept npu\'s own --force BEFORE the npx token', () => {
      const result = runNpu(['--force', 'npx', 'mocha', '--version']);
      assert.strictEqual(result.status, 0, `expected exit 0, got ${result.status}:\n${result.combined}`);
      assert.match(result.stdout, /\d+\.\d+\.\d+/);
      assert.ok(!result.stdout.includes(pkg.version), `got npu's own version instead of mocha's:\n${result.combined}`);
    });
  });

  describe('failure reporting', () => {
    it('should propagate the child\'s non-zero exit code', () => {
      // Old bug: npu swallowed the failure and exited 0.
      const result = runNpu(['npx', 'mocha', 'no-such-file.test.js']);
      assert.notStrictEqual(result.status, 0, `expected non-zero exit:\n${result.combined}`);
    });

    it('should NOT report a command failure as a firewall block', () => {
      // Old bug: any non-zero exit printed "Command blocked by Socket Firewall".
      const result = runNpu(['npx', 'mocha', 'no-such-file.test.js']);
      assert.doesNotMatch(result.combined, /blocked by Socket Firewall/i);
    });
  });

  describe('pure flag queries (no package named)', () => {
    it('should run `npx --version` as a silent passthrough (no wrapper noise)', () => {
      // No package = nothing to download = no firewall and no npu ceremony —
      // output must be exactly what vanilla npx prints
      const result = runNpu(['npx', '--version']);
      assert.strictEqual(result.status, 0, `expected exit 0, got ${result.status}:\n${result.combined}`);
      assert.match(result.stdout, /^\d+\./);
      assert.doesNotMatch(result.combined, /Running:|Done\./);
    });
  });

  describe('usage errors', () => {
    it('should exit non-zero when no command is given', () => {
      const result = runNpu(['npx']);
      assert.notStrictEqual(result.status, 0);
      assert.match(result.combined, /Usage: npu \[--force\] npx/);
    });
  });
});
