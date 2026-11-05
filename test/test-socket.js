const assert = require('assert');
const { execute } = require('node-powertools');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

describe('lib/socket (Socket Firewall wrapper)', () => {
  let socket;

  before(() => {
    socket = require('../dist/lib/socket');
  });

  describe('isAvailable()', () => {
    it('should return a boolean', async () => {
      const result = await socket.isAvailable();
      assert.strictEqual(typeof result, 'boolean');
    });

    it('should detect sfw when installed', async () => {
      const sfwInstalled = await execute('sfw --version', { log: false }).then(() => true).catch(() => false);
      const result = await socket.isAvailable();
      assert.strictEqual(result, sfwInstalled);
    });
  });

  describe('check()', () => {
    it('should not throw when sfw is available', async function () {
      if (!await socket.isAvailable()) {
        this.skip();
      }
      await socket.check();
    });

    it('should not throw with force flag when sfw is unavailable', async () => {
      // force flag bypasses the sfw requirement
      await socket.check({ force: true });
    });
  });

  describe('wrap()', () => {
    it('should execute a simple command', async () => {
      // Use a harmless command to verify wrap() works
      await socket.wrap('node', ['-e', 'console.log("test")'], { force: true });
    });

    it('should prefix sfw when available and not forced', async function () {
      if (!await socket.isAvailable()) {
        this.skip();
      }
      // A command that always succeeds: the sfw prefix must not break execution
      await socket.wrap('node', ['-e', 'console.log("sfw-wrap-test")']);
    });

    it('should fall back to plain execution with force flag', async () => {
      await socket.wrap('node', ['-e', 'console.log("force-test")'], { force: true });
    });
  });

  describe('isBlockOutput()', () => {
    it('should detect a per-package block line', () => {
      assert.strictEqual(socket.isBlockOutput(' - blocked 1 package: pkg:npm/evil@1.0.0 - malware'), true);
    });

    it('should detect the Blocked Packages report header', () => {
      assert.strictEqual(socket.isBlockOutput('  Blocked Packages (2):'), true);
    });

    it('should detect the Blocked Hostnames report header', () => {
      assert.strictEqual(socket.isBlockOutput('  Blocked Hostnames (1):'), true);
    });

    it('should detect the block summary line', () => {
      assert.strictEqual(socket.isBlockOutput('  SUMMARY: 3 item(s) blocked'), true);
    });

    it('should NOT flag zero-count report lines', () => {
      assert.strictEqual(socket.isBlockOutput('SUMMARY: 0 item(s) blocked'), false);
      assert.strictEqual(socket.isBlockOutput('Blocked Packages (0):'), false);
    });

    it('should NOT flag ordinary failure output (e.g. a failing test run)', () => {
      const output = [
        '  Results',
        '    1 failing',
        '  1) shell omnibox resolves URLs:',
        '     AssertionError: expected true to be false',
        'npm ERR! code ELIFECYCLE',
      ].join('\n');
      assert.strictEqual(socket.isBlockOutput(output), false);
    });
  });

  describe('wrap() failure classification', function () {
    this.timeout(30000);

    before(() => {
      // Skip sfw's daily background update check — keeps sfw runs fast in tests
      process.env.SFW_SKIP_UPDATE_CHECK = '1';
    });

    it('should classify a plain failure as command-failed with the exit code (force path)', async () => {
      let caught = null;
      await socket.wrap('node', ['-e', 'process.exit(3)'], { force: true }).catch((e) => { caught = e; });
      assert.ok(caught, 'expected wrap() to throw');
      assert.strictEqual(caught.reason, 'command-failed');
      assert.strictEqual(caught.code, 3);
    });

    it('should classify a plain failure as command-failed, NOT sfw-blocked (sfw path)', async function () {
      if (!await socket.isAvailable()) {
        this.skip();
      }

      // Old bug: ANY non-zero exit under sfw was reported as a firewall block
      let caught = null;
      await socket.wrap('node', ['-e', 'process.exit(4)']).catch((e) => { caught = e; });
      assert.ok(caught, 'expected wrap() to throw');
      assert.strictEqual(caught.reason, 'command-failed');
      assert.strictEqual(caught.code, 4);
    });

    it('should stream output live instead of dumping it after exit (sfw path)', async function () {
      if (!await socket.isAvailable()) {
        this.skip();
      }

      // The child prints a marker then stays alive 1500ms. If wrap() streams,
      // the marker hits stdout well before wrap() resolves; if it buffers
      // (old bug), the marker only appears at resolve time.
      const marker = 'npu-stream-marker-123';
      const script = `console.log('${marker}'); setTimeout(() => {}, 1500)`;

      const originalWrite = process.stdout.write;
      let markerAt = 0;

      process.stdout.write = function (chunk, ...rest) {
        if (!markerAt && String(chunk).includes(marker)) {
          markerAt = Date.now();
        }
        return originalWrite.call(process.stdout, chunk, ...rest);
      };

      try {
        await socket.wrap('node', ['-e', script]);
      } finally {
        process.stdout.write = originalWrite;
      }

      const resolvedAt = Date.now();
      assert.ok(markerAt > 0, 'marker never appeared on stdout');
      assert.ok(resolvedAt - markerAt >= 1000, `marker appeared only ${resolvedAt - markerAt}ms before resolve — output was buffered, not streamed`);
    });
  });

  describe('wrap() stdin', function () {
    this.timeout(20000);

    // The wrapped child reads stdin to its end and exits 0 only on the text it
    // expects; sfw itself waits for its stdin to close, so a pipe that never
    // closes would hang it.
    function wrapWithStdin(stdin, force, expected = '') {
      const read = `let text = ''; process.stdin.on('data', (d) => { text += d; }); process.stdin.on('end', () => process.exit(text === ${JSON.stringify(expected)} ? 0 : 2))`;
      const child = JSON.stringify(['-e', read]);
      const script = `require('./dist/lib/socket').wrap('node', ${child}, { force: ${force} }).then(() => process.exit(0), () => process.exit(1))`;

      return new Promise((resolve) => {
        const npu = spawn(process.execPath, ['-e', script], {
          cwd: path.join(__dirname, '..'),
          stdio: [stdin, 'ignore', 'inherit'],
          env: { ...process.env, SFW_SKIP_UPDATE_CHECK: '1' },
        });
        const timer = setTimeout(() => { npu.kill(); resolve('timed out'); }, 10000);
        npu.on('close', (code) => { clearTimeout(timer); resolve(code); });
      });
    }

    it('should finish when npu\'s stdin is closed (force path)', async () => {
      assert.strictEqual(await wrapWithStdin('ignore', true), 0);
    });

    it('should finish when npu\'s stdin is closed (sfw path)', async function () {
      if (!await socket.isAvailable()) {
        this.skip();
      }
      assert.strictEqual(await wrapWithStdin('ignore', false), 0);
    });

    it('should finish when npu\'s stdin is a pipe that never closes (sfw path)', async function () {
      if (!await socket.isAvailable()) {
        this.skip();
      }
      assert.strictEqual(await wrapWithStdin('pipe', false), 0);
    });

    it('should hand the child a file redirected to npu\'s stdin (sfw path)', async function () {
      if (!await socket.isAvailable()) {
        this.skip();
      }
      const file = path.join(os.tmpdir(), `npu-stdin-${process.pid}.txt`);
      fs.writeFileSync(file, 'y\n');
      const fd = fs.openSync(file, 'r');
      try {
        assert.strictEqual(await wrapWithStdin(fd, false, 'y\n'), 0);
      } finally {
        fs.closeSync(fd);
        fs.rmSync(file, { force: true });
      }
    });
  });

  describe('wrap() args', function () {
    this.timeout(20000);

    // Each reaches the child as written: through cmd.exe and a .cmd shim, as
    // npm, npx and sfw are on Windows, and straight through elsewhere
    const args = ['plain', 'two words', 'C:\\Users\\IWEEDM~1\\g dir\\', `it's`, 'say "hi" & exit', '1"2 & 3', '%PATH%', 'a|b<c>d^e'];
    const out = path.join(os.tmpdir(), `npu-argv-${process.pid}.json`);
    const env = { PATH: process.env.PATH, NPU_ARGV_OUT: process.env.NPU_ARGV_OUT, SFW_SKIP_UPDATE_CHECK: process.env.SFW_SKIP_UPDATE_CHECK };
    const writeArgv = `require('fs').writeFileSync(process.env.NPU_ARGV_OUT, JSON.stringify(process.argv.slice(1)))`;

    before(() => {
      process.env.SFW_SKIP_UPDATE_CHECK = '1';
      process.env.NPU_ARGV_OUT = out;
      process.env.PATH = `${path.join(__dirname, 'fixtures', 'argv')}${path.delimiter}${process.env.PATH}`;
    });

    after(() => {
      // A key that was unset goes back to unset, never the string 'undefined'
      for (const [key, value] of Object.entries(env)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      fs.rmSync(out, { force: true });
    });

    it('should hand every arg to the child unchanged (force path)', async () => {
      await socket.wrap('print-args', args, { force: true });
      assert.deepStrictEqual(JSON.parse(fs.readFileSync(out, 'utf8')), args);
    });

    it('should hand every arg to an .exe unchanged (force path)', async () => {
      await socket.wrap('node', ['-e', writeArgv, ...args], { force: true });
      assert.deepStrictEqual(JSON.parse(fs.readFileSync(out, 'utf8')), args);
    });

    // sfw starts a .cmd bin with its own quoting, so this checks npu's hop to sfw
    it('should hand every arg through sfw unchanged (sfw path)', async function () {
      if (!await socket.isAvailable()) {
        this.skip();
      }
      await socket.wrap('node', ['-e', writeArgv, ...args]);
      assert.deepStrictEqual(JSON.parse(fs.readFileSync(out, 'utf8')), args);
    });
  });

  describe('audit()', () => {
    it('should be a no-op (sfw handles protection at install time)', async () => {
      // audit() should resolve immediately without doing anything
      const result = await socket.audit();
      assert.strictEqual(result, undefined);
    });
  });
});
