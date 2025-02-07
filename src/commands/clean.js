// Libraries
const logger = new (require('../lib/logger'))('node-power-user');
const path = require('path');
const jetpack = require('fs-jetpack');
const { execute } = require('node-powertools');

// Load package.json files
const package = jetpack.read(path.join(__dirname, '../../', 'package.json'), 'json');
const project = jetpack.read(path.join(process.cwd(), 'package.json'), 'json');

// Module
module.exports = async function (options) {
  // Define cleanup command
  const command = `rm -rf node_modules && rm -rf package-lock.json && npm cache clean --force`;

  // Log initial state
  logger.log(`Cleaning project: ${logger.format.bold(project.name)} (v${project.version})`);

  try {
    // Run cleanup commands
    await execute(command, { log: true });

    // Log success
    logger.log(logger.format.green('Cleanup completed successfully!'));

    return true;
  } catch (e) {
    // Log failure
    logger.error(`Cleanup failed`, e.stack);

    return false;
  }
};
