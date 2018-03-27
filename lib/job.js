'use strict'

const { spawn } = require("child_process");
const fs = require('fs');
const util = require('util');
const dateFormat = require('dateformat');
const { mkdirp, writeJsonFile } = require('./fs-util');

const open = util.promisify(fs.open);
const close = util.promisify(fs.close);

module.exports = function(config, logger) {

function newId() {
  var rnd = '' + (Math.floor(Math.random() * 1000) + 1);
  while (rnd.length < 3) rnd = '0' + rnd;
  return dateFormat(new Date(), 'yyyymmddHHMMssl') + rnd;
}

function CliJob(id) {
  if (id == null) {
    this.id = newId();
    this.isStarted = false;
    this.isFinished = false;
  } else {
    this.id = id;
    this.isStarted = true;
    this.isFinished = true;
  }

  this.onStart = [];
  this.onFinish = [];
  this.onError = [];
  this.onSuccess = [];
}
CliJob.prototype = Object.create(Object.prototype);
CliJob.prototype.constructor = CliJob;

CliJob.prototype.isRunning = function() {
  return this.isStarted && !this.isFinished;
}

CliJob.prototype.getFinalDir = function() {
  return config.dataDir + '/' + this.id;
}
CliJob.prototype.getTempDir = function() {
  return config.dataDir + '/tmp/' + this.id;
}
CliJob.prototype.getCmdFileName = function() {
  return 'cmd';
}
CliJob.prototype.getStdoutFileName = function() {
  return 'stdout';
}
CliJob.prototype.getStderrFileName = function() {
  return 'stderr';
}
CliJob.prototype.getResultFileName = function() {
  return 'result';
}
CliJob.prototype.getJobDir = function() {
  if (!this.isFinished) {
    return this.getTempDir();
  } else {
    return this.getFinalDir();
  }
}
CliJob.prototype.getCmdPath = function() {
  return this.getJobDir() + '/' + this.getCmdFileName();
}
CliJob.prototype.getResultPath = function() {
  return this.getJobDir() + '/' + this.getResultFileName();
}
CliJob.prototype.getStdoutPath = function() {
  return this.getJobDir() + '/' + this.getStdoutFileName();
}
CliJob.prototype.getStderrPath = function() {
  return this.getJobDir() + '/' + this.getStderrFileName();
}

CliJob.prototype.on = function(evt, callback) {
  if (evt == 'start') {
    this.onStart.push(callback);
    if (this.isStarted) {
      process.nextTick(callback);
    }
  } else if (evt == 'finish') {
    this.onFinish.push(callback);
    if (this.isFinished) {
      process.nextTick(callback);
    }
  } else if (evt == 'error') {
    this.onError.push(callback);
  } else if (evt == 'success') {
    this.onSuccess.push(callback);
  }
}
CliJob.prototype.triggerStartCallback = function() {
  this.onStart.forEach(callback => process.nextTick(callback));
  this.onStart = [];
}
CliJob.prototype.triggerFinishCallback = function() {
  this.onFinish.forEach(callback => process.nextTick(callback));
  this.onFinish = [];
}
CliJob.prototype.triggerErrorCallback = function(e) {
  this.onError.forEach(callback => process.nextTick(callback, e));
  this.onError = [];
}
CliJob.prototype.triggerSuccessCallback = function() {
  this.onSuccess.forEach(callback => process.nextTick(callback));
  this.onSuccess = [];
}

CliJob.prototype.start = async function(command, args) {
  const self = this;

  if (self.isStarted) {
    return;
  }

  self.command = command;
  self.arguments = args;

  self.isStarted = true;
  self.triggerStartCallback();

  if (!fs.existsSync(self.getJobDir())) {
    try {
      logger.info('%s create temp job dir %s', self.id, self.getJobDir());
      await mkdirp(self.getJobDir());
    } catch (e) {
      self.isFinished = true;
      self.triggerErrorCallback(e);
      self.triggerFinishCallback();
      throw e;
    }
  }

  try {
    var fds = await Promise.all([
      open(self.getCmdPath(), 'w'),
      open(self.getStdoutPath(), 'w'),
      open(self.getStderrPath(), 'w'),
      open(self.getResultPath(), 'w')
    ]);
    await Promise.all([
      close(fds[0]),
      close(fds[1]),
      close(fds[2]),
      close(fds[3])
    ]);
  } catch(e) {
    self.isFinished = true;
    self.triggerErrorCallback(e);
    self.triggerFinishCallback();
    throw e;
  }

  try {
    await writeJsonFile(self.getCmdPath(), {
      command: self.command,
      arguments: self.arguments
    });
  } catch(e) {
    self.isFinished = true;
    self.triggerErrorCallback(e);
    self.triggerFinishCallback();
    throw e;
  }

  var proc;
  try {
    proc = spawn(self.command, self.arguments);
  } catch(e) {
    self.isFinished = true;
    self.triggerErrorCallback(e);
    self.triggerFinishCallback();
    throw e;
  }

  logger.info('%s create child process with pid %s', self.id, proc.pid);

  proc.on('error', async (e) => {
    logger.error('%s get an error, %s', self.id, JSON.stringify(e));
    self.isFinished = true;
    self.triggerErrorCallback(e);
    self.triggerFinishCallback();
  });

  logger.info('%s redirect stdout to %s', self.id, self.getStdoutPath());
  proc.stdout.pipe(fs.createWriteStream(self.getStdoutPath()));
  logger.info('%s redirect stderr to %s', self.id, self.getStderrPath());
  proc.stderr.pipe(fs.createWriteStream(self.getStderrPath()));

  proc.on('close', async (code) => {
    logger.info('%s exit code %d', self.id, code);
    self.code = code;

    // save result to file system
    logger.info('%s save result files', self.id);
    try {
      await writeJsonFile(self.getResultPath(), { code: self.code });
    } catch(e) {
      logger.error('%s failed to save result to file system, %s', self.id, JSON.stringify(e));
      self.isFinished = true;
      self.triggerErrorCallback(e);
      self.triggerFinishCallback();
      return;
    }

    // move files to final dir
    logger.info('%s move files from %s to %s', self.id, self.getTempDir(), self.getFinalDir());
    fs.renameSync(self.getTempDir(), self.getFinalDir());

    self.isFinished = true;
    self.triggerSuccessCallback();
    self.triggerFinishCallback();
  });
}

return {
  CliJob
}

};
