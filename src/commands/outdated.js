// Libraries
const logger = new (require('../lib/logger'))('node-power-user');
const chalk = require('chalk').default;
const { table } = require('table');
const jetpack = require('fs-jetpack');
const path = require('path');
const version = require('wonderful-version');
const inquirer = require('@inquirer/prompts');
const ncu = require('npm-check-updates');
const socket = require('../lib/socket');
const npm = require('../lib/npm');
const { execute } = require('node-powertools');

// Load package.json
const projectPath = process.cwd();

// Module
module.exports = async function (options) {
  const packageJsonPath = path.join(projectPath, 'package.json');
  const lockfilePath = path.join(projectPath, 'package-lock.json');
  let projectJson = jetpack.read(packageJsonPath, 'json');

  // Check if package.json exists
  if (!projectJson) {
    logger.error('No package.json found in the current directory.');
    return {};
  }

  // Check socket status upfront (blocks if not installed unless --force)
  await socket.check({ force: options.force });

  if (options.force) {
    logger.warn(chalk.red('--force flag detected — Socket supply chain protection is bypassed!'));
  }

  // Log start
  logger.log(`Checking packages for ${logger.format.bold(projectJson.name || 'Unknown Project')}...`);

  // Detect desync between the hidden lockfile and the physical node_modules —
  // desynced copies make npm silently no-op installs (it trusts the lockfile
  // over the disk), which is what traps projects in reconcile/update loops
  const desynced = npm.findDesynced(projectPath);

  // Parse --ignore flag (comma-separated list of package names to skip)
  const ignoreList = (options.ignore || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (ignoreList.length > 0) {
    logger.log(chalk.dim(`Ignoring: ${ignoreList.join(', ')}`));
  }

  // Run ncu for patch, minor, and latest (include peer dependencies)
  const ncuOptions = {
    packageFile: packageJsonPath,
    dep: 'prod,dev,peer,optional',
    ...(ignoreList.length > 0 ? { reject: ignoreList } : {}),
  };

  const [patchUpgrades, minorUpgrades, latestUpgrades] = await Promise.all([
    ncu.run({ ...ncuOptions, target: 'patch' }),
    ncu.run({ ...ncuOptions, target: 'minor' }),
    ncu.run({ ...ncuOptions, target: 'latest' }),
  ]);

  // Get all dependencies
  const allDependencies = Object.assign(
    {},
    projectJson.dependencies,
    projectJson.devDependencies,
    projectJson.peerDependencies
  );

  // Build unified package data
  const allPackages = new Map();

  for (const dep of Object.keys(allDependencies).filter(d => !ignoreList.includes(d))) {
    const packageVersion = version.clean(allDependencies[dep]);
    const installedPackagePath = path.join(projectPath, 'node_modules', dep, 'package.json');

    let installedVersion = null;
    if (jetpack.exists(installedPackagePath)) {
      const installedJson = jetpack.read(installedPackagePath, 'json');
      installedVersion = installedJson?.version ? version.clean(installedJson.version) : null;
    }

    const patchVersion = patchUpgrades[dep] ? version.clean(patchUpgrades[dep]) : null;
    const minorVersion = minorUpgrades[dep] ? version.clean(minorUpgrades[dep]) : null;
    const latestVersion = latestUpgrades[dep] ? version.clean(latestUpgrades[dep]) : null;

    // Check if this package needs attention
    const hasDiscrepancy = installedVersion && !version.is(installedVersion, '==', packageVersion);
    const hasUpdate = latestVersion && latestVersion !== packageVersion;

    if (hasDiscrepancy || hasUpdate) {
      allPackages.set(dep, {
        name: dep,
        packageVersion,
        installedVersion: installedVersion || '?',
        patchVersion,
        minorVersion,
        latestVersion,
        type: getDependencyType(projectJson, dep),
        hasDiscrepancy,
        hasMajorUpdate: latestVersion && latestVersion.split('.')[0] !== packageVersion.split('.')[0],
      });
    }
  }

  // Display unified table
  if (allPackages.size === 0 && desynced.length === 0) {
    logger.log(logger.format.green('\nAll packages are up to date!'));
    return { allPackages, desynced };
  }

  if (allPackages.size > 0) {
    const dataTable = [['Package', 'package.json', 'Installed', 'Latest', 'Type']];

    for (const pkg of allPackages.values()) {
      const pkgVersionColor = pkg.hasDiscrepancy ? 'red' : 'green';

      // Format latest version - show major updates in magenta
      let latestDisplay;
      if (pkg.latestVersion) {
        if (pkg.hasMajorUpdate) {
          latestDisplay = chalk.magenta(pkg.latestVersion + ' ⚠');
        } else if (pkg.latestVersion !== pkg.installedVersion) {
          latestDisplay = chalk.cyan(pkg.latestVersion);
        } else {
          latestDisplay = chalk.green(pkg.latestVersion);
        }
      } else {
        latestDisplay = chalk.dim('-');
      }

      dataTable.push([
        pkg.name,
        chalk[pkgVersionColor](pkg.packageVersion),
        chalk.green(pkg.installedVersion),
        latestDisplay,
        pkg.type,
      ]);
    }

    console.log(table(dataTable));

    // Only show legend if there are major updates
    const hasMajorUpdates = [...allPackages.values()].some(pkg => pkg.hasMajorUpdate);
    if (hasMajorUpdates) {
      logger.log(chalk.dim('Legend: ') + chalk.magenta('⚠ = major version (breaking changes)'));
    }
  }

  // Warn about desynced copies — includes transitive deps the table can't show
  if (desynced.length > 0) {
    logger.warn(`${desynced.length} package(s) on disk don't match what package-lock.json claims is installed (stale or partial installs):`);
    for (const d of desynced.slice(0, 10)) {
      logger.warn(`  • ${d.loc.replace(/^node_modules\//, '')} — lockfile has ${d.lockfileVersion}, disk has ${d.diskVersion || 'nothing'}`);
    }
    if (desynced.length > 10) {
      logger.warn(`  …and ${desynced.length - 10} more`);
    }
  }

  // Separate discrepancies into two categories:
  // - "behind": node_modules has an OLDER version than package.json wants (needs npm install)
  // - "ahead": node_modules has a NEWER version than package.json specifies (reconcile package.json)
  const discrepancies = [...allPackages.values()].filter(pkg => pkg.hasDiscrepancy);
  const behindPackages = discrepancies.filter(pkg =>
    pkg.installedVersion !== '?' && version.is(pkg.installedVersion, '<', pkg.packageVersion)
  );
  const aheadPackages = discrepancies.filter(pkg =>
    pkg.installedVersion !== '?' && version.is(pkg.installedVersion, '>', pkg.packageVersion)
  );
  const unknownPackages = discrepancies.filter(pkg => pkg.installedVersion === '?');

  // Get counts for menu (only show a tier if it offers upgrades beyond the tier below)
  const patchCount = Object.keys(patchUpgrades).length;
  const minorCount = Object.keys(minorUpgrades).length;
  const majorCount = Object.keys(latestUpgrades).length;

  // Check if minor offers any versions beyond what patch gives
  const hasMinorBeyondPatch = Object.keys(minorUpgrades).some(dep =>
    minorUpgrades[dep] !== (patchUpgrades[dep] || allDependencies[dep])
  );

  // Check if major/latest offers any versions beyond what minor gives
  const hasMajorBeyondMinor = Object.keys(latestUpgrades).some(dep => {
    const latestMajor = version.clean(latestUpgrades[dep]).split('.')[0];
    const currentMajor = version.clean(allDependencies[dep]).split('.')[0];
    return latestMajor !== currentMajor;
  });

  // If noPrompt, return data without showing menu (used by tests)
  if (options.noPrompt) {
    return { allPackages, desynced };
  }

  // Check for shortcut flags (skip menu)
  let action = null;
  if (options.heal) {
    action = 'heal';
  } else if (options.sync) {
    action = 'sync';
  } else if (options.r || options.reconcile) {
    action = 'reconcile';
  } else if (options.P || options.patch) {
    action = 'patch';
  } else if (options.m || options.minor) {
    action = 'minor';
  } else if (options.M || options.major) {
    action = 'latest';
  }

  // If no shortcut, show menu
  if (!action) {
    const choices = [];

    // "Heal" reinstalls copies whose disk state doesn't match the lockfile
    if (desynced.length > 0) {
      choices.push({
        name: `Heal (${desynced.length}) - reinstall copies that don't match package-lock.json`,
        value: 'heal',
      });
    }

    // "Sync" installs packages where node_modules is behind package.json
    const syncCount = behindPackages.length + unknownPackages.length;
    if (syncCount > 0) {
      choices.push({
        name: `Sync (${syncCount}) - install packages to match package.json`,
        value: 'sync',
      });
    }

    // "Reconcile" updates package.json where node_modules is ahead
    if (aheadPackages.length > 0) {
      choices.push({
        name: `Reconcile (${aheadPackages.length}) - sync package.json to installed versions`,
        value: 'reconcile',
      });
    }

    if (patchCount > 0) {
      choices.push({
        name: `Patch (${patchCount}) - safe bug fixes only`,
        value: 'patch',
      });
    }

    if (hasMinorBeyondPatch) {
      choices.push({
        name: `Minor (${minorCount}) - new features, no breaking changes`,
        value: 'minor',
      });
    }

    if (hasMajorBeyondMinor) {
      choices.push({
        name: `Major (${majorCount}) - all updates including breaking changes ⚠`,
        value: 'latest',
      });
    }

    choices.push({ name: 'Exit', value: 'exit' });

    action = await inquirer.select({
      message: 'What would you like to do?',
      choices,
    });
  }

  if (action === 'exit') {
    return { allPackages, desynced };
  }

  // Handle heal — reinstall node_modules copies that don't match the hidden
  // lockfile. Desynced copies make npm silently no-op installs, which traps
  // projects in reconcile/update loops where nothing ever actually changes.
  if (action === 'heal') {
    if (desynced.length === 0) {
      logger.log(logger.format.green('\nNothing to heal — node_modules matches package-lock.json.'));
      return { allPackages, desynced, healed: false };
    }

    const lockfileBackup = jetpack.read(lockfilePath);

    logger.log(logger.format.cyan(`\nRemoving ${desynced.length} desynced copies and reinstalling...`));
    npm.removeLocations(desynced.map(d => d.loc), projectPath);

    try {
      await socket.wrap('npm install', { force: options.force });
    } catch (e) {
      // Restore the lockfile so the failed run can't advance it further
      if (lockfileBackup) {
        jetpack.write(lockfilePath, lockfileBackup);
      }

      if (e.reason === 'npm-failed') {
        logger.log('');
        logger.log('Fix the npm error above and re-run with --heal — the removed copies will reinstall then.');
        return { allPackages, desynced, healed: false };
      }

      reportSocketBlock(e, 'npu out --heal --force');
      return { allPackages, desynced, healed: false };
    }

    // Confirm disk and lockfile are actually back in sync
    const remaining = npm.findDesynced(projectPath);
    if (remaining.length > 0) {
      logger.error(`\n${remaining.length} package(s) are still desynced after reinstalling:`);
      remaining.slice(0, 10).forEach(d => logger.error(`  • ${d.loc.replace(/^node_modules\//, '')} — lockfile has ${d.lockfileVersion}, disk has ${d.diskVersion || 'nothing'}`));
      logger.log(`Try a clean install: ${logger.format.cyan('rm -rf node_modules && npm install')}`);
      return { allPackages, desynced, healed: false };
    }

    try {
      await socket.audit({ force: options.force });
    } catch (e) {
      logger.error(`Audit warning: ${e.message}`);
    }

    logger.log(logger.format.green(`\nHealed ${desynced.length} package(s) — node_modules now matches package-lock.json.`));
    return { allPackages, desynced, healed: true };
  }

  // Handle sync — run npm install for packages where node_modules is behind package.json
  if (action === 'sync') {
    const toSync = [...behindPackages, ...unknownPackages];

    if (toSync.length === 0) {
      logger.log(logger.format.green('\nNothing to sync — node_modules already matches package.json.'));
      return { allPackages, desynced, synced: false };
    }

    const installCmd = `npm install ${toSync.map(pkg => `${pkg.name}@${pkg.packageVersion}`).join(' ')}`;
    logger.log(logger.format.cyan(`\nRunning ${installCmd}...`));

    const lockfileBackup = jetpack.read(lockfilePath);

    // Remove stale node_modules copies first so npm actually re-fetches them
    // instead of trusting the hidden lockfile and reporting "up to date"
    npm.removeInstalledCopies(toSync.map(pkg => pkg.name), projectPath);

    try {
      await socket.wrap(installCmd, { force: options.force });
    } catch (e) {
      // Restore the lockfile so a blocked/failed install can't leave it
      // advanced past the physical files (that desync is what mints loops)
      if (lockfileBackup) {
        jetpack.write(lockfilePath, lockfileBackup);
      }

      if (e.reason === 'npm-failed') {
        logger.log('');
        logger.log('Fix the npm error above and retry.');
        return { allPackages, desynced, synced: false };
      }

      reportSocketBlock(e, 'npu out --sync --force');
      return { allPackages, desynced, synced: false };
    }

    // Confirm the installs physically landed in node_modules
    const expected = Object.fromEntries(toSync.map(pkg => [pkg.name, pkg.packageVersion]));
    if (reportMismatches(npm.verifyInstalled(expected, projectPath))) {
      return { allPackages, desynced, synced: false };
    }

    try {
      await socket.audit({ force: options.force });
    } catch (e) {
      logger.error(`Audit warning: ${e.message}`);
    }

    logger.log(logger.format.green(`\nSynced ${toSync.length} package(s) to match package.json.`));
    return { allPackages, desynced, synced: true };
  }

  // Handle reconcile — update package.json for packages where node_modules is ahead.
  // Strictly ahead-only: packages where node_modules is BEHIND are a sync problem,
  // and downgrading package.json to match them would mask a stale install.
  if (action === 'reconcile') {
    if (aheadPackages.length === 0) {
      logger.log('\nNothing to reconcile — no installed packages are ahead of package.json.');

      const syncCount = behindPackages.length + unknownPackages.length;
      if (syncCount > 0) {
        logger.log(`${syncCount} package(s) are behind package.json — run ${logger.format.cyan('npu out --sync')} to install them.`);
      }

      return { allPackages, desynced, reconciled: false };
    }

    projectJson = jetpack.read(packageJsonPath, 'json');

    for (const pkg of aheadPackages) {
      const depType = pkg.type === 'dev' ? 'devDependencies'
        : pkg.type === 'peer' ? 'peerDependencies'
        : 'dependencies';

      projectJson[depType][pkg.name] = `^${pkg.installedVersion}`;
    }

    jetpack.write(packageJsonPath, projectJson);
    logger.log(logger.format.green(`\nReconciled ${aheadPackages.length} package(s) in package.json.`));

    return { allPackages, desynced, reconciled: true };
  }

  // Handle patch/minor/major updates
  const upgrades = action === 'patch' ? patchUpgrades
    : action === 'minor' ? minorUpgrades
    : latestUpgrades;
  const packageNames = Object.keys(upgrades);

  if (packageNames.length === 0) {
    logger.log(logger.format.green(`\nNothing to update — package.json is already at the requested versions.`));
    return { allPackages, desynced, updated: false, target: action };
  }

  // Back up package.json and package-lock.json before modifying, so a failed
  // install can restore BOTH — restoring only package.json leaves the lockfile
  // advanced past the physical files, which is exactly the desync that mints
  // silent no-op installs
  const packageJsonBackup = jetpack.read(packageJsonPath);
  const lockfileBackup = jetpack.read(lockfilePath);

  await ncu.run({
    packageFile: packageJsonPath,
    target: action,
    upgrade: true,
  });

  logger.log(logger.format.green(`\nUpdated ${packageNames.length} package(s) in package.json.`));

  // Install the specific upgraded packages so npm actually pulls them in
  // (plain `npm install` won't upgrade packages that already satisfy the range)
  const installCmd = `npm install ${packageNames.map(name => `${name}@${version.clean(upgrades[name])}`).join(' ')}`;
  logger.log(logger.format.cyan(`\nRunning ${installCmd}...`));

  // Remove stale node_modules copies first so npm actually re-fetches them
  // instead of trusting the hidden lockfile and reporting "up to date"
  npm.removeInstalledCopies(packageNames, projectPath);

  try {
    await socket.wrap(installCmd, { force: options.force });
  } catch (e) {
    // Restore both manifests since the bulk install failed
    jetpack.write(packageJsonPath, packageJsonBackup);
    if (lockfileBackup) {
      jetpack.write(lockfilePath, lockfileBackup);
    }
    logger.log('package.json and package-lock.json have been restored to their original state.');
    logger.log('The removed package copies will show as missing in the next check until reinstalled.');

    // npm itself failed (ERESOLVE, network, peer-dep conflict) — not a Socket block.
    // The npm error was already printed above; just acknowledge and stop.
    if (e.reason === 'npm-failed') {
      logger.log('');
      logger.log('Fix the npm error above (e.g. resolve peer-dep conflicts) and retry.');
      return { allPackages, desynced, updated: false, target: action };
    }

    const flaggedPackages = e.flaggedPackages || [];

    // Trace which of the requested packages bring in the flagged deps
    const riskyParents = new Set();

    if (flaggedPackages.length > 0) {
      logger.log('');
      logger.error('Socket flagged the following transitive dependencies:');

      for (const flagged of flaggedPackages) {
        const flaggedName = flagged.replace(/@[^@]+$/, ''); // strip version
        let parentChain = '';

        try {
          const lsOutput = await execute(`npm ls ${flaggedName} --json`, { log: false });
          const tree = JSON.parse(lsOutput);

          // Find which top-level deps depend on the flagged package
          const parents = [];
          for (const [dep, info] of Object.entries(tree.dependencies || {})) {
            if (dep === flaggedName || JSON.stringify(info).includes(`"${flaggedName}"`)) {
              parents.push(dep);
              riskyParents.add(dep);
            }
          }

          if (parents.length > 0) {
            parentChain = chalk.dim(` (from ${parents.join(', ')})`);
          }
        } catch (_) {
          // npm ls may fail, just skip the trace
        }

        logger.error(`  • ${flagged}${parentChain}`);
      }
    }

    // Suggest retry commands
    if (riskyParents.size > 0) {
      const ignoreArg = [...riskyParents].join(',');
      logger.log('');
      logger.log('To skip the risky packages and update the rest:');
      logger.log(logger.format.cyan(`  npu out --ignore ${ignoreArg}`));
    }

    logger.log('');
    logger.log('To retry with Socket protection bypassed:');
    logger.log(logger.format.cyan(`  npu out --force`));
    logger.log('');
    logger.log('To bypass Socket for this install only:');
    logger.log(logger.format.cyan(`  SOCKET_CLI_ACCEPT_RISKS=1 npm install ${packageNames.map(name => `${name}@${version.clean(upgrades[name])}`).join(' ')}`));

    return { allPackages, desynced, updated: false, target: action };
  }

  // Confirm the installs physically landed in node_modules
  const expectedUpgrades = Object.fromEntries(packageNames.map(name => [name, version.clean(upgrades[name])]));
  if (reportMismatches(npm.verifyInstalled(expectedUpgrades, projectPath))) {
    return { allPackages, desynced, updated: false, target: action };
  }

  // Run full audit after install
  try {
    await socket.audit({ force: options.force });
  } catch (e) {
    logger.error(`Audit warning: ${e.message}`);
  }

  return { allPackages, desynced, updated: true, target: action };
};

// Helper to explain a Socket risk-block after stale copies were already removed.
// Deliberately does NOT reinstall the removed copies — that would silently
// bypass the block Socket just raised; removed is safer than stale-and-risky.
function reportSocketBlock(e, retryCommand) {
  const flaggedPackages = e.flaggedPackages || [];

  if (flaggedPackages.length > 0) {
    logger.log('');
    logger.error('Socket flagged the following dependencies:');
    flaggedPackages.forEach(pkg => logger.error(`  • ${pkg}`));

    const flaggedNames = flaggedPackages.map(pkg => pkg.replace(/@[^@]+$/, ''));
    logger.log('');
    logger.log('If these are fixable CVEs in transitive deps pinned by package-lock.json, re-resolve them with:');
    logger.log(logger.format.cyan(`  socket npm update ${flaggedNames.join(' ')}`));
  }

  logger.log('');
  logger.log('To retry with Socket protection bypassed:');
  logger.log(logger.format.cyan(`  ${retryCommand}`));
  logger.log('');
  logger.log('The risky copies stay removed from node_modules (safer than leaving stale versions) and will show as missing until reinstalled.');
}

// Helper to report packages that npm claimed to install but didn't physically land.
// Returns true if there were mismatches (callers should bail).
function reportMismatches(mismatches) {
  if (mismatches.length === 0) {
    return false;
  }

  logger.error('\nnpm reported success but these packages did not actually update in node_modules:');
  for (const m of mismatches) {
    logger.error(`  • ${m.name} — expected ${m.expected}, found ${m.actual}`);
  }
  logger.log(`Try a clean install: ${logger.format.cyan('rm -rf node_modules && npm install')}`);

  return true;
}

// Helper to determine dependency type
function getDependencyType(packageJson, dep) {
  if (packageJson.devDependencies?.[dep]) {
    return 'dev';
  }
  if (packageJson.peerDependencies?.[dep]) {
    return 'peer';
  }
  return 'prod';
}
