'use strict'

const morgan = require('morgan');

module.exports = function(config, logger) {

  const streamLogger = {
    write: function(message, encoding){
      logger.info(message);
    }
  };

  const reqLogHandler = morgan(function(tokens, req, res) {
    return [
      // tokens.date(req, res, 'iso'),
      req.id,
      tokens.method(req, res),
      tokens.url(req, res),
      tokens.referrer(req, res) || '-',
      tokens.req(req, res, 'content-type') || '-',
      tokens.req(req, res, 'range') || '-'
    ].join(' ')
  }, {immediate: true, stream: streamLogger});

  const resLogHandler = morgan(function (tokens, req, res) {
    return [
      // tokens.date(req, res, 'iso'),
      req.id,
      tokens.status(req, res),
      tokens.url(req, res),
      tokens.req(req, res, 'content-type') || '-',
      tokens.res(req, res, 'content-length') || '0',
      tokens['response-time'](req, res), 'ms'
    ].join(' ')
  }, {immediate: false, stream: streamLogger});

  return {
    reqLogHandler,
    resLogHandler
  };

}
