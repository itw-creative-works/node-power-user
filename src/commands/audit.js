// Libraries
const logger = new (require('../lib/logger'))('node-power-user');
const { execute } = require('node-powertools');

let _hasSocketCli;
async function isSocketCliAvailable() {
  if (_hasSocketCli !== undefined) {
    return _hasSocketCli;
  }
  _hasSocketCli = await execute('socket --version', { log: false }).then(() => true).catch(() => false);
  return _hasSocketCli;
}

// Module
module.exports = async function (options) {
  const hasSocket = await isSocketCliAvailable();

  if (hasSocket) {
    logger.log('Running Socket audit on current dependency tree...');

    try {
      await execute('socket npm audit', { log: true });
      logger.log(logger.format.green('Socket audit passed — no risks detected.'));
    } catch (e) {
      logger.warn('Socket audit found risks. Review the output above.');
    }

    return;
  }

  // Fall back to npm audit
  logger.log('Socket CLI not installed — falling back to npm audit...');
  logger.log(logger.format.cyan(`Install Socket CLI for deeper analysis: npm install -g @socketsecurity/cli`));
  logger.log('');

  try {
    await execute('npm audit', { log: true });
    logger.log(logger.format.green('npm audit passed — no known vulnerabilities.'));
  } catch (e) {
    logger.warn('npm audit found vulnerabilities. Review the output above.');
  }
};
