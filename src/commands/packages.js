// Libraries
const logger = new (require('../lib/logger'))('node-power-user');
const path = require('path');
const jetpack = require('fs-jetpack');
const chalk = require('chalk').default;
const { table } = require('table');

// Load package.json
const projectPath = process.cwd();
const projectJson = jetpack.read(path.join(projectPath, 'package.json'), 'json') || {};

// Module
module.exports = async function (options) {
  // Log start
  logger.log(`Listing dependencies for ${logger.format.bold(projectJson.name || 'Unknown Project')} (v${projectJson.version || '0.0.0'})...`);

  // Initialize response
  const response = {
    dependencies: {},
    devDependencies: {},
    peerDependencies: {}
  };

  // Initialize table data
  const data = [['name', 'Version']];

  // Helper function to process dependencies
  const processDeps = (deps, type, label) => {
    if (!deps || Object.keys(deps).length === 0) return;

    // Insert a separator row if the table already has data
    if (data.length > 1) data.push([label, chalk.gray('───────')]);

    Object.entries(deps).forEach(([pkg, version]) => {
      data.push([pkg, version]);
      response[type][pkg] = version;
    });
  };

  // Process dependencies
  processDeps(projectJson.dependencies, 'dependencies', 'Dependencies');
  processDeps(projectJson.devDependencies, 'devDependencies', 'Dev Dependencies');
  processDeps(projectJson.peerDependencies, 'peerDependencies', 'Peer Dependencies');

  // Check if the table has any data
  if (data.length === 1) {
    logger.warn('No dependencies found in package.json.');
    return response;
  }

  // Display table
  console.log(table(data));

  // Log completion
  logger.log(logger.format.green('Package listing completed successfully!'));

  return response;
};
