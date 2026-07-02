// Libraries
const logger = new (require('../lib/logger'))('node-power-user');
const chalk = require('chalk').default;
const socket = require('../lib/socket');
const npxArgs = require('../lib/npx-args');
const jetpack = require('fs-jetpack');
const path = require('path');

const projectPath = process.cwd();

// Module
module.exports = async function (options) {
  // Parse from RAW argv so the child command's flags pass through verbatim
  // (yargs would otherwise consume them). npu's own flags go BEFORE the npx
  // token: `npu [--force] npx <command> [args...]` — a trailing --force
  // belongs to the child (e.g. `npu npx rimraf dist --force`).
  const raw = options.raw || [
    ...(options.force ? ['--force'] : []),
    'npx',
    ...(options._ || []).slice(1).map(String),
  ];
  const { childArgs, force } = npxArgs.parseNpxArgs(raw);

  if (childArgs.length === 0) {
    logger.error('Usage: npu [--force] npx <command> [args...]');
    logger.log(`Example: ${logger.format.cyan('npu npx create-react-app my-app')}`);
    process.exitCode = 1;
    return;
  }

  const command = npxArgs.buildCommand(childArgs);
  const binaryName = npxArgs.firstPositional(childArgs);

  // No package named (pure flag queries like `npx --version`) = nothing to
  // download = nothing to protect — silent plain passthrough, no ceremony.
  // (--package still downloads even without a positional, so it stays wrapped.)
  if (!binaryName && !npxArgs.forcesDownload(childArgs)) {
    try {
      await socket.wrap(command, { force: true });
    } catch (e) {
      process.exitCode = e.code || 1;
    }
    return;
  }

  const localBin = binaryName && path.join(projectPath, 'node_modules', '.bin', binaryName);

  // --package/-p forces npx to download that package even when the named
  // binary exists locally — those runs must stay behind the firewall
  const isLocal = !npxArgs.forcesDownload(childArgs)
    && !!(localBin && jetpack.exists(localBin));

  // Local binaries download nothing, so the firewall has nothing to protect —
  // run plain (streams live, skips the sfw startup cost)
  if (isLocal) {
    logger.log(`'${binaryName}' is installed locally — running it directly (no download to protect).`);
  } else {
    // Check firewall status upfront (blocks if not installed unless --force)
    await socket.check({ force });
  }

  // Log
  logger.log(`Running: ${logger.format.cyan(command)}`);

  // Wrap with Socket Firewall (plain run for local binaries / --force)
  try {
    await socket.wrap(command, { force: force || isLocal });
  } catch (e) {
    process.exitCode = e.code || 1;
    logger.log('');

    // A real block — only reachable on the sfw path, i.e. npx tried to
    // download '<binary>' from npm and Socket Firewall stopped it
    if (e.reason === 'sfw-blocked') {
      logger.error(`'${binaryName}' was not found in node_modules/.bin/`);
      logger.log(`npx tried to download package '${binaryName}' from npm, which was blocked by Socket Firewall.`);
      suggestOwnBin(binaryName, childArgs);

      logger.log('');
      logger.log('To retry without firewall protection:');
      logger.log(logger.format.cyan(`  npu --force ${command}`));
      return;
    }

    // The command itself failed — not a firewall matter
    logger.log(`Command failed (exit ${e.code || 1}). See the error output above.`);

    if (!isLocal) {
      suggestOwnBin(binaryName, childArgs);
    }

    return;
  }

  logger.log(logger.format.green('Done.'));
};

// If the binary is defined in this project's own bin field but not installed
// as a command, point at running it directly
function suggestOwnBin(binaryName, childArgs) {
  const pkgJson = jetpack.read(path.join(projectPath, 'package.json'), 'json');

  if (!pkgJson?.bin?.[binaryName]) {
    return;
  }

  logger.log('');
  logger.log(`'${binaryName}' is defined in this project's ${chalk.cyan('bin')} field but is not installed as a command.`);
  logger.log(`Run it directly: ${logger.format.cyan(`${pkgJson.bin[binaryName]} ${childArgs.slice(1).join(' ')}`.trim())}`);
}
