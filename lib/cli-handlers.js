'use strict'

const url = require('url');
const util = require('util');
const fs = require('fs');
const os = require('os');
const base64 = require('./base64');

const stat = util.promisify(fs.stat);

const ongoingJobs = {};

module.exports = function(config, logger) {
  const { CliJob } = require('./job')(config, logger);

  function isCommandAllowed(command) {
    for (var i = 0; i < config.allowedCommands.length; i++) {
      if (config.allowedCommands[i] === command) {
        return true;
      }
    }
    return false;
  }

  async function execHandler(req, res, next) {

    const referrerUrl = req.headers['referrer'] || req.headers['referer'];
    if (referrerUrl == null) {
      logger.info("%s It doesn't contain referrer url.", req.id);
      res.status(400).end(); //Bad Request
      return;
    }

    const cmd = req.body;
    if (!Array.isArray(cmd.arguments)) {
      cmd.arguments = [cmd.arguments];
    }
    logger.info('%s command: %s, arguments: %s', req.id, cmd.command, cmd.arguments);

    if (!isCommandAllowed(cmd.command)) {
      logger.info("%s It is not allowed to execute.", req.id);
      res.status(400).end(); //Bad Request
      return
    }

    const job = new CliJob();
    logger.info('%s new job id %s', req.id, job.id);

    // bind job to current req, let next handler could access job info
    req.job = job;

    ongoingJobs[job.id] = job;

    job.on('error', (e) => {
      res.status(500).end();
    });
    job.on('finish', () => {
      logger.info('%s remove job %s from ongoing job set', req.id, job.id);
      delete ongoingJobs[job.id];
    });

    try {
      await job.start(cmd.command, cmd.arguments);
    } catch(e) {
      logger.error('%s get an error on executing, %s, %s', req.id, JSON.stringify(e));
      res.status(500).end();
      return;
    }

    var location = {
      hostname: os.hostname(),
      port: config.listenPort
    };
    location = base64.urlencode(JSON.stringify(location));

    const referrer = url.parse(referrerUrl);
    var redirectUrl = referrer.pathname + '?id=' + job.id + '&l=' + location;
    logger.info('%s redirect to %s', req.id, redirectUrl);
    res.redirect(redirectUrl);

    next();
  }

  function parseRange(range_header) {
    if (range_header == null) {
      return {
        start: 0,
        end: null
      }
    }

    var index = range_header.indexOf('=');
    if (index == -1) {
      return {
        start: 0,
        end: null
      }
    }
    var arr = range_header.slice(index + 1).split(',');
    var firstItem = arr[0];
    var firstItemPair = firstItem.split('-');
    var start = parseInt(firstItemPair.length >= 1 ? firstItemPair[0] : null);
    var end = parseInt(firstItemPair.length >= 2 ? firstItemPair[1] : null);
    return {
      start: Number.isNaN(start) ? 0 : start,
      end: Number.isNaN(end) ? null : end
    }
  }

  async function tryFile(req, res, path, isOpen) {

    logger.info('%s try to get data from %s', req.id, path);
    if (!fs.existsSync(path)) {
      logger.info("%s %s does not exist", req.id, path);
      return false;
    }

    var { start, end } = parseRange(req.headers.range);
    logger.info('%s request range is %d - %d', req.id, start, end);
    const length = (await stat(path)).size;
    logger.info('%s size of %s is %d', req.id, path, length);
    end = Math.max(start, (end == null ? length-1 : Math.min(end, length-1)));

    if (start >= length) {
      if (isOpen) {
        logger.info("%s %s is open, let client wait", req.id, path);
        res.status(206).end(); //Partial Content
        return true;
      } else if (start == 0 && length == 0) {
        logger.info("%s %s is empty, let client finish", req.id, path);
        res.status(200).end();
        return true;
      } else {
        logger.info("%s %s range is not satisfiable", req.id, path);
        res.status(416).end(); //Range Not Satisfiable
        return true;
      }
    }

    if (isOpen || length > end + 1) {
      res.status(206); //Partial Content
    } else {
      res.status(200);
    }
    res.set('Content-Length', (length == 0) ? 0 : (end - start + 1));
    res.set('Content-Range', 'bytes ' + start + '-' + end + '/' + (isOpen ? '*' : length));
    fs.createReadStream(path, {start: start, end: end}).pipe(res);
    return true;
  }

  async function fileHandler(req, res, next) {

    logger.info('%s fileHandler', req.id);

    const jobId = req.params.id;
    const filename = req.params.filename;
    const job = ongoingJobs[jobId] || new CliJob(jobId);

    var path = null;

    // ongoing
    if (job.isRunning()) {
      path = job.getJobDir() + '/' + filename;
      if (!fs.existsSync(path)) {
        res.status(404).end(); //Not Found
        return;
      }
      if (await tryFile(req, res, path, true)) {
        return;
      }
    }

    // local
    if (fs.existsSync(job.getJobDir())) {
      path = job.getJobDir() + '/' + filename;
      if (!fs.existsSync(path)) {
        res.status(404).end(); //Not Found
        return;
      }
      if (await tryFile(req, res, path, false)) {
        return;
      }
    }

    !res.finished && next();
  }

  return {
    execHandler,
    fileHandler
  };

}
