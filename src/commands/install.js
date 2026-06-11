// Libraries
const logger = new (require('../lib/logger'))('node-power-user');
const socket = require('../lib/socket');
const npm = require('../lib/npm');

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

  // When installing specific packages with a version/tag (e.g. @latest, @^2.0.0),
  // remove existing node_modules copies first so npm actually re-fetches them
  // instead of reporting "up to date" with a stale cached version.
  if (packages.length > 0 && !flags.includes('--global')) {
    const names = [];

    for (const pkg of packages) {
      // For scoped packages like @scope/name@version, skip the leading @
      const searchFrom = pkg.startsWith('@') ? 1 : 0;
      const versionIdx = pkg.indexOf('@', searchFrom);
      if (versionIdx <= 0) {
        continue;
      }

      names.push(pkg.substring(0, versionIdx));
    }

    npm.removeInstalledCopies(names);
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
    // npm itself failed (ERESOLVE, network, peer-dep conflict) — not a Socket block.
    // The npm error was already printed above; just acknowledge and stop.
    if (e.reason === 'npm-failed') {
      logger.log('');
      logger.log('Fix the npm error above (e.g. resolve peer-dep conflicts) and retry.');
      return;
    }

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
