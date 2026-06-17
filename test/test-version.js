const assert = require('assert');
const pkg = require('../package.json');

describe('version command', () => {
  let library;

  before(() => {
    library = new (require('../dist/index.js'))();
  });

  it('should return a semver string', async () => {
    const result = await library.process({ version: true });
    assert.match(result, /^\d+\.\d+\.\d+/);
  });

  it('should match package.json version', async () => {
    const result = await library.process({ version: true });
    assert.equal(result, pkg.version);
  });

  it('should work via -v flag', async () => {
    const result = await library.process({ _: [], v: true });
    assert.equal(result, pkg.version);
  });

  it('should work via positional "version" command', async () => {
    const result = await library.process({ _: ['version'] });
    assert.equal(result, pkg.version);
  });

  it('should be the default command (no args)', async () => {
    const result = await library.process({ _: [] });
    assert.equal(result, pkg.version);
  });
});
