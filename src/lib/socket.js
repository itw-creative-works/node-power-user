// Libraries
const fs = require('fs');
const { execute } = require('node-powertools');
const { spawn } = require('./spawn');
const logger = new (require('./logger'))('node-power-user');

// Whether npu's stdin is a file (`npu npx tool < input.txt`); a closed fd 0 is not
function stdinIsFile() {
  try {
    return fs.fstatSync(0).isFile();
  } catch (e) {
    return false;
  }
}

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

// Wrap a bin and its args with sfw if available; force (or no sfw) runs it
// plain, output streaming live, each arg reaching the child as written. A
// non-zero exit throws with err.reason 'sfw-blocked' or 'command-failed', and
// err.code the exit code.
async function wrap(bin, args, options) {
  options = options || {};

  const wrapped = !options.force && await isFirewallAvailable();
  const [file, fileArgs] = wrapped ? ['sfw', [bin, ...args]] : [bin, args];

  let output = '';

  // sfw waits for its stdin to close, so it shares npu's stdin only when that
  // is a terminal or a redirected file; a pipe may never close, as Git Bash's
  // mintty gives. Only stdout/stderr are piped, for the live echo below.
  const stdin = process.stdin.isTTY || stdinIsFile() ? 'inherit' : 'ignore';
  const config = { stdio: wrapped ? [stdin, 'pipe', 'pipe'] : 'inherit' };

  // The wrapped child runs on pipes (not a TTY), which disables color in most
  // CLIs: restore it, but only when npu itself is printing to a real TTY
  if (wrapped && process.stdout.isTTY) {
    config.env = { ...process.env, FORCE_COLOR: '1' };
  }

  const { code, spawnError } = await new Promise((resolve) => {
    const child = spawn(file, fileArgs, config);

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

    child.on('error', (e) => resolve({ code: null, spawnError: e }));
    child.on('close', (exitCode) => resolve({ code: exitCode }));
  });

  if (code === 0) {
    return;
  }

  const blocked = wrapped && isBlockOutput(output);
  const err = blocked
    ? new Error('Blocked by Socket Firewall: it flagged a risky package.')
    : new Error(spawnError ? `Could not run ${file}: ${spawnError.message}` : `Command failed with exit code ${code === null ? 1 : code}.`);

  err.reason = blocked ? 'sfw-blocked' : 'command-failed';
  err.code = code === null ? 1 : code;
  throw err;
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
