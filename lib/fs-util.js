'use strict'

const fs = require('fs');
const util = require('util');

const open = util.promisify(fs.open);
const close = util.promisify(fs.close);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);

async function writeDataFile(path, data) {
  const fd = await open(path, 'w+');
  await writeFile(fd, data);
  await close(fd);
}

async function readDataFile(path) {
  const fd = await open(path, 'r+');
  const data = await readFile(fd);
  await close(fd);
  return data;
}

async function writeJsonFile(path, obj) {
  await writeDataFile(path, JSON.stringify(obj));
}

async function readJsonFile(path) {
  return JSON.parse(await readDataFile(path));
}

function parentPath(path) {
  var index = path.lastIndexOf('/');
  if (path == -1) {
    return "";
  }
  return path.substr(0, index);
}

async function mkdirp(path) {
  var ppath = parentPath(path);
  if (!fs.existsSync(ppath)) {
    await mkdirp(ppath);
  }
  if (!fs.existsSync(path)) {
    await mkdir(path);
  }
}

module.exports = {
  readDataFile,
  writeDataFile,
  readJsonFile,
  writeJsonFile,
  mkdirp
}
