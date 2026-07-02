// Pure raw-argv parsing for passthrough commands (`npu npx`, `npu install`,
// `npu npm`) — the child command's flags must pass through verbatim (yargs
// would otherwise consume them), so npu's own flags go BEFORE the command
// token: `npu [--force] npx <command> [args...]`

// Tokens that select the npx command (positional + flag alias)
const NPX_TOKENS = ['npx', '--npx'];

// Args matching this need no quoting for POSIX sh (commands run with shell: true)
const SAFE_ARG = /^[A-Za-z0-9_\-./@=:,+]+$/;

// Split raw argv into npu's own flags (before the command token) and the
// child command's args (everything after, verbatim)
function parsePassthroughArgs(rawArgs, tokens) {
  const args = rawArgs || [];
  const tokenIndex = args.findIndex((arg) => tokens.includes(arg));

  if (tokenIndex === -1) {
    return { childArgs: [], force: false };
  }

  return {
    childArgs: args.slice(tokenIndex + 1),
    force: args.slice(0, tokenIndex).includes('--force'),
  };
}

// npx-flavored parse (the common case)
function parseNpxArgs(rawArgs) {
  return parsePassthroughArgs(rawArgs, NPX_TOKENS);
}

// npx's --package/-p makes it download that package regardless of which
// binary is named — such runs must never skip the firewall. Scans the whole
// arg list (a -p meant for the child, e.g. `tsc -p tsconfig.json`, is a
// false positive — fail-closed: it just runs wrapped instead of fast).
function forcesDownload(args) {
  return (args || []).some((arg) => {
    return arg === '-p'
      || arg === '--package'
      || arg.startsWith('--package=');
  });
}

// First non-flag token = the binary npx will run (null when only flags)
function firstPositional(args) {
  return (args || []).find((arg) => !arg.startsWith('-')) || null;
}

// Single-quote an arg for the shell when it contains anything unsafe
function quoteArg(arg) {
  if (SAFE_ARG.test(arg)) {
    return arg;
  }

  return `'${String(arg).replace(/'/g, `'\\''`)}'`;
}

// Rebuild the npx command string with shell-safe quoting
function buildCommand(childArgs) {
  return ['npx', ...childArgs.map(quoteArg)].join(' ');
}

// Export
module.exports = {
  parsePassthroughArgs,
  parseNpxArgs,
  forcesDownload,
  firstPositional,
  quoteArg,
  buildCommand,
};
