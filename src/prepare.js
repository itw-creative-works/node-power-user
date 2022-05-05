const jetpack = require('fs-jetpack');
const package = require('../package.json');

jetpack.write(
  './dist/cli.js',
  jetpack.read('./src/cli.js').replace(/{version}/igm, package.version),
)
