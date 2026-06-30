const assert = require('assert');
const version = require('wonderful-version');

describe('outdated command', () => {
  // ═══════════════════════════════════════════════════════════════════
  //  hasMajorUpdate logic (THE BUG FIX)
  //
  //  Old code: hasMajorUpdate = latestVersion && minorVersion !== latestVersion
  //  Fixed:    hasMajorUpdate = latestVersion && latestVersion.split('.')[0] !== packageVersion.split('.')[0]
  //
  //  The old heuristic broke when ncu didn't return a package in its
  //  "minor" tier, causing minorVersion to be null and any update to
  //  be flagged as a breaking change — even a minor bump like
  //  electron-builder 26.8.1 → 26.15.3.
  // ═══════════════════════════════════════════════════════════════════
  describe('hasMajorUpdate detection', () => {
    function hasMajorUpdate(packageVersion, latestVersion) {
      return latestVersion && latestVersion.split('.')[0] !== packageVersion.split('.')[0];
    }

    describe('same-major bumps (should NOT flag)', () => {
      it('26.8.1 → 26.15.3 (the notifly-desktop bug)', () => {
        assert.equal(hasMajorUpdate('26.8.1', '26.15.3'), false);
      });

      it('42.0.1 → 42.4.1 (electron-style)', () => {
        assert.equal(hasMajorUpdate('42.0.1', '42.4.1'), false);
      });

      it('1.0.0 → 1.0.5 (patch only)', () => {
        assert.equal(hasMajorUpdate('1.0.0', '1.0.5'), false);
      });

      it('1.2.3 → 1.9.0 (minor jump)', () => {
        assert.equal(hasMajorUpdate('1.2.3', '1.9.0'), false);
      });

      it('0.1.0 → 0.9.0 (0.x minor jump)', () => {
        assert.equal(hasMajorUpdate('0.1.0', '0.9.0'), false);
      });

      it('3.0.0 → 3.0.0 (no change)', () => {
        assert.equal(hasMajorUpdate('3.0.0', '3.0.0'), false);
      });

      it('100.0.0 → 100.99.99 (large version numbers)', () => {
        assert.equal(hasMajorUpdate('100.0.0', '100.99.99'), false);
      });
    });

    describe('cross-major bumps (SHOULD flag)', () => {
      it('4.0.0 → 5.0.0 (clean major bump)', () => {
        assert.equal(hasMajorUpdate('4.0.0', '5.0.0'), true);
      });

      it('4.17.21 → 5.0.0 (major with trailing minor/patch)', () => {
        assert.equal(hasMajorUpdate('4.17.21', '5.0.0'), true);
      });

      it('1.0.0 → 3.0.0 (multi-major jump)', () => {
        assert.equal(hasMajorUpdate('1.0.0', '3.0.0'), true);
      });

      it('0.9.0 → 1.0.0 (0.x → 1.x)', () => {
        assert.equal(hasMajorUpdate('0.9.0', '1.0.0'), true);
      });

      it('1.99.99 → 2.0.0 (right at boundary)', () => {
        assert.equal(hasMajorUpdate('1.99.99', '2.0.0'), true);
      });
    });

    describe('edge cases', () => {
      it('should return falsy when latestVersion is null', () => {
        assert.ok(!hasMajorUpdate('1.0.0', null));
      });

      it('should return falsy when latestVersion is undefined', () => {
        assert.ok(!hasMajorUpdate('1.0.0', undefined));
      });

      it('should return falsy when latestVersion is empty string', () => {
        assert.ok(!hasMajorUpdate('1.0.0', ''));
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Old hasMajorUpdate logic (verifies the OLD code was broken)
  //
  //  This demonstrates exactly why the old approach failed.
  // ═══════════════════════════════════════════════════════════════════
  describe('old hasMajorUpdate logic (proving the bug)', () => {
    function oldHasMajorUpdate(minorVersion, latestVersion) {
      return latestVersion && minorVersion !== latestVersion;
    }

    it('would INCORRECTLY flag 26.8.1 → 26.15.3 when minorVersion is null', () => {
      // When ncu doesn't return a package in the "minor" tier, minorVersion is null
      // but latestVersion is set → the old check evaluates null !== '26.15.3' → true
      const minorVersion = null;
      const latestVersion = '26.15.3';
      assert.equal(oldHasMajorUpdate(minorVersion, latestVersion), true,
        'Old logic should produce a false positive here — this is the bug');
    });

    it('would INCORRECTLY flag when minorVersion differs from latestVersion for non-major reasons', () => {
      // If ncu returns slightly different versions for minor vs latest
      // (e.g., due to prerelease tags), the old check would false-positive
      const minorVersion = '26.15.2';
      const latestVersion = '26.15.3';
      assert.equal(oldHasMajorUpdate(minorVersion, latestVersion), true,
        'Old logic would flag this even though both are major 26');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  hasMajorBeyondMinor (menu option visibility)
  // ═══════════════════════════════════════════════════════════════════
  describe('hasMajorBeyondMinor detection', () => {
    function hasMajorBeyondMinor(latestUpgrades, allDependencies) {
      return Object.keys(latestUpgrades).some(dep => {
        const latestMajor = version.clean(latestUpgrades[dep]).split('.')[0];
        const currentMajor = version.clean(allDependencies[dep]).split('.')[0];
        return latestMajor !== currentMajor;
      });
    }

    it('should NOT show Major menu for notifly-desktop scenario (all minor bumps)', () => {
      const latestUpgrades = {
        'electron': '^42.4.1',
        'electron-builder': '^26.15.3',
      };
      const allDependencies = {
        'electron': '^42.0.1',
        'electron-builder': '^26.8.1',
      };
      assert.equal(hasMajorBeyondMinor(latestUpgrades, allDependencies), false);
    });

    it('should show Major menu when one dep has a real major bump', () => {
      const latestUpgrades = {
        'electron': '^42.4.1',
        'some-lib': '^5.0.0',
      };
      const allDependencies = {
        'electron': '^42.0.1',
        'some-lib': '^4.2.1',
      };
      assert.equal(hasMajorBeyondMinor(latestUpgrades, allDependencies), true);
    });

    it('should return false when no upgrades exist', () => {
      assert.equal(hasMajorBeyondMinor({}, {}), false);
    });

    it('should handle tilde ranges', () => {
      const latestUpgrades = { 'pkg-a': '~2.5.0' };
      const allDependencies = { 'pkg-a': '~2.3.0' };
      assert.equal(hasMajorBeyondMinor(latestUpgrades, allDependencies), false);
    });

    it('should handle bare versions (no range prefix)', () => {
      const latestUpgrades = { 'pkg-a': '3.0.0' };
      const allDependencies = { 'pkg-a': '2.9.0' };
      assert.equal(hasMajorBeyondMinor(latestUpgrades, allDependencies), true);
    });

    it('should handle >= ranges', () => {
      const latestUpgrades = { 'pkg-a': '>=2.0.0' };
      const allDependencies = { 'pkg-a': '>=1.5.0' };
      assert.equal(hasMajorBeyondMinor(latestUpgrades, allDependencies), true);
    });

    it('should return false when all deps stay on same major', () => {
      const latestUpgrades = {
        'a': '^1.5.0',
        'b': '^2.8.0',
        'c': '^10.3.0',
      };
      const allDependencies = {
        'a': '^1.0.0',
        'b': '^2.1.0',
        'c': '^10.0.0',
      };
      assert.equal(hasMajorBeyondMinor(latestUpgrades, allDependencies), false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  getDependencyType helper
  // ═══════════════════════════════════════════════════════════════════
  describe('getDependencyType', () => {
    function getDependencyType(packageJson, dep) {
      if (packageJson.devDependencies?.[dep]) {
        return 'dev';
      }
      if (packageJson.peerDependencies?.[dep]) {
        return 'peer';
      }
      return 'prod';
    }

    const mockPkg = {
      dependencies: { 'express': '^4.0.0', 'lodash': '^4.17.0' },
      devDependencies: { 'mocha': '^11.0.0', 'eslint': '^9.0.0' },
      peerDependencies: { 'react': '^18.0.0' },
    };

    it('should return "prod" for production dependencies', () => {
      assert.equal(getDependencyType(mockPkg, 'express'), 'prod');
    });

    it('should return "prod" for second production dependency', () => {
      assert.equal(getDependencyType(mockPkg, 'lodash'), 'prod');
    });

    it('should return "dev" for devDependencies', () => {
      assert.equal(getDependencyType(mockPkg, 'mocha'), 'dev');
    });

    it('should return "dev" for second devDependency', () => {
      assert.equal(getDependencyType(mockPkg, 'eslint'), 'dev');
    });

    it('should return "peer" for peerDependencies', () => {
      assert.equal(getDependencyType(mockPkg, 'react'), 'peer');
    });

    it('should default to "prod" for unknown packages', () => {
      assert.equal(getDependencyType(mockPkg, 'not-a-dep'), 'prod');
    });

    it('should handle package.json with no dependency sections', () => {
      assert.equal(getDependencyType({}, 'anything'), 'prod');
    });

    it('should handle package.json with only dependencies', () => {
      assert.equal(getDependencyType({ dependencies: { a: '1.0.0' } }, 'a'), 'prod');
    });

    it('should handle package.json with only devDependencies', () => {
      assert.equal(getDependencyType({ devDependencies: { a: '1.0.0' } }, 'a'), 'dev');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Fixture: notifly-desktop scenario
  //
  //  This simulates the exact scenario from the bug report:
  //    electron      42.0.1 (pkg.json) → 42.4.0 (installed) → 42.4.1 (latest)
  //    electron-builder 26.8.1 (pkg.json) → 26.15.3 (installed) → 26.15.3 (latest)
  //
  //  Both should NOT be flagged as major/breaking changes.
  // ═══════════════════════════════════════════════════════════════════
  describe('fixture: notifly-desktop scenario', () => {
    function buildPackageData(packageVersion, installedVersion, patchVersion, minorVersion, latestVersion) {
      return {
        packageVersion,
        installedVersion,
        patchVersion,
        minorVersion,
        latestVersion,
        hasMajorUpdate: latestVersion && latestVersion.split('.')[0] !== packageVersion.split('.')[0],
      };
    }

    it('electron 42.0.1 → 42.4.1 should NOT be flagged as major', () => {
      const pkg = buildPackageData('42.0.1', '42.4.0', '42.0.1', '42.4.1', '42.4.1');
      assert.equal(pkg.hasMajorUpdate, false);
    });

    it('electron-builder 26.8.1 → 26.15.3 should NOT be flagged as major', () => {
      const pkg = buildPackageData('26.8.1', '26.15.3', null, '26.15.3', '26.15.3');
      assert.equal(pkg.hasMajorUpdate, false);
    });

    it('electron-builder 26.8.1 → 26.15.3 with null minorVersion should NOT be flagged as major', () => {
      // This is the exact failure mode: ncu didn't return electron-builder in minor tier
      const pkg = buildPackageData('26.8.1', '26.15.3', null, null, '26.15.3');
      assert.equal(pkg.hasMajorUpdate, false);
    });

    it('hypothetical lodash 4.17.21 → 5.0.0 SHOULD be flagged as major', () => {
      const pkg = buildPackageData('4.17.21', '4.17.21', '4.17.21', '4.17.21', '5.0.0');
      assert.equal(pkg.hasMajorUpdate, true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Fixture: mixed upgrade scenario
  //
  //  Some packages have minor updates, some have major updates.
  //  Verify the classification is correct for each.
  // ═══════════════════════════════════════════════════════════════════
  describe('fixture: mixed upgrade scenario', () => {
    const packages = [
      { name: 'express',    current: '4.18.0', latest: '4.21.0', expectMajor: false },
      { name: 'react',      current: '18.2.0', latest: '19.0.0', expectMajor: true },
      { name: 'typescript', current: '5.3.0',  latest: '5.7.0',  expectMajor: false },
      { name: 'webpack',    current: '5.90.0', latest: '6.0.0',  expectMajor: true },
      { name: 'chalk',      current: '5.3.0',  latest: '5.6.0',  expectMajor: false },
      { name: 'mocha',      current: '10.7.0', latest: '11.0.0', expectMajor: true },
      { name: 'eslint',     current: '8.56.0', latest: '9.0.0',  expectMajor: true },
      { name: 'prettier',   current: '3.1.0',  latest: '3.5.0',  expectMajor: false },
    ];

    for (const pkg of packages) {
      const label = pkg.expectMajor ? 'SHOULD' : 'should NOT';
      it(`${pkg.name} ${pkg.current} → ${pkg.latest} ${label} be flagged as major`, () => {
        const hasMajor = pkg.latest.split('.')[0] !== pkg.current.split('.')[0];
        assert.equal(hasMajor, pkg.expectMajor);
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  //  version.clean integration (our fix depends on cleaned versions)
  // ═══════════════════════════════════════════════════════════════════
  describe('version.clean integration', () => {
    it('should strip caret prefix', () => {
      assert.equal(version.clean('^26.8.1'), '26.8.1');
    });

    it('should strip tilde prefix', () => {
      assert.equal(version.clean('~26.8.1'), '26.8.1');
    });

    it('should leave bare versions unchanged', () => {
      assert.equal(version.clean('26.8.1'), '26.8.1');
    });

    it('should strip >= prefix', () => {
      assert.equal(version.clean('>=4.0.0'), '4.0.0');
    });

    it('cleaned version should produce correct major extraction', () => {
      const cleaned = version.clean('^26.8.1');
      assert.equal(cleaned.split('.')[0], '26');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  minAge configuration (--min-age flag parsing)
  // ═══════════════════════════════════════════════════════════════════
  describe('minAge configuration', () => {
    function parseMinAge(optionsMinAge) {
      return optionsMinAge != null ? Number(optionsMinAge) : 7;
    }

    it('should default to 7 when not provided', () => {
      assert.equal(parseMinAge(undefined), 7);
    });

    it('should default to 7 when null', () => {
      assert.equal(parseMinAge(null), 7);
    });

    it('should accept 0 (disable age filtering)', () => {
      assert.equal(parseMinAge(0), 0);
    });

    it('should accept custom values', () => {
      assert.equal(parseMinAge(14), 14);
    });

    it('should accept string numbers from CLI args', () => {
      assert.equal(parseMinAge('30'), 30);
    });

    it('should return NaN for non-numeric strings (graceful degradation)', () => {
      assert.ok(isNaN(parseMinAge('abc')));
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  tooNew package filtering (--min-age auto-skip during updates)
  //
  //  During patch/minor/major updates, packages whose target version
  //  was published < minAge days ago are skipped — UNLESS the version
  //  is already installed (no new code to download).
  // ═══════════════════════════════════════════════════════════════════
  describe('tooNew package filtering', () => {
    function filterTooNew(packages, upgrades, minAge) {
      return packages
        .filter(pkg => pkg.daysSincePublish != null && pkg.daysSincePublish < minAge)
        .filter(pkg => upgrades[pkg.name] && pkg.installedVersion !== version.clean(upgrades[pkg.name]))
        .map(pkg => pkg.name);
    }

    const upgrades = {
      'nanoid': '^5.1.16',
      'uuid': '^14.0.1',
      'chalk': '^5.6.2',
    };

    it('should skip packages published < minAge days ago', () => {
      const packages = [
        { name: 'nanoid', daysSincePublish: 5, installedVersion: '5.1.11' },
      ];
      assert.deepEqual(filterTooNew(packages, upgrades, 7), ['nanoid']);
    });

    it('should NOT skip packages published >= minAge days ago', () => {
      const packages = [
        { name: 'uuid', daysSincePublish: 9, installedVersion: '14.0.0' },
      ];
      assert.deepEqual(filterTooNew(packages, upgrades, 7), []);
    });

    it('should NOT skip packages already installed at the target version', () => {
      const packages = [
        { name: 'nanoid', daysSincePublish: 2, installedVersion: '5.1.16' },
      ];
      assert.deepEqual(filterTooNew(packages, upgrades, 7), []);
    });

    it('should NOT skip packages when daysSincePublish is null', () => {
      const packages = [
        { name: 'nanoid', daysSincePublish: null, installedVersion: '5.1.11' },
      ];
      assert.deepEqual(filterTooNew(packages, upgrades, 7), []);
    });

    it('should NOT skip packages when daysSincePublish is undefined', () => {
      const packages = [
        { name: 'nanoid', installedVersion: '5.1.11' },
      ];
      assert.deepEqual(filterTooNew(packages, upgrades, 7), []);
    });

    it('should NOT skip any packages when minAge is 0', () => {
      const packages = [
        { name: 'nanoid', daysSincePublish: 0, installedVersion: '5.1.11' },
        { name: 'uuid', daysSincePublish: 1, installedVersion: '14.0.0' },
      ];
      assert.deepEqual(filterTooNew(packages, upgrades, 0), []);
    });

    it('should NOT skip packages not in the upgrades list', () => {
      const packages = [
        { name: 'not-in-upgrades', daysSincePublish: 2, installedVersion: '1.0.0' },
      ];
      assert.deepEqual(filterTooNew(packages, upgrades, 7), []);
    });

    it('should handle mixed packages — skip only the too-new ones', () => {
      const packages = [
        { name: 'nanoid', daysSincePublish: 5, installedVersion: '5.1.11' },
        { name: 'uuid', daysSincePublish: 9, installedVersion: '14.0.0' },
        { name: 'chalk', daysSincePublish: 294, installedVersion: '5.3.0' },
      ];
      assert.deepEqual(filterTooNew(packages, upgrades, 7), ['nanoid']);
    });

    it('should respect custom minAge threshold', () => {
      const packages = [
        { name: 'nanoid', daysSincePublish: 5, installedVersion: '5.1.11' },
        { name: 'uuid', daysSincePublish: 9, installedVersion: '14.0.0' },
        { name: 'chalk', daysSincePublish: 294, installedVersion: '5.3.0' },
      ];
      assert.deepEqual(filterTooNew(packages, upgrades, 14), ['nanoid', 'uuid']);
    });

    it('should skip all packages with high minAge', () => {
      const packages = [
        { name: 'nanoid', daysSincePublish: 5, installedVersion: '5.1.11' },
        { name: 'uuid', daysSincePublish: 9, installedVersion: '14.0.0' },
        { name: 'chalk', daysSincePublish: 294, installedVersion: '5.3.0' },
      ];
      assert.deepEqual(filterTooNew(packages, upgrades, 365), ['nanoid', 'uuid', 'chalk']);
    });

    it('should NOT skip at exact boundary (daysSincePublish === minAge)', () => {
      const packages = [
        { name: 'nanoid', daysSincePublish: 7, installedVersion: '5.1.11' },
      ];
      assert.deepEqual(filterTooNew(packages, upgrades, 7), []);
    });

    it('should skip packages published today (0d)', () => {
      const packages = [
        { name: 'nanoid', daysSincePublish: 0, installedVersion: '5.1.11' },
      ];
      assert.deepEqual(filterTooNew(packages, upgrades, 7), ['nanoid']);
    });

    it('should handle empty packages list', () => {
      assert.deepEqual(filterTooNew([], upgrades, 7), []);
    });

    it('should handle empty upgrades list', () => {
      const packages = [
        { name: 'nanoid', daysSincePublish: 2, installedVersion: '5.1.11' },
      ];
      assert.deepEqual(filterTooNew(packages, {}, 7), []);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Release date display logic (⚠ warning threshold)
  // ═══════════════════════════════════════════════════════════════════
  describe('release date display', () => {
    function shouldWarn(daysSincePublish, minAge) {
      return daysSincePublish != null && daysSincePublish < minAge;
    }

    it('should warn when published < minAge days ago', () => {
      assert.equal(shouldWarn(3, 7), true);
    });

    it('should NOT warn when published >= minAge days ago', () => {
      assert.equal(shouldWarn(10, 7), false);
    });

    it('should NOT warn when daysSincePublish is null', () => {
      assert.equal(shouldWarn(null, 7), false);
    });

    it('should NOT warn when daysSincePublish is undefined', () => {
      assert.equal(shouldWarn(undefined, 7), false);
    });

    it('should NOT warn when minAge is 0 (all ages OK)', () => {
      assert.equal(shouldWarn(0, 0), false);
    });

    it('should warn for 0d old with default minAge', () => {
      assert.equal(shouldWarn(0, 7), true);
    });

    it('should NOT warn at exact boundary (7d, minAge 7)', () => {
      assert.equal(shouldWarn(7, 7), false);
    });

    it('should respect custom minAge', () => {
      assert.equal(shouldWarn(10, 14), true);
      assert.equal(shouldWarn(10, 10), false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  daysSincePublish calculation
  // ═══════════════════════════════════════════════════════════════════
  describe('daysSincePublish calculation', () => {
    function calcDays(publishDateISO, now) {
      const date = new Date(publishDateISO);
      return Math.floor((now - date.getTime()) / (1000 * 60 * 60 * 24));
    }

    const now = new Date('2026-06-29T12:00:00Z').getTime();

    it('should return 0 for same-day publish', () => {
      assert.equal(calcDays('2026-06-29T08:00:00Z', now), 0);
    });

    it('should return 1 for yesterday publish', () => {
      assert.equal(calcDays('2026-06-28T08:00:00Z', now), 1);
    });

    it('should return 7 for a week ago', () => {
      assert.equal(calcDays('2026-06-22T12:00:00Z', now), 7);
    });

    it('should return 365 for a year ago', () => {
      assert.equal(calcDays('2025-06-29T12:00:00Z', now), 365);
    });

    it('should floor partial days', () => {
      assert.equal(calcDays('2026-06-28T20:00:00Z', now), 0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Integration: run outdated against this project (live)
  // ═══════════════════════════════════════════════════════════════════
  describe('integration (live)', function () {
    this.timeout(30000);

    let result;
    let library;

    before(async function () {
      library = new (require('../dist/index.js'))();
      result = await library.process({ _: ['outdated'], noPrompt: true });
    });

    it('should return a result object', () => {
      assert.ok(result);
    });

    it('should return allPackages as a Map', () => {
      assert.ok(result.allPackages instanceof Map);
    });

    it('should return desynced as an array', () => {
      assert.ok(Array.isArray(result.desynced));
    });

    it('should contain valid package entries with required fields', () => {
      for (const [name, pkg] of result.allPackages) {
        assert.equal(typeof name, 'string', 'key should be a string');
        assert.equal(pkg.name, name, 'pkg.name should match the map key');
        assert.equal(typeof pkg.packageVersion, 'string', 'packageVersion should be a string');
        assert.ok(pkg.installedVersion, 'installedVersion should exist');
        assert.ok(['prod', 'dev', 'peer'].includes(pkg.type), `type should be prod/dev/peer, got: ${pkg.type}`);
        assert.equal(typeof pkg.hasDiscrepancy, 'boolean', 'hasDiscrepancy should be boolean');
        assert.equal(typeof pkg.hasMajorUpdate, 'boolean', 'hasMajorUpdate should be boolean');
      }
    });

    it('should only flag hasMajorUpdate when major version actually differs', () => {
      for (const [name, pkg] of result.allPackages) {
        if (!pkg.latestVersion || !pkg.packageVersion) {
          continue;
        }

        const currentMajor = pkg.packageVersion.split('.')[0];
        const latestMajor = pkg.latestVersion.split('.')[0];

        if (currentMajor === latestMajor) {
          assert.equal(pkg.hasMajorUpdate, false,
            `${name} ${pkg.packageVersion} → ${pkg.latestVersion} incorrectly flagged as major update`);
        }
      }
    });

    it('should have latestVersion set for packages flagged as major', () => {
      for (const [name, pkg] of result.allPackages) {
        if (pkg.hasMajorUpdate) {
          assert.ok(pkg.latestVersion, `${name} flagged as major but has no latestVersion`);
        }
      }
    });

    it('desynced entries should have required fields', () => {
      for (const d of result.desynced) {
        assert.equal(typeof d.loc, 'string', 'loc should be a string');
        assert.ok(d.lockfileVersion, 'lockfileVersion should exist');
      }
    });

    it('should include publishedDate and daysSincePublish for packages with latestVersion', () => {
      for (const [name, pkg] of result.allPackages) {
        if (pkg.latestVersion && pkg.publishedDate) {
          assert.ok(pkg.publishedDate instanceof Date, `${name} publishedDate should be a Date`);
          assert.equal(typeof pkg.daysSincePublish, 'number', `${name} daysSincePublish should be a number`);
          assert.ok(pkg.daysSincePublish >= 0, `${name} daysSincePublish should be >= 0`);
        }
      }
    });

    it('daysSincePublish should be consistent with publishedDate', () => {
      for (const [name, pkg] of result.allPackages) {
        if (pkg.publishedDate && pkg.daysSincePublish != null) {
          const expected = Math.floor((Date.now() - pkg.publishedDate.getTime()) / (1000 * 60 * 60 * 24));
          assert.ok(Math.abs(pkg.daysSincePublish - expected) <= 1,
            `${name} daysSincePublish (${pkg.daysSincePublish}) should be within 1 day of calculated (${expected})`);
        }
      }
    });
  });
});
