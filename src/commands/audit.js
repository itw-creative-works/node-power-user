// Libraries
const logger = new (require('../lib/logger'))('node-power-user');
const socket = require('../lib/socket');

// Module
module.exports = async function (options) {
  // Check socket status upfront (blocks if not installed unless --force)
  await socket.check({ force: options.force });

  // Run audit
  logger.log('Running Socket audit on current dependency tree...');

  try {
    await socket.audit({ force: options.force });
  } catch (e) {
    logger.error(e.message);
  }
};
