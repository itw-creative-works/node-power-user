<p align="center">
  <a href="https://cdn.itwcreativeworks.com/assets/itw-creative-works/images/logo/itw-creative-works-brandmark-black-x.svg">
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

## Install
<!-- First, install the global command line utility with npm: -->
First, install the package via npm:
```shell
npm i -g node-power-user
```

## Features
* Clean and reinstall your node project
* Easily bump your NPM project's version without opening an editor

## Example Setup
After installing via NPM, you can use the CLI with the `npu` command.

## Example CLI Usage
Note: you may have to run cli commands with `npx npu <command>` if you install this package locally.
  * `npu v`: Check version of node-power-user.
  * `npu pv`: Check version of the current project.
  * `npu clean`: Clean your node project (runs `rm -fr node_modules && rm -fr package-lock.json && npm cache clean --force && npm install && npm rb`).
  * `npu bump`: Bump your project's version.
    * `npu bump 1`: Bump the last number (`patch` version).
    * `npu bump 2`: Bump the middle number (`minor` version).
    * `npu bump 3`: Bump the first number (`major` version).
  * `npu outdated`: Compare the versions of installed modules to those in your package.json

## Final Words
If you are still having difficulty, we would love for you to post a question to [the Node Power User issues page](https://github.com/itw-creative-works/node-power-user/issues). It is much easier to answer questions that include your code and relevant files! So if you can provide them, we'd be extremely grateful (and more likely to help you find the answer!)

## Projects Using this Library
[Somiibo](https://somiibo.com/): A Social Media Bot with an open-source module library. <br>
[JekyllUp](https://jekyllup.com/): A website devoted to sharing the best Jekyll themes. <br>
[Slapform](https://slapform.com/): A backend processor for your HTML forms on static sites. <br>
[Proxifly](https://proxifly.com/): A backend processor for your HTML forms on static sites. <br>
[Optiic](https://optiic.com/): A backend processor for your HTML forms on static sites. <br>
[SoundGrail Music App](https://app.soundgrail.com/): A resource for producers, musicians, and DJs. <br>
[Hammock Report](https://hammockreport.com/): An API for exploring and listing backyard products. <br>

Ask us to have your project listed! :)
