var cliwa = cliwa || {};
(function(cliwa, $, undefined) {

  // $("<style type='text/css'> .redbold{ color:#f00; font-weight:bold;} </style>").appendTo("head");
  // $('head').append('<style>.loading:after{}</style>');

  function Updater(selector) {
    this.selector = selector;
  }
  Updater.prototype = Object.create(Object.prototype);
  Updater.prototype.constructor = Updater;
  Updater.prototype.createCSS = function () {
    if ($('#__loading__css__').length > 0) {
      return;
    }
    $('head').append('<style id="__loading__css__">.loading:after{content:url(' + cliwa.baseUrl + '/images/loading.gif);}</style>');
  }
  Updater.prototype.toggleLoadState = function() {
    this.createCSS();
    var container = $(this.selector);
    container.toggleClass('loading');
  }
  Updater.prototype.showLoadingState = function() {
    this.createCSS();
    var container = $(this.selector);
    container.addClass('loading');
  }
  Updater.prototype.hideLoadingState = function() {
    this.createCSS();
    var container = $(this.selector);
    container.removeClass('loading');
  }
  Updater.prototype.onStart = function() {
    var container = $(this.selector);
    container.append('<table class="terminal"></table>');
  }
  Updater.prototype.onDone = function(data) {}
  Updater.prototype.onData = function(data) {}

  function CmdUpdater(selector) {
    Updater.call(this, selector);
  }
  CmdUpdater.prototype = Object.create(Updater.prototype);
  CmdUpdater.prototype.constructor = CmdUpdater;
  CmdUpdater.prototype.onStart = function() {}
  CmdUpdater.prototype.onDone = function() {}
  CmdUpdater.prototype.onData = function(data) {
    data = JSON.parse(data);
    var container = $(this.selector);
    container.find('input[name=command]').val(data.command);
    for (var i in data.arguments) {
      container.find('input[name=arguments]').eq(i).val(data.arguments[i]);
    }
  }

  function ResultUpdater(selector) {
    Updater.call(this, selector);
  }
  ResultUpdater.prototype = Object.create(Updater.prototype);
  ResultUpdater.prototype.constructor = ResultUpdater;
  ResultUpdater.prototype.onStart = function() {
    Object.getPrototypeOf(ResultUpdater.prototype).onStart.call(this);
    this.showLoadingState();
  }
  ResultUpdater.prototype.onDone = function() {
    Object.getPrototypeOf(ResultUpdater.prototype).onDone.call(this);
    this.hideLoadingState();
  }
  ResultUpdater.prototype.onData = function(data) {
    console.log('result updater received ' + data);
    data = JSON.parse(data);
    var container = $(this.selector);
    if (data.code == 0) {
      container.find('table').append('<tr><td class="line alert alert-success">Success</td></tr>');
    } else {
      container.find('table').append('<tr><td class="line alert alert-danger">Failure with ' + data.code + '</td></tr>');
    }
  }

  function StdoutUpdater(selector) {
    Updater.call(this, selector);
    this.lastLine = null;
  }
  StdoutUpdater.prototype = Object.create(Updater.prototype);
  StdoutUpdater.prototype.constructor = StdoutUpdater;
  StdoutUpdater.prototype.onData = function(data) {
    var container = $(this.selector);
    var startIndex = 0;
    while (startIndex < data.length) {
      var endIndex = data.indexOf('\n', startIndex);
      if (endIndex == -1) {
        if (this.lastLine == null) {
          this.lastLine = data.slice(startIndex);
        } else {
          this.lastLine += data.slice(startIndex);
        }
        break;
      }
      var line = data.slice(startIndex, endIndex);
      startIndex = endIndex + 1;

      if (this.lastLine !== null) {
        line = this.lastLine + line;
        this.lastLine = null;
      }

      container.find('table').append('<tr><td class="line">' + line + '</td></tr>');
    }
  }
  StdoutUpdater.prototype.onDone = function() {
    Object.getPrototypeOf(StdoutUpdater.prototype).onDone.call(this);
    if (this.lastLine !== null) {
      var container = $(this.selector);
      container.find('table').append('<tr><td class="line">' + this.lastLine + '</td></tr>');
      this.lastLine = null;
    }
  }

  function StderrUpdater(selector) {
    StdoutUpdater.call(this, selector);
  }
  StderrUpdater.prototype = Object.create(StdoutUpdater.prototype);
  StderrUpdater.prototype.constructor = StderrUpdater;

  cliwa.CmdUpdater = CmdUpdater;
  cliwa.ResultUpdater = ResultUpdater;
  cliwa.StdoutUpdater = StdoutUpdater;
  cliwa.StderrUpdater = StderrUpdater;
})(cliwa, jQuery);
