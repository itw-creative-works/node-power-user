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

  // Log initial state
  logger.log(`Syncing repo...`);

  try {
    // First, pull changes from remote
    logger.log('Pulling changes from remote...');
    const pullResult = await execute('git pull', {
      log: false,
      config: {cwd: repoRoot},
    });

    // Check if there were any changes pulled
    const pullOutput = pullResult || '';
    if (pullOutput.includes('Already up to date') || pullOutput.includes('Already up-to-date')) {
      logger.log('Already up to date - no changes pulled');
    } else {
      // Try to extract the number of files changed
      const filesChangedMatch = pullOutput.match(/(\d+) file[s]? changed/);
      const insertionsMatch = pullOutput.match(/(\d+) insertion[s]?/);
      const deletionsMatch = pullOutput.match(/(\d+) deletion[s]?/);

      if (filesChangedMatch) {
        const filesChanged = filesChangedMatch[1];
        const insertions = insertionsMatch ? insertionsMatch[1] : '0';
        const deletions = deletionsMatch ? deletionsMatch[1] : '0';
        logger.log(logger.format.green(`Pulled changes: ${filesChanged} file(s) changed, ${insertions} insertion(s), ${deletions} deletion(s)`));
      } else {
        logger.log(logger.format.green('Changes pulled successfully'));
      }
    }

    // Collect answers using the new @inquirer/prompts methods
    const message = await ask({
      message: 'Enter a commit message',
      default: 'Update',
      value: options.message,
      multiline: false,
    });

    // Stage all changes first
    await execute('git add .', {
      log: false,
      config: {cwd: repoRoot},
    });

    // Check if there are staged changes to commit
    const statusResult = await execute('git status --porcelain', {
      log: false,
      config: {cwd: repoRoot},
    });

    const hasChanges = (statusResult || '').trim().length > 0;

    if (!hasChanges) {
      logger.log(logger.format.green('Already up to date - nothing to commit'));
      return true;
    }

    // Commit and push changes
    logger.log('Committing and pushing changes...');
    const pushCommand = `git commit -m "${message}" && git push origin`;

    await execute(pushCommand, {
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
