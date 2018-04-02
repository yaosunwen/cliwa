var cliwa = cliwa || {};
(function(cliwa, $, undefined) {

  cliwa.init = function(options) {
    var _options = options || {};
    if (!('cmdSelector' in _options)) {
      _options['cmdSelector'] = '#cmd';
    }
    if (!('resultSelector' in _options)) {
      _options['resultSelector'] = '#result';
    }
    if (!('stdoutSelector' in _options)) {
      _options['stdoutSelector'] = '#stdout';
    }
    if (!('stderrSelector' in _options)) {
      _options['stderrSelector'] = '#stderr';
    }
    cliwa.config(_options);

    var job = cliwa.getJob();
    if (job == null) {
      return;
    }

    var cmdPoller = new cliwa.CmdPoller(job);
    var cmdUpdater = new cliwa.CmdUpdater(_options['cmdSelector']);
    cmdPoller.on('data', cmdUpdater.onData.bind(cmdUpdater));
    cmdPoller.on('start', cmdUpdater.onStart.bind(cmdUpdater));
    cmdPoller.on('done', cmdUpdater.onDone.bind(cmdUpdater));
    cmdPoller.start();

    var resultPoller = new cliwa.ResultPoller(job);
    var resultUpdater = new cliwa.ResultUpdater(_options['resultSelector']);
    resultPoller.on('data', resultUpdater.onData.bind(resultUpdater));
    resultPoller.on('start', resultUpdater.onStart.bind(resultUpdater));
    resultPoller.on('done', resultUpdater.onDone.bind(resultUpdater));
    resultPoller.start();

    var stdoutPoller = new cliwa.StdoutPoller(job);
    var stdoutUpdater = new cliwa.StdoutUpdater(_options['stdoutSelector']);
    stdoutPoller.on('data', stdoutUpdater.onData.bind(stdoutUpdater));
    stdoutPoller.on('start', stdoutUpdater.onStart.bind(stdoutUpdater));
    stdoutPoller.on('done', stdoutUpdater.onDone.bind(stdoutUpdater));
    stdoutPoller.start();

    var stderrPoller = new cliwa.StderrPoller(job);
    var stderrUpdater = new cliwa.StderrUpdater(_options['stderrSelector']);
    stderrPoller.on('data', stderrUpdater.onData.bind(stderrUpdater));
    stderrPoller.on('start', stderrUpdater.onStart.bind(stderrUpdater));
    stderrPoller.on('done', stderrUpdater.onDone.bind(stderrUpdater));
    stderrPoller.start();
  }
})(cliwa, jQuery);
