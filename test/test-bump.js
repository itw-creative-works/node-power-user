const assert = require('assert');
const version = require('wonderful-version');

describe('bump command', () => {
  // Test the version increment logic directly (wonderful-version)
  // The actual bump command modifies package.json, so we test the underlying logic.
  describe('version increment logic', () => {
    it('should increment patch version', () => {
      assert.equal(version.increment('1.0.0', 'patch'), '1.0.1');
    });

    it('should increment minor version', () => {
      assert.equal(version.increment('1.0.0', 'minor'), '1.1.0');
    });

    it('should increment major version', () => {
      assert.equal(version.increment('1.0.0', 'major'), '2.0.0');
    });

    it('should reset lower fields on minor bump', () => {
      assert.equal(version.increment('1.2.3', 'minor'), '1.3.0');
    });

    it('should reset lower fields on major bump', () => {
      assert.equal(version.increment('1.2.3', 'major'), '2.0.0');
    });

    it('should handle double-digit versions', () => {
      assert.equal(version.increment('10.20.30', 'patch'), '10.20.31');
    });

    it('should handle 0.x versions', () => {
      assert.equal(version.increment('0.1.0', 'minor'), '0.2.0');
    });

    it('should handle 0.x major bump', () => {
      assert.equal(version.increment('0.9.0', 'major'), '1.0.0');
    });
  });

  describe('version comparison (wonderful-version)', () => {
    it('should compare equal versions', () => {
      assert.ok(version.is('1.0.0', '==', '1.0.0'));
    });

    it('should compare greater versions', () => {
      assert.ok(version.is('2.0.0', '>', '1.0.0'));
    });

    it('should compare lesser versions', () => {
      assert.ok(version.is('1.0.0', '<', '2.0.0'));
    });

    it('should handle minor differences', () => {
      assert.ok(version.is('1.1.0', '>', '1.0.0'));
    });

    it('should handle patch differences', () => {
      assert.ok(version.is('1.0.1', '>', '1.0.0'));
    });
  });
});
