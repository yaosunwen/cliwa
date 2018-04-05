var cliwa = cliwa || {};
(function(cliwa, $, undefined) {

  const DEFAULT_INTERVAL = 5000;
  const DEFAULT_BASE_URL = '/cliwa';
  const DEFAULT_RANGE_SIZE = 1024 * 64;
  const DEFAULT_MAX_SIZE = 1024 * 1024;
  if (!('interval' in cliwa)) {
    cliwa['interval'] = DEFAULT_INTERVAL;
  }
  if (!('baseUrl' in cliwa)) {
    cliwa['baseUrl'] = DEFAULT_BASE_URL;
  }
  if (!('rangeSize' in cliwa)) {
    cliwa['rangeSize'] = DEFAULT_RANGE_SIZE;
  }
  if (!('maxSize' in cliwa)) {
    cliwa['maxSize'] = DEFAULT_MAX_SIZE;
  }

  function parseContentRange(contentRange) {
    var range = {};
    if (contentRange === null || contentRange === undefined) {
      return null;
    }
    var index = contentRange.indexOf(' ');
    if (index === -1) {
      return null;
    }
    range.unit = contentRange.slice(0, index);
    contentRange = contentRange.slice(index + 1);
    index = contentRange.indexOf('/');
    if (index === -1) {
      return null;
    }
    range.size = contentRange.slice(index + 1);
    if (range.size == "*") {
      range.size = null;
    } else {
      range.size = parseInt(range.size);
    }
    contentRange = contentRange.slice(0, index);
    index = contentRange.indexOf('-');
    if (index === -1) {
      return null;
    }
    range.start = parseInt(contentRange.slice(0, index));
    range.end = parseInt(contentRange.slice(index + 1));
    return range;
  }

  function AjaxPoller(url, position) {
    this.url = url;
    this.interval = cliwa.interval;
    this.position = (position === undefined ? null : position);
  }
  AjaxPoller.prototype = Object.create(Object.prototype);
  AjaxPoller.prototype.constructor = AjaxPoller;
  AjaxPoller.prototype.on = function(evt, ...callbacks) {
    if (evt == 'data') {
      this.dataCallbacks = this.dataCallbacks || [];
      callbacks.forEach(cb => this.dataCallbacks.push(cb));
    } else if (evt == 'start') {
      this.startCallbacks = this.startCallbacks || [];
      callbacks.forEach(cb => this.startCallbacks.push(cb));
    } else if (evt == 'done') {
      this.doneCallbacks = this.doneCallbacks || [];
      callbacks.forEach(cb => this.doneCallbacks.push(cb));
    }
  }
  AjaxPoller.prototype.trigger = function(evt) {
    var poller = this;
    var callbacks = [];
    if (evt == 'data') {
      callbacks = this.dataCallbacks;
    } else if (evt == 'start') {
      if (!this.startCallbacks.triggerred) {
        callbacks = this.startCallbacks;
        this.startCallbacks.triggerred = true;
      }
    } else if (evt == 'done') {
      if (!this.doneCallbacks.triggerred) {
        callbacks = this.doneCallbacks;
        this.doneCallbacks.triggerred = true;
      }
    }
    var args = Array.prototype.slice.call(arguments, 1);
    callbacks.forEach(cb => cb.apply(poller, args));
  }
  AjaxPoller.prototype.start = function() {
    this.trigger('start');
    this.run();
  }
  AjaxPoller.prototype.run = function() {
    var poller = this;
    var logPrefix = poller.url;
    console.log(logPrefix + " start polling" + (poller.position != null ? " from " + poller.position : ""));
    var headers = {};
    if (poller.position != null) {
      headers["Range"] = "bytes=" + poller.position + "-" + (poller.position + cliwa.rangeSize - 1);
    }
    $.ajax({
      url: poller.url,
      headers: headers,
      success: function(data, textStatus, jqXHR) {
        var contentLength = parseInt(jqXHR.getResponseHeader('Content-Length'));
        console.log(logPrefix + ' success, length: ' + contentLength +  ', data: ' + (typeof data === 'string' ? data : JSON.stringify(data)));
        if (contentLength > 0) {
          poller.trigger('data', data);
        }
      },
      complete: function(jqXHR, textStatus) {
        console.log(logPrefix + ' complete, status: ' + jqXHR.status);

        var contentRange = parseContentRange(jqXHR.getResponseHeader('Content-Range'));
        if (contentRange != null && contentRange.end + 1 == contentRange.size) {
          poller.trigger('done', jqXHR.status);
          return;
        }

        var contentLength = parseInt(jqXHR.getResponseHeader('Content-Length') || '0');
        console.log(logPrefix + ' content length: ' + contentLength);
        if (jqXHR.status == 206) {
          if (poller.position == null) {
            if (contentLength > 0) {
              poller.trigger('done', jqXHR.status);
              return;
            }
          } else {
            poller.position += contentLength;
            if (poller.position >= cliwa.maxSize) {
              poller.trigger('done', jqXHR.status);
              return;
            }
          }
          setTimeout(poller.run.bind(poller), contentLength > 0 ? 0 : poller.interval);
          return;
        }

        var retryCodes = [408, 500, 503, 504];
        for (var i = 0; i < retryCodes.length; i++) {
          if (jqXHR.status == retryCodes[i]) {
            setTimeout(poller.run.bind(poller), poller.interval);
            return;
          }
        }

        poller.trigger('done', jqXHR.status);
        return;
      }
    });
  }

  function StdoutPoller(job) {
    var url = cliwa.baseUrl + "/cli/" + job.id + "/stdout?l=" + job.loc;
    AjaxPoller.call(this, url, 0);
  }
  StdoutPoller.prototype = Object.create(AjaxPoller.prototype);
  StdoutPoller.prototype.constructor = StdoutPoller;

  function StderrPoller(job) {
    var url = cliwa.baseUrl + "/cli/" + job.id + "/stderr?l=" + job.loc;
    AjaxPoller.call(this, url, 0);
  }
  StderrPoller.prototype = Object.create(AjaxPoller.prototype);
  StderrPoller.prototype.constructor = StderrPoller;

  function CmdPoller(job) {
    var url = cliwa.baseUrl + "/cli/" + job.id + "/cmd?l=" + job.loc;
    AjaxPoller.call(this, url);
  }
  CmdPoller.prototype = Object.create(AjaxPoller.prototype);
  CmdPoller.prototype.constructor = CmdPoller;

  function ResultPoller(job) {
    var url = cliwa.baseUrl + "/cli/" + job.id + "/result?l=" + job.loc;
    AjaxPoller.call(this, url);
  }
  ResultPoller.prototype = Object.create(AjaxPoller.prototype);
  ResultPoller.prototype.constructor = ResultPoller;

  cliwa.CmdPoller = CmdPoller;
  cliwa.ResultPoller = ResultPoller;
  cliwa.StdoutPoller = StdoutPoller;
  cliwa.StderrPoller = StderrPoller;

  cliwa.config = function(options) {
    for (var i in options) {
      this[i] = options[i];
    }
  }
})(cliwa, jQuery);
