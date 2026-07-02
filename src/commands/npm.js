// Libraries
const logger = new (require('../lib/logger'))('node-power-user');
const socket = require('../lib/socket');
const npxArgs = require('../lib/npx-args');

// Module — `npu npm <args...>`: run ANY npm command wrapped with Socket
// Firewall, args untouched. Used by the shell shims to protect
// `npm exec|create|init` without rewriting their semantics (`npm create X`
// must stay `npm create X` — it maps to package create-X, not X).
module.exports = async function (options) {
  // Parse from RAW argv so npm's own flags pass through verbatim; npu's
  // --force goes BEFORE the npm token: `npu --force npm <args...>`
  const raw = options.raw || [
    ...(options.force ? ['--force'] : []),
    'npm',
    ...(options._ || []).slice(1).map(String),
  ];
  const { childArgs, force } = npxArgs.parsePassthroughArgs(raw, ['npm']);

  if (childArgs.length === 0) {
    logger.error('Usage: npu [--force] npm <args...>');
    logger.log(`Example: ${logger.format.cyan('npu npm create vite my-app')}`);
    process.exitCode = 1;
    return;
  }

  const command = `npm ${childArgs.map(npxArgs.quoteArg).join(' ')}`;

  // Check firewall status upfront (blocks if not installed unless --force)
  await socket.check({ force });

  // Log
  logger.log(`Running: ${logger.format.cyan(command)}`);

  // Wrap with Socket Firewall
  try {
    await socket.wrap(command, { force });
  } catch (e) {
    process.exitCode = e.code || 1;
    logger.log('');

    if (e.reason === 'sfw-blocked') {
      logger.log('Command blocked by Socket Firewall. See the output above for details.');
      logger.log('');
      logger.log('To retry without firewall protection:');
      logger.log(logger.format.cyan(`  npu --force ${command}`));
      return;
    }

    logger.log(`Command failed (exit ${e.code || 1}). See the error output above.`);
    return;
  }

  logger.log(logger.format.green('Done.'));
};
