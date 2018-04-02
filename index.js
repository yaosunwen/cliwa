'use strict'

const express = require('express');
const uuid = require('node-uuid')
const {urlencoded} = require('body-parser');

module.exports = function(config, logger) {
  logger.info('cliwa config %s', JSON.stringify(config));

  const {execHandler, fileHandler} = require('./lib/cli-handlers')(config, logger);
  const {forwardHandler} = require('./lib/forward-handlers')(config, logger);
  const {reqLogHandler, resLogHandler} = require('./lib/log-handlers')(config, logger);

  const cliwa = express.Router();
  cliwa.use((req, res, next) => {req.id = uuid.v4(); next();});
  cliwa.use(reqLogHandler);
  cliwa.use(resLogHandler);
  cliwa.use(urlencoded({extended: true})); // for parsing application/x-www-form-urlencoded
  cliwa.use(express.static(__dirname + '/public'));

  var execHandlers = [execHandler];
  var cliHandlers = [fileHandler, forwardHandler];
  if (config.s3 != null) {
    logger.info('loading s3 handlers ...');
    const {uploadHandler, downloadHandler} = require('./lib/s3-handlers')(config, logger);
    execHandlers.push(uploadHandler);
    cliHandlers.push(downloadHandler);
  }

  cliwa.post('/exec', execHandlers);
  cliwa.get('/cli/:id/:filename', cliHandlers);

  return cliwa;
}
