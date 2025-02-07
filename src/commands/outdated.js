// Libraries
const logger = new (require('../lib/logger'))('node-power-user');
const chalk = require('chalk');
const { table } = require('table');
const ProgressBar = require('cli-progress');
const Npm = require('npm-api');
const version = require('wonderful-version');
const jetpack = require('fs-jetpack');
const path = require('path');

const npm = new Npm();

// Load package.json
const projectPath = process.cwd();
const projectJson = jetpack.read(path.join(projectPath, 'package.json'), 'json') || {};

// Module
module.exports = async function (options) {
  // Combine all dependencies
  const allDependencies = Object.assign(
    {},
    projectJson.dependencies,
    projectJson.devDependencies,
    projectJson.peerDependencies
  );

  // Check if there are any dependencies
  if (Object.keys(allDependencies).length === 0) {
    logger.warn('No dependencies found in package.json.');
    return {};
  }

  // Log start
  logger.log(`Checking outdated dependencies for ${logger.format.bold(projectJson.name || 'Unknown Project')}...`);

  // Initialize data table
  const data = [['Name', 'Package', 'Installed', 'Latest']];
  const progress = new ProgressBar.SingleBar({}, ProgressBar.Presets.shades_classic);
  progress.start(Object.keys(allDependencies).length, 0);

  const response = {};

  // Loop through dependencies
  for (const dep of Object.keys(allDependencies)) {
    try {
      progress.increment();

      // Get version info
      const packageVersion = version.clean(allDependencies[dep]); // Version from package.json
      const installedPackagePath = path.join(projectPath, 'node_modules', dep, 'package.json');

      let installedVersion = '?';
      if (jetpack.exists(installedPackagePath)) {
        const installedJson = jetpack.read(installedPackagePath, 'json');
        installedVersion = installedJson?.version ? version.clean(installedJson.version) : '?';
      }

      // Get latest published version
      const latestVersion = await npm.repo(dep).package().then(pkg => version.clean(pkg.version)).catch(() => '?');

      // Check version statuses
      const isInstalledCurrent = version.is(installedVersion, '==', packageVersion);
      const isUpToDate = version.is(packageVersion, '>=', latestVersion);

      // Format version colors
      const installedColor = isInstalledCurrent ? 'green' : 'yellow';
      const latestColor = isUpToDate ? 'green' : 'red';

      // Store response data
      response[dep] = {
        package: packageVersion,
        installed: installedVersion,
        latest: latestVersion,
        isInstalledCurrent,
        isUpToDate
      };

      // Add row to table
      data.push([
        dep,
        packageVersion,
        chalk[installedColor](installedVersion),
        chalk[latestColor](latestVersion)
      ]);
    } catch (e) {
      logger.error(`Error checking ${dep}: ${e.message}`);
    }
  }

  // Stop progress bar
  progress.stop();

  // Display table
  console.log(table(data));

  // Log completion
  logger.log(logger.format.green('✔ Outdated package check completed successfully!'));

  return response;
};
