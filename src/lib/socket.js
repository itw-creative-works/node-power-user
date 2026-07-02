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

// Markers Socket Firewall prints when it ACTUALLY blocks something (sourced
// from the sfw-free v1.12.0 report output). sfw passes the wrapped command's
// exit code through, so a non-zero exit alone does NOT mean a block — a
// failing test suite exits non-zero too.
const BLOCK_MARKERS = [
  /blocked [1-9]\d* packages?:/i,                  // " - blocked 1 package: <purl> - <reason>"
  /Blocked (?:Packages|Hostnames) \([1-9]\d*\)/i,  // report section headers
  /SUMMARY: [1-9]\d* item\(s\) blocked/i,          // report summary line
];

// Check command output for sfw's block report
function isBlockOutput(output) {
  return BLOCK_MARKERS.some((marker) => marker.test(output || ''));
}

// Wrap a command with sfw if available; force (or no sfw) runs it plain.
// Output always streams live. Throws on non-zero exit with:
//   err.reason — 'sfw-blocked' (real firewall block) | 'command-failed'
//   err.code   — the child's exit code
async function wrap(command, options) {
  options = options || {};

  const wrapped = !options.force && await isFirewallAvailable();
  const finalCommand = wrapped ? `sfw ${command}` : command;

  let output = '';
  let exitCode = null;

  const executeOptions = { log: !wrapped, config: {} };

  // The wrapped child runs on pipes (not a TTY), which disables color in most
  // CLIs — restore it, but only when npu itself is printing to a real TTY
  if (wrapped && process.stdout.isTTY) {
    executeOptions.config.env = { ...process.env, FORCE_COLOR: '1' };
  }

  try {
    await execute(finalCommand, executeOptions, (child) => {
      // Echo piped output through LIVE (and capture it for block detection)
      // instead of letting it buffer invisibly until the process exits
      if (child.stdout) {
        child.stdout.on('data', (chunk) => {
          output += chunk.toString();
          process.stdout.write(chunk);
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (chunk) => {
          output += chunk.toString();
          process.stderr.write(chunk);
        });
      }

      child.on('close', (code) => {
        exitCode = code;
      });
    });
  } catch (e) {
    const blocked = wrapped && isBlockOutput(output);
    const err = blocked
      ? new Error('Blocked by Socket Firewall — it flagged a risky package.')
      : new Error(`Command failed with exit code ${exitCode === null ? 1 : exitCode}.`);

    err.reason = blocked ? 'sfw-blocked' : 'command-failed';
    err.code = exitCode === null ? 1 : exitCode;
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
  isBlockOutput,
};
