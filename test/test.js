const package = require('../package.json');
const assert = require('assert');

beforeEach(() => {
});

before(() => {
});

after(() => {
});

/*
 * ============
 *  Test Cases
 * ============
 */
describe(`${package.name}`, () => {
  const library = new (require(`../dist/index.js`))();

  describe('.version()', () => {

    it('should return the package version', async () => {
      return assert.equal(await library.process({version: true}), package.version);
    });

  });

  describe('.outdated()', () => {

    it('should return allPackages as a Map', async () => {
      const result = await library.process({_: ['outdated'], noPrompt: true});
      assert.ok(result, 'Result should exist');
      assert.ok(result.allPackages instanceof Map, 'allPackages should be a Map');
    });

    it('should contain valid package entries with required fields', async () => {
      const result = await library.process({_: ['outdated'], noPrompt: true});
      for (const [name, pkg] of result.allPackages) {
        assert.equal(typeof name, 'string', 'Package name should be a string');
        assert.equal(pkg.name, name, 'pkg.name should match the map key');
        assert.equal(typeof pkg.packageVersion, 'string', 'packageVersion should be a string');
        assert.ok(pkg.installedVersion, 'installedVersion should exist');
        assert.ok(['prod', 'dev', 'peer'].includes(pkg.type), `type should be prod/dev/peer, got: ${pkg.type}`);
        assert.equal(typeof pkg.hasDiscrepancy, 'boolean', 'hasDiscrepancy should be a boolean');
      }
    });

    it('should flag major updates correctly', async () => {
      const result = await library.process({_: ['outdated'], noPrompt: true});
      for (const [, pkg] of result.allPackages) {
        if (pkg.hasMajorUpdate) {
          assert.ok(pkg.latestVersion, 'Major update packages should have a latestVersion');
        }
      }
    });

  });

})
