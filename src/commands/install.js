// Libraries
const logger = new (require('../lib/logger'))('node-power-user');
const socket = require('../lib/socket');
const npxArgs = require('../lib/npx-args');
const npm = require('../lib/npm');

// Tokens that select the install command (positional + flag aliases)
const INSTALL_TOKENS = ['install', 'i', '--install', '-i'];

// Module
module.exports = async function (options) {
  // Parse from RAW argv so every npm flag passes through verbatim
  // (--save-dev, --legacy-peer-deps, --dry-run, ...). npu's own --force goes
  // BEFORE the command token: `npu --force i <package>`.
  const raw = options.raw || [
    ...(options.force ? ['--force'] : []),
    'install',
    ...(options._ || []).slice(1).map(String),
  ];
  const { childArgs, force } = npxArgs.parsePassthroughArgs(raw, INSTALL_TOKENS);

  // Non-flag tokens = the packages being installed (empty = full-tree install)
  const packages = childArgs.filter((arg) => !arg.startsWith('-'));
  const isGlobal = childArgs.includes('-g') || childArgs.includes('--global');

  // When installing specific packages with a version/tag (e.g. @latest, @^2.0.0),
  // remove existing node_modules copies first so npm actually re-fetches them
  // instead of reporting "up to date" with a stale cached version.
  if (packages.length > 0 && !isGlobal) {
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

  const command = `npm install ${childArgs.map(npxArgs.quoteArg).join(' ')}`.trim();

  // Check socket status upfront (blocks if not installed unless --force)
  await socket.check({ force });

  // Log
  logger.log(`Running: ${logger.format.cyan(command)}`);

  // Wrap with Socket Firewall
  try {
    await socket.wrap(command, { force });
  } catch (e) {
    process.exitCode = e.code || 1;

    if (e.reason === 'sfw-blocked') {
      logger.log('');
      logger.log('Install blocked. See the output above for details.');
      logger.log('To retry without firewall protection:');
      logger.log(logger.format.cyan(`  npu --force i ${childArgs.join(' ')}`.trim()));
      return;
    }

    logger.log('');
    logger.log('Fix the npm error above (e.g. resolve peer-dep conflicts) and retry.');
    return;
  }

  // Done
  logger.log(logger.format.green('Install complete.'));
};
