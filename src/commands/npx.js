// Libraries
const logger = new (require('../lib/logger'))('node-power-user');
const chalk = require('chalk').default;
const socket = require('../lib/socket');
const jetpack = require('fs-jetpack');
const path = require('path');

const projectPath = process.cwd();

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
  const binaryName = args[0];

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

    // Check if the binary exists locally — if not, npx tried to download from npm
    const localBin = path.join(projectPath, 'node_modules', '.bin', binaryName);
    if (!jetpack.exists(localBin)) {
      logger.error(`'${binaryName}' was not found in node_modules/.bin/`);
      logger.log(`npx tried to download package '${binaryName}' from npm, which was blocked by Socket Firewall.`);

      // Check if it's defined in this project's own bin field
      const pkgJson = jetpack.read(path.join(projectPath, 'package.json'), 'json');
      if (pkgJson?.bin?.[binaryName]) {
        logger.log('');
        logger.log(`'${binaryName}' is defined in this project's ${chalk.cyan('bin')} field but is not installed as a command.`);
        logger.log(`Run it directly: ${logger.format.cyan(`${pkgJson.bin[binaryName]} ${args.slice(1).join(' ')}`.trim())}`);
      }
    } else {
      logger.log('Command blocked by Socket Firewall. See the output above for details.');
    }

    logger.log('');
    logger.log('To retry without firewall protection:');
    logger.log(logger.format.cyan(`  npu npx ${args.join(' ')} --force`));
    return;
  }

  logger.log(logger.format.green('Done.'));
};
