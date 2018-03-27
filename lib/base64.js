'use strict'

function urlencode(s) {
  s = Buffer.from(s).toString('base64');
  s = s.replace(/\+/g, '-');
  s = s.replace(/\//g, '_');
  s = s.replace(/=/g, '');
  return s;
}

function urldecode(s) {
  s = s.replace(/-/g, '+');
  s = s.replace(/_/g, '/');
  s = Buffer.from(s, 'base64').toString();
  return s;
}

module.exports = {
  urlencode,
  urldecode
}
