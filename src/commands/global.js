// Libraries
const logger = new (require('../lib/logger'))('node-power-user');
const path = require('path');
const os = require('os');
const jetpack = require('fs-jetpack');
const version = require('wonderful-version');
const { table } = require('table');
const ProgressBar = require('cli-progress');
const Npm = require('npm-api');
const chalk = require('chalk');

const npm = new Npm();

// Module
module.exports = async function (options) {
  // Define global modules path
  const parentPath = `/Users/${os.userInfo().username}/.nvm/versions/node`;
  const versions = jetpack.list(parentPath) || [];
  const response = {};

  // Log start
  logger.log(`Checking global modules for ${logger.format.bold(versions.length)} Node.js versions...`);

  // Loop through Node.js versions
  for (const ver of versions) {
    try {
      // Quick check if ver starts with a dot
      if (ver.startsWith('.')) {
        continue;
      }

      // Clean
      const cleaned = version.clean(ver);
      const libPath = path.resolve(parentPath, `v${cleaned}`, 'lib', 'node_modules');
      const modules = jetpack.list(libPath) || [];

      // Log version being checked
      logger.log(`Checking global modules for Node v${logger.format.bold(cleaned)}...`);

      // Skip if no global modules found
      if (!modules.length) {
        logger.warn(`No global modules found for Node v${logger.format.bold(cleaned)}.`);
        continue;
      }

      // Initialize progress bar
      const progress = new ProgressBar.SingleBar({}, ProgressBar.Presets.shades_classic);
      progress.start(modules.length, 0);

      // Initialize data
      response[cleaned] = {};
      const data = [['Name', 'Package', 'Latest']];

      // Loop through modules
      for (const mod of modules) {
        const packagePath = path.resolve(libPath, mod, 'package.json');
        try {
          const packageJson = require(packagePath);
          const packageVersion = packageJson.version;

          // Fetch the latest version from npm
          let latestVersion = await npm.repo(mod).package().then(pkg => pkg.version).catch(() => '?');

          // Determine version color-coding
          const isLatest = packageVersion === latestVersion;
          const verb = isLatest ? 'green' : 'red';

          // Add to response and table data
          data.push([
            mod,
            packageVersion,
            chalk[verb](latestVersion)
          ]);
          response[cleaned][mod] = {
            version: packageVersion,
            latest: latestVersion
          };
        } catch (e) {}

        progress.increment();
      }

      // Stop progress bar
      progress.stop();

      // Display results
      console.log(table(data));

    } catch (e) {
      logger.error(`Error processing Node v${ver}:`, e.stack);
    }
  }

  // Log completion
  logger.log(logger.format.green('Global module check completed successfully!'));

  // Return response
  return response;
};
