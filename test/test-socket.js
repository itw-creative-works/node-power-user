const assert = require('assert');
const { execute } = require('node-powertools');

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
    it('should not throw when sfw is available', async () => {
      const available = await socket.isAvailable();
      if (!available) {
        return; // skip if sfw not installed
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
      await socket.wrap('echo "test"', { force: true });
    });

    it('should prefix sfw when available and not forced', async () => {
      const available = await socket.isAvailable();
      if (!available) {
        return; // skip if sfw not installed
      }
      // echo always succeeds — verifies sfw prefix doesn't break execution
      await socket.wrap('echo "sfw-wrap-test"');
    });

    it('should fall back to plain execution with force flag', async () => {
      await socket.wrap('echo "force-test"', { force: true });
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
      await socket.wrap('node -e "process.exit(3)"', { force: true }).catch((e) => { caught = e; });
      assert.ok(caught, 'expected wrap() to throw');
      assert.strictEqual(caught.reason, 'command-failed');
      assert.strictEqual(caught.code, 3);
    });

    it('should classify a plain failure as command-failed, NOT sfw-blocked (sfw path)', async () => {
      const available = await socket.isAvailable();
      if (!available) {
        return; // skip if sfw not installed
      }

      // Old bug: ANY non-zero exit under sfw was reported as a firewall block
      let caught = null;
      await socket.wrap('node -e "process.exit(4)"').catch((e) => { caught = e; });
      assert.ok(caught, 'expected wrap() to throw');
      assert.strictEqual(caught.reason, 'command-failed');
      assert.strictEqual(caught.code, 4);
    });

    it('should stream output live instead of dumping it after exit (sfw path)', async () => {
      const available = await socket.isAvailable();
      if (!available) {
        return; // skip if sfw not installed
      }

      // The child prints a marker then stays alive 1500ms. If wrap() streams,
      // the marker hits stdout well before wrap() resolves; if it buffers
      // (old bug), the marker only appears at resolve time.
      const marker = 'npu-stream-marker-123';
      const command = `node -e "console.log('${marker}'); setTimeout(() => {}, 1500)"`;

      const originalWrite = process.stdout.write;
      let markerAt = 0;

      process.stdout.write = function (chunk, ...rest) {
        if (!markerAt && String(chunk).includes(marker)) {
          markerAt = Date.now();
        }
        return originalWrite.call(process.stdout, chunk, ...rest);
      };

      try {
        await socket.wrap(command);
      } finally {
        process.stdout.write = originalWrite;
      }

      const resolvedAt = Date.now();
      assert.ok(markerAt > 0, 'marker never appeared on stdout');
      assert.ok(resolvedAt - markerAt >= 1000, `marker appeared only ${resolvedAt - markerAt}ms before resolve — output was buffered, not streamed`);
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
