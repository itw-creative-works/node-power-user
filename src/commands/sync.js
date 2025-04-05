// Libraries
const logger = new (require('../lib/logger'))('node-power-user');
const path = require('path');
const jetpack = require('fs-jetpack');
const { execute } = require('node-powertools');
const inquirer = require('@inquirer/prompts');

// Load package.json files
const package = jetpack.read(path.join(__dirname, '../../', 'package.json'), 'json');
const project = jetpack.read(path.join(process.cwd(), 'package.json'), 'json');

// Module
module.exports = async function (options) {
  // Find the repository root by locating the .git folder
  const repoRoot = findGitRoot(process.cwd());
  if (!repoRoot) {
    logger.error('Could not find the .git folder. Are you inside a Git repository?');
    return false;
  }

  // Collect answers using the new @inquirer/prompts methods
  const message = await ask({
    message: 'Enter a commit message',
    default: 'Update',
    value: options.message,
    multiline: false,
  });

  // Define cleanup command
  const command = `git pull && git add . && git commit -m "${message}" && git push origin`;

  // Log initial state
  logger.log(`Syncing repo...`);

  try {
    // Run cleanup commands with the repository root as the working directory
    await execute(command, {
      log: true,
      config: {cwd: repoRoot},
    });

    // Log success
    logger.log(logger.format.green('Sync completed successfully!'));

    return true;
  } catch (e) {
    // Log failure
    logger.error(`Sync failed`, e.stack);

    return false;
  }
};

function ask(options) {
  options = options || {};

  // If a value is provided, return it
  if (typeof options.value !== 'undefined') {
    return options.value;
  }

  // Check if multuiline is enabled
  if (options.multiline) {
    return inquirer.editor({
      message: options.message,
      default: options.default,
    });
  }

  return inquirer.input({
    message: options.message,
    default: options.default,
  });
}

function findGitRoot(startPath) {
  let currentPath = startPath;

  while (currentPath !== path.parse(currentPath).root) {
    if (jetpack.exists(path.join(currentPath, '.git')) === 'dir') {
      return currentPath;
    }
    currentPath = path.dirname(currentPath);
  }

  return null;
}
