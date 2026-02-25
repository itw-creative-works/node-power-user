// Libraries
const logger = new (require('../lib/logger'))('node-power-user');
const chalk = require('chalk').default;
const { table } = require('table');
const jetpack = require('fs-jetpack');
const path = require('path');
const version = require('wonderful-version');
const inquirer = require('@inquirer/prompts');
const ncu = require('npm-check-updates');
const { execute } = require('node-powertools');

// Load package.json
const projectPath = process.cwd();

// Module
module.exports = async function (options) {
  const packageJsonPath = path.join(projectPath, 'package.json');
  let projectJson = jetpack.read(packageJsonPath, 'json');

  // Check if package.json exists
  if (!projectJson) {
    logger.error('No package.json found in the current directory.');
    return {};
  }

  // Log start
  logger.log(`Checking packages for ${logger.format.bold(projectJson.name || 'Unknown Project')}...`);

  // Run ncu for patch, minor, and latest (include peer dependencies)
  const ncuOptions = {
    packageFile: packageJsonPath,
    dep: 'prod,dev,peer,optional',
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

  for (const dep of Object.keys(allDependencies)) {
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
        hasMajorUpdate: latestVersion && minorVersion !== latestVersion,
      });
    }
  }

  // Display unified table
  if (allPackages.size === 0) {
    logger.log(logger.format.green('\nAll packages are up to date!'));
    return { allPackages };
  }

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

  // Get counts for menu (only show a tier if it has updates beyond the tier below)
  const discrepancies = [...allPackages.values()].filter(pkg => pkg.hasDiscrepancy);
  const patchCount = Object.keys(patchUpgrades).length;
  const minorCount = Object.keys(minorUpgrades).length;
  const majorCount = Object.keys(latestUpgrades).length;
  const hasMinorBeyondPatch = minorCount > patchCount;
  const hasMajorBeyondMinor = majorCount > minorCount;

  // Check for shortcut flags (skip menu)
  let action = null;
  if (options.r || options.reconcile) {
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

    if (discrepancies.length > 0) {
      choices.push({
        name: `Reconcile (${discrepancies.length}) - sync package.json to installed versions`,
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
    return { allPackages };
  }

  // Handle reconcile
  if (action === 'reconcile') {
    // Re-read in case it changed
    projectJson = jetpack.read(packageJsonPath, 'json');

    for (const pkg of discrepancies) {
      const depType = pkg.type === 'dev' ? 'devDependencies'
        : pkg.type === 'peer' ? 'peerDependencies'
        : 'dependencies';

      projectJson[depType][pkg.name] = `^${pkg.installedVersion}`;
    }

    jetpack.write(packageJsonPath, projectJson);
    logger.log(logger.format.green(`\nReconciled ${discrepancies.length} package(s) in package.json.`));

    return { allPackages, reconciled: true };
  }

  // Handle patch/minor/major updates
  const upgrades = action === 'patch' ? patchUpgrades
    : action === 'minor' ? minorUpgrades
    : latestUpgrades;

  await ncu.run({
    packageFile: packageJsonPath,
    target: action,
    upgrade: true,
  });

  logger.log(logger.format.green(`\nUpdated ${Object.keys(upgrades).length} package(s) in package.json.`));

  // Run npm install
  logger.log(logger.format.cyan('\nRunning npm install...'));
  await execute('npm install', { log: true });

  return { allPackages, updated: true, target: action };
};

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
