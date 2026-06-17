const assert = require('assert');
const path = require('path');
const os = require('os');
const jetpack = require('fs-jetpack');
const npm = require('../dist/lib/npm');

function createTmpDir() {
  const dir = path.join(os.tmpdir(), `npu-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  jetpack.dir(dir);
  return dir;
}

describe('lib/npm', () => {
  // ═══════════════════════════════════════════════════════════════════
  //  findDesynced
  // ═══════════════════════════════════════════════════════════════════
  describe('findDesynced', () => {
    it('should return empty array when no hidden lockfile exists', () => {
      const tmp = createTmpDir();
      try {
        const result = npm.findDesynced(tmp);
        assert.deepEqual(result, []);
      } finally {
        jetpack.remove(tmp);
      }
    });

    it('should return empty array when all packages are in sync', () => {
      const tmp = createTmpDir();
      try {
        jetpack.write(path.join(tmp, 'node_modules/.package-lock.json'), {
          packages: {
            'node_modules/lodash': { version: '4.17.21' },
          },
        });
        jetpack.write(path.join(tmp, 'node_modules/lodash/package.json'), {
          name: 'lodash',
          version: '4.17.21',
        });

        const result = npm.findDesynced(tmp);
        assert.deepEqual(result, []);
      } finally {
        jetpack.remove(tmp);
      }
    });

    it('should detect version mismatch between lockfile and disk', () => {
      const tmp = createTmpDir();
      try {
        jetpack.write(path.join(tmp, 'node_modules/.package-lock.json'), {
          packages: {
            'node_modules/lodash': { version: '4.17.21' },
          },
        });
        jetpack.write(path.join(tmp, 'node_modules/lodash/package.json'), {
          name: 'lodash',
          version: '4.17.20',
        });

        const result = npm.findDesynced(tmp);
        assert.equal(result.length, 1);
        assert.equal(result[0].loc, 'node_modules/lodash');
        assert.equal(result[0].lockfileVersion, '4.17.21');
        assert.equal(result[0].diskVersion, '4.17.20');
      } finally {
        jetpack.remove(tmp);
      }
    });

    it('should detect missing packages (not installed on disk)', () => {
      const tmp = createTmpDir();
      try {
        jetpack.write(path.join(tmp, 'node_modules/.package-lock.json'), {
          packages: {
            'node_modules/missing-pkg': { version: '1.0.0' },
          },
        });

        const result = npm.findDesynced(tmp);
        assert.equal(result.length, 1);
        assert.equal(result[0].loc, 'node_modules/missing-pkg');
        assert.equal(result[0].lockfileVersion, '1.0.0');
        assert.equal(result[0].diskVersion, null);
      } finally {
        jetpack.remove(tmp);
      }
    });

    it('should skip optional packages that are missing (platform-specific)', () => {
      const tmp = createTmpDir();
      try {
        jetpack.write(path.join(tmp, 'node_modules/.package-lock.json'), {
          packages: {
            'node_modules/@esbuild/darwin-arm64': { version: '0.19.0', optional: true },
          },
        });

        const result = npm.findDesynced(tmp);
        assert.deepEqual(result, []);
      } finally {
        jetpack.remove(tmp);
      }
    });

    it('should skip linked packages', () => {
      const tmp = createTmpDir();
      try {
        jetpack.write(path.join(tmp, 'node_modules/.package-lock.json'), {
          packages: {
            'node_modules/my-linked-pkg': { version: '1.0.0', link: true },
          },
        });

        const result = npm.findDesynced(tmp);
        assert.deepEqual(result, []);
      } finally {
        jetpack.remove(tmp);
      }
    });

    it('should skip entries that do not start with node_modules/', () => {
      const tmp = createTmpDir();
      try {
        jetpack.write(path.join(tmp, 'node_modules/.package-lock.json'), {
          packages: {
            '': { version: '1.0.0' },
            'some-other-path': { version: '1.0.0' },
          },
        });

        const result = npm.findDesynced(tmp);
        assert.deepEqual(result, []);
      } finally {
        jetpack.remove(tmp);
      }
    });

    it('should handle nested node_modules (transitive deps)', () => {
      const tmp = createTmpDir();
      try {
        jetpack.write(path.join(tmp, 'node_modules/.package-lock.json'), {
          packages: {
            'node_modules/mocha/node_modules/brace-expansion': { version: '2.0.1' },
          },
        });
        jetpack.write(path.join(tmp, 'node_modules/mocha/node_modules/brace-expansion/package.json'), {
          name: 'brace-expansion',
          version: '1.1.11',
        });

        const result = npm.findDesynced(tmp);
        assert.equal(result.length, 1);
        assert.equal(result[0].loc, 'node_modules/mocha/node_modules/brace-expansion');
        assert.equal(result[0].lockfileVersion, '2.0.1');
        assert.equal(result[0].diskVersion, '1.1.11');
      } finally {
        jetpack.remove(tmp);
      }
    });

    it('should detect multiple desynced packages', () => {
      const tmp = createTmpDir();
      try {
        jetpack.write(path.join(tmp, 'node_modules/.package-lock.json'), {
          packages: {
            'node_modules/a': { version: '2.0.0' },
            'node_modules/b': { version: '3.0.0' },
            'node_modules/c': { version: '1.0.0' },
          },
        });
        jetpack.write(path.join(tmp, 'node_modules/a/package.json'), { version: '1.0.0' });
        jetpack.write(path.join(tmp, 'node_modules/b/package.json'), { version: '2.0.0' });
        jetpack.write(path.join(tmp, 'node_modules/c/package.json'), { version: '1.0.0' });

        const result = npm.findDesynced(tmp);
        assert.equal(result.length, 2);
        const locs = result.map(d => d.loc);
        assert.ok(locs.includes('node_modules/a'));
        assert.ok(locs.includes('node_modules/b'));
      } finally {
        jetpack.remove(tmp);
      }
    });

    it('should skip entries without a version in the lockfile', () => {
      const tmp = createTmpDir();
      try {
        jetpack.write(path.join(tmp, 'node_modules/.package-lock.json'), {
          packages: {
            'node_modules/no-version': {},
          },
        });

        const result = npm.findDesynced(tmp);
        assert.deepEqual(result, []);
      } finally {
        jetpack.remove(tmp);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  verifyInstalled
  // ═══════════════════════════════════════════════════════════════════
  describe('verifyInstalled', () => {
    it('should return empty array when all versions match', () => {
      const tmp = createTmpDir();
      try {
        jetpack.write(path.join(tmp, 'node_modules/lodash/package.json'), {
          name: 'lodash',
          version: '4.17.21',
        });

        const result = npm.verifyInstalled({ lodash: '4.17.21' }, tmp);
        assert.deepEqual(result, []);
      } finally {
        jetpack.remove(tmp);
      }
    });

    it('should detect version mismatch', () => {
      const tmp = createTmpDir();
      try {
        jetpack.write(path.join(tmp, 'node_modules/lodash/package.json'), {
          name: 'lodash',
          version: '4.17.20',
        });

        const result = npm.verifyInstalled({ lodash: '4.17.21' }, tmp);
        assert.equal(result.length, 1);
        assert.equal(result[0].name, 'lodash');
        assert.equal(result[0].expected, '4.17.21');
        assert.equal(result[0].actual, '4.17.20');
      } finally {
        jetpack.remove(tmp);
      }
    });

    it('should report missing packages', () => {
      const tmp = createTmpDir();
      try {
        const result = npm.verifyInstalled({ 'not-installed': '1.0.0' }, tmp);
        assert.equal(result.length, 1);
        assert.equal(result[0].name, 'not-installed');
        assert.equal(result[0].actual, 'missing');
      } finally {
        jetpack.remove(tmp);
      }
    });

    it('should verify multiple packages at once', () => {
      const tmp = createTmpDir();
      try {
        jetpack.write(path.join(tmp, 'node_modules/a/package.json'), { version: '1.0.0' });
        jetpack.write(path.join(tmp, 'node_modules/b/package.json'), { version: '2.0.0' });

        const result = npm.verifyInstalled({ a: '1.0.0', b: '2.0.0' }, tmp);
        assert.deepEqual(result, []);
      } finally {
        jetpack.remove(tmp);
      }
    });

    it('should handle versions with range prefixes via version.clean', () => {
      const tmp = createTmpDir();
      try {
        jetpack.write(path.join(tmp, 'node_modules/pkg/package.json'), { version: '1.2.3' });

        const result = npm.verifyInstalled({ pkg: '^1.2.3' }, tmp);
        assert.deepEqual(result, []);
      } finally {
        jetpack.remove(tmp);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  removeInstalledCopies
  // ═══════════════════════════════════════════════════════════════════
  describe('removeInstalledCopies', () => {
    it('should remove specified package directories', () => {
      const tmp = createTmpDir();
      try {
        jetpack.write(path.join(tmp, 'node_modules/lodash/package.json'), { version: '4.17.21' });
        assert.ok(jetpack.exists(path.join(tmp, 'node_modules/lodash')));

        npm.removeInstalledCopies(['lodash'], tmp);
        assert.equal(jetpack.exists(path.join(tmp, 'node_modules/lodash')), false);
      } finally {
        jetpack.remove(tmp);
      }
    });

    it('should remove multiple packages', () => {
      const tmp = createTmpDir();
      try {
        jetpack.write(path.join(tmp, 'node_modules/a/package.json'), { version: '1.0.0' });
        jetpack.write(path.join(tmp, 'node_modules/b/package.json'), { version: '2.0.0' });
        jetpack.write(path.join(tmp, 'node_modules/c/package.json'), { version: '3.0.0' });

        npm.removeInstalledCopies(['a', 'c'], tmp);
        assert.equal(jetpack.exists(path.join(tmp, 'node_modules/a')), false);
        assert.ok(jetpack.exists(path.join(tmp, 'node_modules/b')));
        assert.equal(jetpack.exists(path.join(tmp, 'node_modules/c')), false);
      } finally {
        jetpack.remove(tmp);
      }
    });

    it('should not throw when package does not exist', () => {
      const tmp = createTmpDir();
      try {
        assert.doesNotThrow(() => {
          npm.removeInstalledCopies(['nonexistent'], tmp);
        });
      } finally {
        jetpack.remove(tmp);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  removeLocations
  // ═══════════════════════════════════════════════════════════════════
  describe('removeLocations', () => {
    it('should remove directories by lockfile location path', () => {
      const tmp = createTmpDir();
      try {
        const nested = path.join(tmp, 'node_modules/mocha/node_modules/brace-expansion');
        jetpack.write(path.join(nested, 'package.json'), { version: '1.0.0' });
        assert.ok(jetpack.exists(nested));

        npm.removeLocations(['node_modules/mocha/node_modules/brace-expansion'], tmp);
        assert.equal(jetpack.exists(nested), false);
      } finally {
        jetpack.remove(tmp);
      }
    });

    it('should handle multiple locations', () => {
      const tmp = createTmpDir();
      try {
        jetpack.write(path.join(tmp, 'node_modules/a/package.json'), {});
        jetpack.write(path.join(tmp, 'node_modules/b/node_modules/c/package.json'), {});

        npm.removeLocations(['node_modules/a', 'node_modules/b/node_modules/c'], tmp);
        assert.equal(jetpack.exists(path.join(tmp, 'node_modules/a')), false);
        assert.equal(jetpack.exists(path.join(tmp, 'node_modules/b/node_modules/c')), false);
      } finally {
        jetpack.remove(tmp);
      }
    });
  });
});
