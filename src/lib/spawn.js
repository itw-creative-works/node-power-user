// Libraries
const childProcess = require('child_process');
const jetpack = require('fs-jetpack');
const path = require('path');
const { quoteArg } = require('./npx-args');

// cmd.exe metacharacters: each is escaped with ^ so cmd keeps it as text
const CMD_META = /([()\][%!^"`<>&|;, *?])/g;

// Windows env keys are case-insensitive, but a copied env object is not
function envValue(env, name) {
  const key = Object.keys(env).find((k) => k.toUpperCase() === name);
  return key ? env[key] : '';
}

// The file cmd.exe runs for a bin: the first PATH dir holding it under a
// PATHEXT extension (npm, npx and sfw resolve to their .cmd shims)
function resolveWindowsBin(bin, env) {
  const exts = (envValue(env, 'PATHEXT') || '.COM;.EXE;.BAT;.CMD').split(';');

  for (const dir of envValue(env, 'PATH').split(';')) {
    for (const ext of exts) {
      const file = path.join(dir, `${bin}${ext}`);
      if (dir && jetpack.exists(file) === 'file') {
        return file;
      }
    }
  }

  return null;
}

// One arg on a cmd.exe line: C-runtime quoting, then every metacharacter
// escaped, twice for a batch file, whose %* line cmd parses a second time
function cmdArg(arg, batch) {
  const once = quoteArg(arg, 'win32').replace(CMD_META, '^$1');
  return batch ? once.replace(CMD_META, '^$1') : once;
}

// Spawn a bin with its args, each reaching the child exactly as written.
// Windows runs bins through cmd.exe, as a .cmd shim needs.
function spawn(bin, args, options, platform = process.platform) {
  if (platform !== 'win32') {
    return childProcess.spawn(bin, args, options);
  }

  const env = options.env || process.env;
  const batch = /\.(?:cmd|bat)$/i.test(resolveWindowsBin(bin, env) || '');
  const line = [bin, ...args.map((arg) => cmdArg(arg, batch))].join(' ');

  return childProcess.spawn(envValue(env, 'COMSPEC') || 'cmd.exe', ['/d', '/s', '/c', `"${line}"`], {
    ...options,
    windowsVerbatimArguments: true,
  });
}

// Export
module.exports = {
  cmdArg,
  spawn,
};
