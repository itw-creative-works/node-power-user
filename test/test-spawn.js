const assert = require('assert');

describe('lib/spawn (exact args through cmd.exe)', () => {
  let spawnLib;

  before(() => {
    spawnLib = require('../dist/lib/spawn');
  });

  describe('cmdArg()', () => {
    it('should leave a plain arg as written', () => {
      assert.strictEqual(spawnLib.cmdArg('sfw@latest', false), 'sfw@latest');
      assert.strictEqual(spawnLib.cmdArg('sfw@latest', true), 'sfw@latest');
    });

    it('should escape the quotes and spaces of a quoted arg once for an .exe', () => {
      assert.strictEqual(spawnLib.cmdArg('two words', false), '^"two^ words^"');
    });

    it('should escape them twice for a batch file, which cmd parses again', () => {
      assert.strictEqual(spawnLib.cmdArg('two words', true), '^^^"two^^^ words^^^"');
    });

    it('should escape % so cmd never expands a variable', () => {
      assert.strictEqual(spawnLib.cmdArg('%PATH%', false), '^"^%PATH^%^"');
    });

    it('should escape an inner quote so a following & stays text', () => {
      assert.strictEqual(spawnLib.cmdArg('1"2 & 3', false), '^"1\\^"2^ ^&^ 3^"');
    });
  });
});
