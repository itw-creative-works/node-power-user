// Libraries
const logger = new (require('../lib/logger'))('node-power-user');
const path = require('path');
const jetpack = require('fs-jetpack');
const { execute } = require('node-powertools');

// Module
module.exports = async function (options) {
  // Find the repository root by locating the .git folder
  const repoRoot = findGitRoot(process.cwd());
  if (!repoRoot) {
    logger.error('Could not find the .git folder. Are you inside a Git repository?');
    return false;
  }

  try {
    // Get the remote URL
    const result = await execute('git remote get-url origin', {
      log: false,
      config: { cwd: repoRoot },
    });

    let remoteUrl = (result.stdout || '').trim();

    if (!remoteUrl) {
      logger.error('No remote origin found for this repository.');
      return false;
    }

    // Convert SSH URL to HTTPS URL if needed
    // git@github.com:owner/repo.git -> https://github.com/owner/repo
    if (remoteUrl.startsWith('git@')) {
      remoteUrl = remoteUrl
        .replace(/^git@/, 'https://')
        .replace(/:([^/])/, '/$1')
        .replace(/\.git$/, '');
    } else if (remoteUrl.startsWith('https://') || remoteUrl.startsWith('http://')) {
      // Remove .git suffix if present
      remoteUrl = remoteUrl.replace(/\.git$/, '');
    }

    // Log the URL
    logger.log(`Opening ${remoteUrl}...`);

    // Open the URL in the default browser
    await execute(`open "${remoteUrl}"`, {
      log: false,
      config: { cwd: repoRoot },
    });

    logger.log(logger.format.green('Repository opened in browser!'));

    return true;
  } catch (e) {
    logger.error(`Failed to open repository`, e.stack);
    return false;
  }
};

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
