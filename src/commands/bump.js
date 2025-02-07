// Libraries
const logger = new (require('../lib/logger'))('node-power-user');
const path = require('path');
const jetpack = require('fs-jetpack');
const version = require('wonderful-version');

// Load package
const package = jetpack.read(path.join(__dirname, '../../', 'package.json'), 'json');
const project = jetpack.read(path.join(process.cwd(), 'package.json'), 'json');

// Module
module.exports = async function (options) {
  // Determine bump level
  const ver = project.version;
  let newVer;

  // Log
  // logger.log(`Current version: ${ver}`, options);

  // Bump
  if (options.major || options._.includes('major')) {
    newVer = version.increment(ver, 'major');
  } else if (options.minor || options._.includes('minor')) {
    newVer = version.increment(ver, 'minor');
  } else {
    newVer = version.increment(ver, 'patch');
  }

  // Update package.json
  project.version = newVer;

  // Write package.json
  jetpack.write(path.join(process.cwd(), 'package.json'), project);

  // Log
  logger.log(`Bumped version: ${logger.format.bold(ver)} ==> ${logger.format.bold(newVer)}`);

  // Return new version
  return newVer;
};
