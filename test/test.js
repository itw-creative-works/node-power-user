const pkg = require('../package.json');
const assert = require('assert');

describe(`${pkg.name}`, () => {
  let library;

  before(() => {
    library = new (require('../dist/index.js'))();
  });

  describe('.process()', () => {
    it('should be a function', () => {
      assert.equal(typeof library.process, 'function');
    });
  });

  describe('.version()', () => {
    it('should return the package version', async () => {
      return assert.equal(await library.process({ version: true }), pkg.version);
    });
  });
});
