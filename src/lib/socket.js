// Libraries
const { execute } = require('node-powertools');
const logger = new (require('./logger'))('node-power-user');

// Check if sfw (Socket Firewall) is installed
let _sfwVersion = undefined;
async function isFirewallAvailable() {
  if (_sfwVersion !== undefined) {
    return !!_sfwVersion;
  }

  try {
    _sfwVersion = (await execute('sfw --version', { log: false })).trim();
  } catch (e) {
    _sfwVersion = null;
  }

  return !!_sfwVersion;
}

// Log firewall status upfront (call at the start of commands)
async function check(options) {
  options = options || {};

  const available = await isFirewallAvailable();

  if (available) {
    logger.log(logger.format.green(`${_sfwVersion} — supply chain protection enabled.`));
  } else {
    logger.error('Socket Firewall (sfw) is not installed. Installs are NOT protected against supply chain attacks.');
    logger.error(`Install it with: ${logger.format.cyan('npm install -g sfw')}`);

    if (!options.force) {
      logger.error('Refusing to proceed without firewall protection. Use --force to bypass.');
      throw new Error('Socket Firewall is not installed.');
    }

    logger.warn('Bypassing firewall protection (--force flag detected).');
  }

  return available;
}

// Wrap an npm command with sfw if available
async function wrap(command, options) {
  options = options || {};

  const available = await isFirewallAvailable();

  // If firewall is not installed or --force is used, run plain npm
  if (!available || options.force) {
    try {
      await execute(command, { log: true });
    } catch (e) {
      const err = new Error('npm install failed. See the error output above.');
      err.reason = 'npm-failed';
      throw err;
    }
    return;
  }

  // Run with Socket Firewall
  let output;
  let exitedWithError = false;

  try {
    output = await execute(`sfw ${command}`, { log: false });
  } catch (e) {
    output = e.message || '';
    exitedWithError = true;
  }

  if (output) {
    console.log(output);
  }

  if (exitedWithError) {
    const err = new Error('Install blocked — Socket Firewall may have flagged a risky package.');
    err.reason = 'sfw-blocked';
    throw err;
  }
}

// Socket Firewall handles protection at install time — no separate audit step needed
async function audit() {}

// Export
module.exports = {
  isAvailable: isFirewallAvailable,
  check,
  wrap,
  audit,
};
