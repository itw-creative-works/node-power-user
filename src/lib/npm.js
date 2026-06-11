// Libraries
const jetpack = require('fs-jetpack');
const path = require('path');
const version = require('wonderful-version');

// Remove installed node_modules copies for the given package names so npm
// actually re-fetches them. npm trusts the hidden lockfile
// (node_modules/.package-lock.json) over the physical files — if the lockfile
// already records the requested version, `npm install pkg@version` reports
// "up to date" without installing anything, even when the physical copy is
// stale. Deleting the copy forces npm to reify it from the registry/cache.
function removeInstalledCopies(names, cwd) {
  const base = cwd || process.cwd();

  for (const name of names) {
    const pkgDir = path.join(base, 'node_modules', name);

    if (jetpack.exists(pkgDir)) {
      jetpack.remove(pkgDir);
    }
  }
}

// Remove node_modules entries by their lockfile location (e.g.
// "node_modules/mocha/node_modules/brace-expansion") — unlike
// removeInstalledCopies, this handles nested copies.
function removeLocations(locations, cwd) {
  const base = cwd || process.cwd();

  for (const location of locations) {
    jetpack.remove(path.join(base, location));
  }
}

// Find packages where the physical node_modules copy doesn't match what the
// hidden lockfile (node_modules/.package-lock.json) claims is installed.
// This desync is what makes npm silently no-op installs: npm trusts the hidden
// lockfile over the physical files, so a stale or partially-extracted copy is
// never repaired by `npm install`. Created by interrupted or Socket-blocked
// installs that advance the lockfiles without extracting files.
// Returns [{ loc, lockfileVersion, diskVersion }] — diskVersion null = missing.
function findDesynced(cwd) {
  const base = cwd || process.cwd();
  const hidden = jetpack.read(path.join(base, 'node_modules', '.package-lock.json'), 'json');

  if (!hidden) {
    return [];
  }

  const desynced = [];

  for (const [loc, info] of Object.entries(hidden.packages || {})) {
    if (!loc.startsWith('node_modules/') || !info.version || info.link) {
      continue;
    }

    const pkgJson = jetpack.read(path.join(base, loc, 'package.json'), 'json');
    const diskVersion = pkgJson?.version || null;

    if (!diskVersion) {
      // Missing optional packages are normal (platform-specific binaries
      // like @esbuild/* and fsevents are skipped on non-matching systems)
      if (info.optional) {
        continue;
      }

      desynced.push({ loc, lockfileVersion: info.version, diskVersion: null });
    } else if (diskVersion !== info.version) {
      desynced.push({ loc, lockfileVersion: info.version, diskVersion });
    }
  }

  return desynced;
}

// Verify that the physical node_modules copies match the expected versions.
// expected is a map of { name: version }. Returns an array of mismatches:
// [{ name, expected, actual }] — empty when everything landed correctly.
function verifyInstalled(expected, cwd) {
  const base = cwd || process.cwd();
  const mismatches = [];

  for (const [name, expectedVersion] of Object.entries(expected)) {
    const cleanExpected = version.clean(expectedVersion);
    const pkgJson = jetpack.read(path.join(base, 'node_modules', name, 'package.json'), 'json');
    const actual = pkgJson?.version ? version.clean(pkgJson.version) : null;

    if (!actual || !version.is(actual, '==', cleanExpected)) {
      mismatches.push({ name, expected: cleanExpected, actual: actual || 'missing' });
    }
  }

  return mismatches;
}

// Export
module.exports = {
  removeInstalledCopies,
  removeLocations,
  findDesynced,
  verifyInstalled,
};
