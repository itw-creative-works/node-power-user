// CLI GUIDE:
// https://www.twilio.com/blog/how-to-build-a-cli-with-node-js
// https://www.npmjs.com/package/@dkundel/create-project

// https://www.sitepoint.com/javascript-command-line-interface-cli-node-js/
// https://github.com/sitepoint-editors/ginit
const jetpack = require('fs-jetpack');
const chalk = require('chalk');
const _ = require('lodash');
const inquirer = require('inquirer');
const path = require('path');
const { spawn, exec } = require('child_process');
const argv = require('yargs').argv;
const JSON5 = require('json5');

function Main() {

}

Main.prototype.process = async function (args) {
const self = this;
  args = args || process.argv
  self.options = {};
  self.argv = argv;

  try {
    self.npu_packageJSON = require('../package.json');
  } catch (e) {
    throw new Error(`NPU does not contain a valid package.json file!: \n${e}`);
  }

  try {
    self.proj_path = process.cwd();
    self.proj_packageJSONPath = path.resolve(self.proj_path, './package.json');
    self.proj_packageJSON = require(self.proj_packageJSONPath);
  } catch (e) {
    self.proj_packageJSON = {
      name: 'Unknown Name',
      version: '0.0.0',
      dependencies: {},
      devDependencies: {},
      peerDependencies: {},
    }
    console.error(chalk.red(`This project does not contain a valid package.json file!: \n${e}`));
  }

  if (Array.isArray(args)) {
    for (var i = 0; i < args.length; i++) {
      self.options[args[i]] = true;
    }    
  } else {
    Object.keys(args)
    .forEach((arg, i) => {
      self.options[arg] = args[arg];
    });
  }

  if (self.options.d || self.options.debug || self.options['-d'] || self.options['--debug']) {
    console.log('options:', self.options); 
  }

  if (self.options.v || self.options.version || self.options['-v'] || self.options['--version']) {
    self.log(chalk.blue(`Node Power User is v${chalk.bold(self.npu_packageJSON.version)}`));
    return self.npu_packageJSON.version;
  }

  if (self.options.pv || self.options['project-version'] || self.options.project) {
    self.log(chalk.blue(`The current project (${chalk.bold(self.proj_packageJSON.name)}) is v${chalk.bold(self.proj_packageJSON.version)}`));
    return self.proj_packageJSON.version;
  }

  if (self.options.lp || self.options.listpackages || self.options['-lp'] || self.options['--listpackages']) {
    self.log(chalk.blue.bold(`Dependencies:`));
    Object.keys(self.proj_packageJSON.dependencies || {})
    .forEach((dep, i) => {
      self.log(chalk.blue(`${dep} @ ${self.proj_packageJSON.dependencies[dep]}`));
    });

    self.log(chalk.blue.bold(`\nDev Dependencies:`));
    Object.keys(self.proj_packageJSON.devDependencies || {})
    .forEach((dep, i) => {
      self.log(chalk.blue(`${dep} @ ${self.proj_packageJSON.devDependencies[dep]}`));
    });

    self.log(chalk.blue.bold(`\nPeer Dependencies:`));
    Object.keys(self.proj_packageJSON.peerDependencies || {})
    .forEach((dep, i) => {
      self.log(chalk.blue(`${dep} @ ${self.proj_packageJSON.peerDependencies[dep]}`));
    });

    return {
      dependencies: self.proj_packageJSON.dependencies,
      devDependencies: self.proj_packageJSON.devDependencies,
      peerDependencies: self.proj_packageJSON.peerDependencies,
    };
  }

  if (self.options.clean) {
    const NPM_INSTALL_FLAG = self.options['--no-optional'] || self.options['-no-optional'] || self.options['no-optional'] ? '--no-optional' : ''
    const NPM_CLEAN = `rm -fr node_modules && rm -fr package-lock.json && npm cache clean --force && npm install ${NPM_INSTALL_FLAG} && npm rb`;
    self.log(chalk.blue(`Running: ${NPM_CLEAN}...`));
    return await asyncCommand(NPM_CLEAN)
    .then(r => {
      self.log(chalk.green(`Finished cleaning`));
    })
    .catch(e => {
      self.log(chalk.green(`Error cleaning: ${e}`));
    })
  }

  if (self.options.bump) {
    return bump(self);
  }


};

Main.prototype.log = function () {
  const self = this;

  if (self.options.lo !== false) {
    console.log(...arguments);
  }
};

module.exports = Main;

function bump(self) {
  const semver = require('semver');
  let level = '';
  const version = self.proj_packageJSON.version;
  // let version = '3.1.0-beta.0';
  let newVersion = [semver.major(version), semver.minor(version), semver.patch(version)];
  let newVersionPost = version.split('-')[1];
  let newVersionString = '';
  
  if (self.options.break || self.options.breaking || self.options.major || self.options['3']) {
    level = 'breaking';
    newVersion[0]++;
    newVersion[1] = 0;
    newVersion[2] = 0;
  } else if (self.options.feature || self.options.features || self.options.med || self.options.medium || self.options['2']) {
    level = 'feature';
    newVersion[1]++;
    newVersion[2] = 0;
  } else {
    level = 'patch';
    newVersion[2]++;
  }
  newVersionString = newVersion.join('.') + (newVersionPost ? `-${newVersionPost}` : '');

  self.proj_packageJSON.version = newVersionString;

  jetpack.write(self.proj_packageJSONPath, self.proj_packageJSON);

  self.log(chalk.blue(`Bumped package.json from ${chalk.bold(version)} to ${chalk.bold(newVersionString)}`));

  return newVersionString;
}


async function asyncCommand(command) {
  return new Promise(function(resolve, reject) {
    let cmd = exec(command, function (error, stdout, stderr) {
      if (error) {
        console.error(error);
        return reject(error);
      } else {
        return resolve(stdout);
      }
    });
  });
}
