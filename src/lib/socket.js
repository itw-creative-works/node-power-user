// Libraries
const { execute } = require('node-powertools');
const logger = new (require('./logger'))('node-power-user');

// Check if socket CLI is installed
let _socketVersion = undefined;
async function isSocketAvailable() {
  if (_socketVersion !== undefined) {
    return !!_socketVersion;
  }

  try {
    _socketVersion = (await execute('socket --version', { log: false })).trim();
  } catch (e) {
    _socketVersion = null;
  }

  return !!_socketVersion;
}

// Log socket status upfront (call at the start of commands)
async function check(options) {
  options = options || {};

  const available = await isSocketAvailable();

  if (available) {
    logger.log(logger.format.green(`Socket v${_socketVersion} — supply chain protection enabled.`));
  } else {
    logger.error('Socket CLI is not installed. Your installs are NOT protected against supply chain attacks.');
    logger.error(`Install it with: ${logger.format.cyan('npm install -g @socketsecurity/cli --save-exact')}`);

    if (!options.force) {
      logger.error('Refusing to proceed without Socket protection. Use --force to bypass.');
      throw new Error('Socket CLI is not installed.');
    }

    logger.warn('Bypassing Socket protection (--force flag detected).');
  }

  return available;
}

// Wrap an npm command with socket if available
async function wrap(command, options) {
  options = options || {};

  const available = await isSocketAvailable();

  // If socket is not installed, fall back to plain npm
  if (!available) {
    await execute(command, { log: true });
    return;
  }

  // Run with socket and capture output to check for risks
  // When --force is used, set SOCKET_CLI_ACCEPT_RISKS so Socket actually installs
  const env = options.force ? 'SOCKET_CLI_ACCEPT_RISKS=1 ' : '';
  let output;
  let exitedWithError = false;

  try {
    output = await execute(`${env}socket ${command}`, { log: false });
  } catch (e) {
    // Socket exits non-zero when it detects risks
    output = e.message || '';
    exitedWithError = true;
  }

  // Print the output
  if (output) {
    console.log(output);
  }

  // Distinguish a real Socket risk-block from a generic npm failure.
  // Socket prints its own markers when it blocks; npm failures (ERESOLVE,
  // network errors, peer-dep conflicts) just exit non-zero with npm errors.
  const socketBlocked = /new risk|socket found|exiting due to risks/i.test(output)
    && !/no new risks/i.test(output);

  // Subprocess failed but Socket didn't actually block — surface the npm error honestly.
  if (exitedWithError && !socketBlocked) {
    logger.error('npm install failed. See the error output above.');
    const err = new Error('npm install failed.');
    err.reason = 'npm-failed';
    throw err;
  }

  if (!socketBlocked) {
    return;
  }

  // Parse flagged package names from Socket output (e.g. "serialize-javascript@6.0.2")
  const flaggedPackages = [];
  const flaggedRegex = /^(\S+@\S+)\s/gm;
  let match;
  while ((match = flaggedRegex.exec(output)) !== null) {
    flaggedPackages.push(match[1]);
  }

  // Risks detected — block unless --force flag is passed
  logger.error('Socket detected supply chain risks in the packages above.');

  if (!options.force) {
    logger.error('Refusing to install. Review the risks above, then use --force to bypass.');
    const err = new Error('Socket detected supply chain risks.');
    err.reason = 'socket-blocked';
    err.flaggedPackages = flaggedPackages;
    throw err;
  }

  logger.warn('Bypassing Socket risk warnings (--force flag detected).');
}

// Run a full socket audit on the current project
async function audit(options) {
  options = options || {};

  const available = await isSocketAvailable();

  if (!available) {
    logger.warn('Skipping post-install audit — Socket CLI is not installed.');
    return;
  }

  logger.log(logger.format.cyan('\nRunning post-install Socket audit...'));

  let output;
  let exitedWithError = false;

  try {
    output = await execute('socket npm audit', { log: false });
  } catch (e) {
    output = e.message || '';
    exitedWithError = true;
  }

  // Print the output
  if (output) {
    console.log(output);
  }

  // Distinguish a real Socket risk-finding from a generic audit-subprocess failure.
  const socketFoundRisks = /new risk|socket found|exiting due to risks/i.test(output)
    && !/no new risks/i.test(output);

  if (exitedWithError && !socketFoundRisks) {
    logger.warn('Socket audit subprocess failed (not a risk finding). See output above.');
    return;
  }

  if (!socketFoundRisks) {
    logger.log(logger.format.green('Socket audit passed — no risks detected.'));
    return;
  }

  logger.error('Socket audit found supply chain risks in your dependencies.');

  if (!options.force) {
    logger.error('Review the risks above. Use --force to bypass.');
    throw new Error('Socket audit detected supply chain risks.');
  }

  logger.warn('Bypassing Socket audit warnings (--force flag detected).');
}

// Export
module.exports = {
  isAvailable: isSocketAvailable,
  check,
  wrap,
  audit,
};
