'use strict'

const http = require("http");
const os = require("os");
const base64 = require('./base64');

module.exports = function(config, logger) {

  async function forwardHandler(req, res, next) {

    logger.info('%s forwardHandler', req.id);

    if (res.finished) {
      logger.info('%s client connection is closed, no need to forward', req.id);
      return;
    }

    if (req.query.l == null) {
      logger.info('%s unable to forward because no location info', req.id);
      next();
      return;
    }

    var location = base64.urldecode(req.query.l);
    logger.info('%s forward request to %s', req.id, location);
    location = JSON.parse(location);
    if (location.hostname == os.hostname() &&
      location.port == config.listenPort) {
      logger.info('%s recursive is detected', req.id);
      next();
      return;
    }

    http.request({
      hostname: location.hostname,
      port: location.port,
      method: req.method,
      headers: req.headers,
      path: req.url
    }, function(response) {

      var headers = response.headers;
      if (response.statusCode == 404) {
        next();
        return;
      }

      res.status(response.statusCode);
      const names = ['Content-Type', 'Content-Length', 'Content-Range'];
      for (var name in headers) {
        for (var i=0; i<names.length; i++) {
          if (name.toLowerCase() == names[i].toLowerCase()) {
            res.set(names[i], headers[name]);
            break;
          }
        }
      }

      response
        .on('error', function(err) {
        // handle errors on read stream
          logger.error('%s errors on read stream of forward, %s', req.id, JSON.stringify(err));
          res.end();
        })
        .pipe(res)
        .on('error', function(err) {
        //handle errors on write stream
          logger.error('%s errors on write stream of forward, %s', req.id, JSON.stringify(err));
          res.end();
        })
        .on('finish', function() {
          logger.info('%s end of forward', req.id);
          res.end();
        })
    })
      .on('error', function(err) {
        logger.info('%s error on forward, %s', req.id, JSON.stringify(err));
        if (!res.headersSent) {
          next();
          return;
        }
      })
      .end();
  }

  return {
    forwardHandler
  };

}
