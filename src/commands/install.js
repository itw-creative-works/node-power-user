// Libraries
const logger = new (require('../lib/logger'))('node-power-user');
const socket = require('../lib/socket');

// Module
module.exports = async function (options) {
  // Get packages from positional args (everything after "install" / "i")
  const packages = (options._ || []).slice(1);

  // Build the npm command
  const flags = [];

  if (options.D || options['save-dev']) {
    flags.push('--save-dev');
  }

  if (options.E || options['save-exact']) {
    flags.push('--save-exact');
  }

  if (options.g || options.global) {
    flags.push('--global');
  }

  const command = packages.length > 0
    ? `npm install ${packages.join(' ')} ${flags.join(' ')}`.trim()
    : `npm install ${flags.join(' ')}`.trim();

  // Check socket status upfront (blocks if not installed unless --force)
  await socket.check({ force: options.force });

  // Log
  logger.log(`Running: ${logger.format.cyan(command)}`);

  // Wrap with socket
  try {
    await socket.wrap(command, { force: options.force });
  } catch (e) {
    const flaggedPackages = e.flaggedPackages || [];

    if (flaggedPackages.length > 0) {
      logger.log('');
      logger.error('Socket flagged the following dependencies:');
      flaggedPackages.forEach(pkg => logger.error(`  • ${pkg}`));
    }

    logger.log('');
    logger.log('To retry with Socket protection bypassed:');
    logger.log(logger.format.cyan(`  npu i ${packages.join(' ')} ${flags.join(' ')} --force`.trim()));
    return;
  }

  // Run full audit after install
  try {
    await socket.audit({ force: options.force });
  } catch (e) {
    logger.error(`Audit warning: ${e.message}`);
  }

  // Done
  logger.log(logger.format.green('Install complete.'));
};
