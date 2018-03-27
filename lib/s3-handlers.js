'use strict'

const util = require('util');
const fs = require('fs');
const AWS = require('aws-sdk');

module.exports = function(config, logger) {

  const s3 = new AWS.S3({
    region: config.s3Region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });

  const s3upload = util.promisify(s3.upload).bind(s3);

  function getJobS3Prefix(jobId) {
    return config.s3Prefix + '/' + jobId;
  }

  function getJobCmdS3Key(jobId) {
    return getJobS3Prefix(jobId) + '/cmd';
  }

  function getJobStdoutS3Key(jobId) {
    return getJobS3Prefix(jobId) + '/stdout';
  }

  function getJobStderrS3Key(jobId) {
    return getJobS3Prefix(jobId) + '/stderr';
  }

  function getJobResultS3Key(jobId) {
    return getJobS3Prefix(jobId) + '/result';
  }

  async function uploadToS3(path, s3bucket, s3key) {
    const stream = fs.createReadStream(path);
    var params = {
      Bucket: s3bucket,
      Key: s3key,
      Body: stream
    };
    var options = {
      partSize: 10 * 1024 * 1024,
      queueSize: 1
    };
    logger.info('uploading %s to s3://%s/%s', path, s3bucket, s3key);
    var data = await s3upload(params, options);
    logger.info('uploaded %s to s3://%s/%s', path, s3bucket, s3key);
    return data;
  }

  function parseRange(rangeHeader) {
    var index = rangeHeader.indexOf('=');
    if (index == -1) {
      return {
        start: 0,
        end: null
      }
    }
    var items = rangeHeader.slice(index + 1).split(',');
    var firstItem = items[0];
    var firstItemPair = firstItem.split('-');
    var start = parseInt(firstItemPair.length >= 1 ? firstItemPair[0] : null);
    var end = parseInt(firstItemPair.length >= 2 ? firstItemPair[1] : null);
    return {
      start: Number.isNaN(start) ? 0 : start,
      end: Number.isNaN(end) ? null : end
    }
  }

  function buildS3Params(req) {
    const id = req.params.id;
    const filename = req.params.filename;
    const s3bucket = config.s3Bucket;
    const s3key = config.s3Prefix + '/' + id + '/' + filename;
    const params = {
      Bucket: s3bucket,
      Key: s3key,
    };
    if (req.headers.range != null) {
      var { start, end } = parseRange(req.headers.range);
      params.Range = 'bytes=' + (start == null ? 0 : start) + '-' + (end == null ? '' : end);
    }
    return params
  }

  //http://localhost:8888/cli/20180321102244627738/stderr

  async function downloadFromS3Async(req, res, callback) {
    logger.info('%s try to get data from s3', req.id);

    const params = buildS3Params(req);
    logger.info('%s s3 params: %s', req.id, JSON.stringify(params));

    var needEnd = true;
    var finalizeCalled = false;

    var finalize = function() {
      if (finalizeCalled) {
        return;
      }
      finalizeCalled = true;
      logger.info('%s s3 finalized %s', req.id, needEnd);
      if (needEnd) {
        res.end();
      }
      callback(null, needEnd);
    }

    var triggerFinalize = function() {
      setTimeout(finalize, 0);
    }

    s3.getObject(params)
      .on('httpHeaders', function(statusCode, headers, response) {
        logger.info('%s received s3 headers: %d, %s', req.id, statusCode, JSON.stringify(headers));
        if (statusCode == 404) {
          needEnd = false;
          triggerFinalize();
          return;
        }

        res.status(statusCode);
        const names = ['Content-Type', 'Content-Length', 'Content-Range'];
        for (var name in headers) {
          for (var i=0; i<names.length; i++) {
            if (name.toLowerCase() == names[i].toLowerCase()) {
              res.set(names[i], headers[name]);
              break;
            }
          }
        }

        response.httpResponse.createUnbufferedStream()
          .on('error', function(e) {
            // handle errors on read stream
            logger.error('%s errors on s3 read stream, %s', req.id, JSON.stringify(e));
            triggerFinalize();
          })
          .pipe(res)
          .on('error', function(e) {
            //handle errors on write stream
            logger.error('%s errors on s3 write stream, %s', req.id, JSON.stringify(e));
            triggerFinalize();
          })
          .on('finish', function() {
            logger.info('%s s3 write stream is end', req.id);
            triggerFinalize();
          })
        logger.info('%s s3 pipe is created', req.id);
      })
      .on('error', function(err) {
        logger.info('%s error on requesting s3, %s', req.id, JSON.stringify(err));
        if (!res.headersSent) {
          needEnd = false;
        }
        triggerFinalize();
      })
      .send();
  }

  const downloadFromS3 = util.promisify(downloadFromS3Async);

  async function downloadHandler(req, res, next) {
    logger.info('%s downloadHandler', req.id);
    await downloadFromS3(req, res);
    !res.finished && next();
  }

  async function uploadHandler(req, res, next) {
    logger.info('%s uploadHandler', req.id);
    const job = req.job;
    if (job == null) {
      next();
      return;
    }

    job.on('success', async () => {
      try {
        await Promise.all([
          uploadToS3(job.getCmdPath(), config.s3Bucket, getJobCmdS3Key(job.id)),
          uploadToS3(job.getResultPath(), config.s3Bucket, getJobResultS3Key(job.id)),
          uploadToS3(job.getStdoutPath(), config.s3Bucket, getJobStdoutS3Key(job.id)),
          uploadToS3(job.getStderrPath(), config.s3Bucket, getJobStderrS3Key(job.id)),
        ]);
      } catch(e) {
        logger.error('%s Failed to upload files to s3, %s', req.id, JSON.stringify(e));
      }
    });

    next();
  }

  return {
    uploadHandler,
    downloadHandler
  };

}
