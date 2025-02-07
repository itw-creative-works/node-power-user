// Libraries
const logger = new (require('../lib/logger'))('node-power-user');
const path = require('path');
const jetpack = require('fs-jetpack');
const { wait } = require('node-powertools');

// Load package
const package = jetpack.read(path.join(__dirname, '../../', 'package.json'), 'json');
const project = jetpack.read(path.join(process.cwd(), 'package.json'), 'json');

module.exports = async function (options) {
  // Fix options
  options = options || {};
  options.time = options.time || parseInt(options._[1]) || 0;

  // Log initial state
  logger.log(`Waiting for ${options.time}ms...`);

  try {
    // Run cleanup commands
    await wait(options.time);

    // Log success
    logger.log(logger.format.green('Wait completed successfully!'));

    return true;
  } catch (e) {
    // Log failure
    logger.error(`Wait failed`, e.stack);

    return false;
  }
};
