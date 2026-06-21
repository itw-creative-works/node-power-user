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

  describe('audit()', () => {
    it('should be a no-op (sfw handles protection at install time)', async () => {
      // audit() should resolve immediately without doing anything
      const result = await socket.audit();
      assert.strictEqual(result, undefined);
    });
  });
});
