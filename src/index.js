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
const powertools = require('node-powertools');
const { isEqual } = require('lodash');
const semverIsEqual = require('semver/functions/eq')
const semverCoerce = require('semver/functions/coerce')
const table = require('table').table;
const ProgressBar = require('cli-progress');
const Npm = require('npm-api');
const os = require('os');

// const npm = require('npm');

function Main() {

}

Main.prototype.process = async function (options) {
  const self = this;
  self.options = options || {};

  // console.log('--process.env', process.env);

  try {
    self.npu_packageJSON = require('../package.json');
  } catch (e) {
    throw new Error(`NPU does not contain a valid package.json file!: \n${e}`);
  }

  try {
    self.proj_path = process.cwd();
    self.proj_packageJSONPath = path.resolve(self.proj_path, './package.json');
    self.proj_packageJSON = require(self.proj_packageJSONPath);
    self.proj_packageJSON.allDependencies = _.merge({}, self.proj_packageJSON.peerDependencies, self.proj_packageJSON.devDependencies, self.proj_packageJSON.dependencies);
    self.proj_packageJSON.allDependenciesKeys = Object.keys(self.proj_packageJSON.allDependencies);
  } catch (e) {
    self.proj_packageJSON = {
      name: 'Unknown Name',
      version: '0.0.0',
      dependencies: {},
      devDependencies: {},
      peerDependencies: {},
      allDependencies: {},     
    }
    console.error(chalk.red(`This project does not contain a valid package.json file!: \n${e}`));
  }

  // console.log('---args', args);
  // if (Array.isArray(args)) {
  //   for (var i = 0; i < args.length; i++) {
  //     self.options[args[i]] = true;
  //   }    
  // } else {
  //   Object.keys(args)
  //   .forEach((arg, i) => {
  //     self.options[arg] = args[arg];
  //   });
  // }
  Object.keys(argv)
  .forEach(arg => {
    self.options[arg] = argv[arg]
  });

  if (self.options.d || self.options.debug || self.options._.includes('debug') || process.env.NPU_LOG === 'true') {
    console.log('argv', argv);
    console.log('options', self.options); 
  }

  if (self.options.wait || self.options._.includes('wait')) {
    const time = parseInt(typeof self.options.wait === 'number' ? self.options.wait : 1000);
    self.log(chalk.blue(`Waiting ${time}...`));
    await powertools.wait(time);
    self.log(chalk.green(`Done waiting`));
  }  

  if (self.options.v || self.options.version || self.options._.includes('version')) {
    self.log(chalk.blue(`Node Power User is v${chalk.bold(self.npu_packageJSON.version)}`));
    return self.npu_packageJSON.version;
  }

  if (self.options.pv || self.options.project || self.options['project-version'] || self.options._.includes('project')) {
    self.log(chalk.blue(`The current project (${chalk.bold(self.proj_packageJSON.name)}) is v${chalk.bold(self.proj_packageJSON.version)}`));
    return self.proj_packageJSON.version;
  }

  if (self.options.lp || self.options.listpackages || self.options['list-packages'] || self.options._.includes('listpackages')) {
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

  if (self.options.out || self.options.outdated || self.options.match || self.options._.includes('out') || self.options._.includes('outdated') || self.options._.includes('match')) {
    // self.log(chalk.blue.bold(`Outdated:`));
    // self.log(chalk.green(`name: package = installed`));

    const data = [
      ['Package', 'package.json', 'Intalled', 'Latest'],
    ];

    const config = {
      columnDefault: {
        // width: 10,
      },
      header: {
        alignment: 'center',
        content: 'Outdated and mismatched packages',
      },
    }  
    const progress = new ProgressBar.SingleBar({}, ProgressBar.Presets.shades_classic);
    progress.start(self.proj_packageJSON.allDependenciesKeys.length, 0);

    const response = {};

    let bumpCommand = '';

    for (var i = 0; i < self.proj_packageJSON.allDependenciesKeys.length; i++) {
      progress.update(i);
      const dep = self.proj_packageJSON.allDependenciesKeys[i];
      const packageVersion = _coerce(self.proj_packageJSON.allDependencies[dep]);
      const installedVersion = _coerce(
        _getVersion(
          (await asyncCommand(`npm list ${dep} --depth=0 | grep ${dep}`))
            .split(' ')[1]
        )
      );
      const latestVersion = await getLatestVersion(dep);
      const isEqual = _isEqual(installedVersion, packageVersion);
      const isLatest = _isEqual(packageVersion, latestVersion);
      const verbLocal = isEqual ? 'green' : 'yellow';
      const verbRemote = isLatest ? 'green' : 'red';

      if (!isEqual) {
        bumpCommand += `npm i ${dep}@${installedVersion} && `
      }

      // function _color(array) {
      //   array.forEach((item, i) => {
      //     array[i] = chalk[verb](item);
      //   });
      //   return array;
      // }
      // data.push(_color([ dep, packageVersion, installedVersion, latestVersion]))

      // function _color(s) {
      //   return chalk[verb](s);
      // }

      data.push([
        dep, 
        packageVersion, 
        chalk[verbLocal](installedVersion), 
        chalk[verbRemote](latestVersion), 
      ])

      response[dep] = {
        isEqual: isEqual,
        isLatest: isLatest,
        package: packageVersion,
        installed: installedVersion,
        latest: latestVersion,
      }

      // self.log(chalk[verb](`${dep}: ${packageVersion} = ${installedVersion}`));
    };

    // self.log(chalk.blue.bold(`\nDev Dependencies:`));
    // Object.keys(self.proj_packageJSON.devDependencies || {})
    // .forEach((dep, i) => {
    //   self.log(chalk.blue(`${dep} @ ${self.proj_packageJSON.devDependencies[dep]}`));
    // }); 
    
    progress.stop();

    console.log(table(data, config));

    if (bumpCommand) {
      bumpCommand = bumpCommand.replace(/&&\s$/ig, '')
      inquirer.prompt([
        {
          type: 'confirm',
          name: 'bump',
          message: 'Would you like to bump the package.json versions?',
          default: true,
        }
      ])
      .then(async (answer) => {
        if (answer.bump) {
          asyncCommand(bumpCommand);
        } else {
        }
      })           
    } 

    return response;  
  }

  if (self.options.global || self.options.g || self.options._.includes('global')) {
    const parentPath = `/Users/${os.userInfo().username}/.nvm/versions/node`;
    const versions = jetpack.list(parentPath);
    const currentNode = process.versions.node;

    const response = {};

    // console.log(chalk.bold.blue('NVM Global Modules'));

    for (var i = 0; i < versions.length; i++) {
      try {
        const parsed = semverCoerce(versions[i]);
        const lib = path.resolve(parentPath, `v${parsed.version}`, 'lib', 'node_modules');

        const modules = jetpack.list(lib);

        const data = [
          ['Package', 'package.json', 'latest'],
        ];

        const config = {
          columnDefault: {
            // width: 10,
          },
          header: {
            alignment: 'center',
            content: `Global packages for v${parsed.version}`,
          },
        }
        const progress = new ProgressBar.SingleBar({}, ProgressBar.Presets.shades_classic);
        progress.start(modules.length, 0);        

        response[parsed.version] = {};

        for (var j = 0; j < modules.length; j++) {
          progress.update(i, 0);        

          const mod = modules[j];
          const packagePath = path.resolve(lib, mod, 'package.json');
          try {
            const package = require(packagePath);  

            const packageVersion = package.version;
            const latestVersion = await getLatestVersion(mod);
            // const isEqual = _isEqual(installedVersion, packageVersion);
            const isLatest = _isEqual(packageVersion, latestVersion);
            // const verbLocal = isEqual ? 'green' : 'yellow';
            const verbRemote = isLatest ? 'green' : 'red';            

            data.push([
              mod, 
              packageVersion,
              chalk[verbRemote](latestVersion),
            ]);

            response[parsed.version][mod] = {
              packageVersion: packageVersion,
              latestVersion: latestVersion,
            }       
          } catch (e) {
            
          }
        }

        progress.stop();

        console.log(table(data, config));

      } catch (e) {
        
      }
    }

    return response;
  }

  if (self.options.clean || self.options._.includes('clean')) {
    const NPM_INSTALL_FLAG = self.options['no-optional'] || self.options['nooptional'] ? '--no-optional' : ''
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

  if (self.options.bump || self.options._.includes('bump')) {
    return bump(self);
  }

};

Main.prototype.log = function () {
  const self = this;

  if (self.options.log !== false) {
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

function _coerce(v) {
  try {
    return semverCoerce(v)
  } catch (e) {
    return '0.0.0'
  }
}

function _isEqual(v1, v2) {
  try {
    return semverIsEqual(v1, v2)
  } catch (e) {
    return false;
  }
}

function _getVersion(v) {
  v = v.split('@');
  return v[v.length - 1]
}

function getLatestVersion(package) {
  return new Promise(function(resolve, reject) {
    const npm = new Npm();
    
    npm.repo(package)
    .package()
      .then(function(pkg) {
        resolve(pkg.version);
      }, function(err) {
        resolve('?');
      });      
  });
}
