// Libraries
const logger = new (require('../lib/logger'))('node-power-user');
const socket = require('../lib/socket');

// Module
module.exports = async function (options) {
  // Get everything after "npx" as the command to run
  const args = (options._ || []).slice(1);

  if (args.length === 0) {
    logger.error('Usage: npu npx <command> [args...]');
    logger.log(`Example: ${logger.format.cyan('npu npx create-react-app my-app')}`);
    return;
  }

  const command = `npx ${args.join(' ')}`;

  // Check firewall status upfront (blocks if not installed unless --force)
  await socket.check({ force: options.force });

  // Log
  logger.log(`Running: ${logger.format.cyan(command)}`);

  // Wrap with Socket Firewall
  try {
    await socket.wrap(command, { force: options.force });
  } catch (e) {
    if (e.reason === 'npm-failed') {
      logger.log('');
      logger.log('npx command failed. See the error output above.');
      return;
    }

    logger.log('');
    logger.log('Command blocked. See the output above for details.');
    logger.log('To retry without firewall protection:');
    logger.log(logger.format.cyan(`  npu npx ${args.join(' ')} --force`));
    return;
  }

  logger.log(logger.format.green('Done.'));
};
