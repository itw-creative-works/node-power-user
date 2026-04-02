<p align="center">
  <a href="https://itwcreativeworks.com">
    <img src="https://cdn.itwcreativeworks.com/assets/itw-creative-works/images/logo/itw-creative-works-brandmark-black-x.svg" width="100px">
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/package-json/v/itw-creative-works/node-power-user.svg">
  <br>
  <img src="https://img.shields.io/librariesio/release/npm/node-power-user.svg">
  <img src="https://img.shields.io/bundlephobia/min/node-power-user.svg">
  <img src="https://img.shields.io/codeclimate/maintainability-percentage/itw-creative-works/node-power-user.svg">
  <img src="https://img.shields.io/npm/dm/node-power-user.svg">
  <img src="https://img.shields.io/node/v/node-power-user.svg">
  <img src="https://img.shields.io/website/https/itwcreativeworks.com.svg">
  <img src="https://img.shields.io/github/license/itw-creative-works/node-power-user.svg">
  <img src="https://img.shields.io/github/contributors/itw-creative-works/node-power-user.svg">
  <img src="https://img.shields.io/github/last-commit/itw-creative-works/node-power-user.svg">
  <br>
  <br>
  <a href="https://itwcreativeworks.com">Site</a> | <a href="https://www.npmjs.com/package/node-power-user">NPM Module</a> | <a href="https://github.com/itw-creative-works/node-power-user">GitHub Repo</a>
  <br>
  <br>
  <strong>Node Power User</strong> is the CLI that NPM should have had!
</p>

## 📦 Install Node Power User
<!-- First, install the global command line utility with npm: -->
First, install the package via npm:
```shell
npm i -g node-power-user
```

## 🦄 Features
* Clean and reinstall your node project
* Easily bump your NPM project's version without opening an editor

## 📘 Example Setup
After installing via NPM, you can use the CLI with the `npu` command.

<!-- ## 💻 Example CLI Usage
Note: you may have to run cli commands with `npx npu <command>` if you install this package locally.
  * `npu -v`: Check version of node-power-user.
  * `npu clean`: Clean your node project (runs `rm -fr node_modules && rm -fr package-lock.json && npm cache clean --force && npm install && npm rb`).
  * `npu bump`: Bump your project's version.
    * `npu bump patch`: Bump the last number
    * `npu bump minor`: Bump the middle number
    * `npu bump major`: Bump the first number
  * `npu outdated`: Compare the versions of installed modules to those in your package.json
  * `npu global`: List all global packages for all versions of Node.js on your machine (must use NVM).
  * `npu sync`: Pull the latest changes from the remote repository and push your changes.
  * `npu packages`: List all packages in your project. -->
## 💻 Example CLI Usage

### Bump Version
Bump your project's version by the specified level.
```shell
npu bump <level>
```
* `npu bump patch`: Bump the last number
* `npu bump minor`: Bump the middle number
* `npu bump major`: Bump the first number

### Clean Project
Clean your node project (runs `rm -fr node_modules && rm -fr package-lock.json && npm cache clean --force && npm install && npm rb`).
```shell
npu clean
```

### Global Packages
List all global packages for all versions of Node.js on your machine (you **must have NVM** installed).
```shell
npu global
```

### Install Packages
Install packages with supply chain protection via [Socket](https://socket.dev/). Every install is wrapped with Socket to detect malicious or compromised packages — including transitive dependencies — before they're added to your project. After install, a full `socket npm audit` runs against your entire dependency tree.

```shell
npu install
npu i <package>
npu i <package> --save-dev
npu i <package> --save-exact
```

**If Socket CLI is not installed, `npu install` will refuse to run.** Install it globally to enable protection:
```shell
npm install -g @socketsecurity/cli --save-exact
```

Use `--force` to bypass Socket protection (not recommended):
```shell
npu i <package> --force
```

### Outdated Packages
Compare the versions of installed modules to those in your package.json. When you choose to update, the install step and a full post-install audit are both wrapped with Socket for supply chain protection.
```shell
npu outdated
npu out --force  # bypass Socket protection
```

### List Packages
List all packages in your project.
```shell
npu packages
```

### Sync Changes
Pull the latest changes from the remote repository and push your changes. You can optionally supply a `--message="Your commit message here"` flag.
```shell
npu sync
```

### Open Repository
Open the current repository's remote URL in your default browser.
```shell
npu open
```

### Check Version
Check the version of node-power-user.
```shell
npu -v
```

### Wait
Wait for a specified number of ms.
```shell
npu wait <ms>
```

### Global flags
  * `--debug`: Log the commands and flags before they are executed

## 🛠️ Development
To test commands locally while developing:
```shell
npm start -- <command> [options]
```

For example:
```shell
npm start -- outdated
npm start -- bump patch
npm start -- -v
```

## 🗨️ Final Words
If you are still having difficulty, we would love for you to post a question to [the Node Power User issues page](https://github.com/itw-creative-works/node-power-user/issues). It is much easier to answer questions that include your code and relevant files! So if you can provide them, we'd be extremely grateful (and more likely to help you find the answer!)

## 📚 Projects Using this Library
[Somiibo](https://somiibo.com/): A Social Media Bot with an open-source module library. <br>
[JekyllUp](https://jekyllup.com/): A website devoted to sharing the best Jekyll themes. <br>
[Slapform](https://slapform.com/): A backend processor for your HTML forms on static sites. <br>
[Proxifly](https://proxifly.com/): A backend processor for your HTML forms on static sites. <br>
[Optiic](https://optiic.com/): A backend processor for your HTML forms on static sites. <br>
[SoundGrail Music App](https://app.soundgrail.com/): A resource for producers, musicians, and DJs. <br>
[Hammock Report](https://hammockreport.com/): An API for exploring and listing backyard products. <br>

Ask us to have your project listed! :)
