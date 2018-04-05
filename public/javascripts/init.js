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
    if (!('loadingSelector' in _options)) {
      _options['loadingSelector'] = '#loading';
    }
    cliwa.config(_options);

    var job = cliwa.getJob();
    if (job == null) {
      return;
    }

    var loadingUpdater = new cliwa.LoadingUpdater(_options['loadingSelector']);

    var cmdPoller = new cliwa.CmdPoller(job);
    var cmdUpdater = new cliwa.CmdUpdater(_options['cmdSelector']);
    cmdPoller.on('data', cmdUpdater.onData.bind(cmdUpdater));
    cmdPoller.on('start', cmdUpdater.onStart.bind(cmdUpdater), loadingUpdater.onStart.bind(loadingUpdater));
    cmdPoller.on('done', cmdUpdater.onDone.bind(cmdUpdater), loadingUpdater.onDone.bind(loadingUpdater));
    cmdPoller.start();

    var resultPoller = new cliwa.ResultPoller(job);
    var resultUpdater = new cliwa.ResultUpdater(_options['resultSelector']);
    resultPoller.on('data', resultUpdater.onData.bind(resultUpdater));
    resultPoller.on('start', resultUpdater.onStart.bind(resultUpdater), loadingUpdater.onStart.bind(loadingUpdater));
    resultPoller.on('done', resultUpdater.onDone.bind(resultUpdater), loadingUpdater.onDone.bind(loadingUpdater));
    resultPoller.start();

    var stdoutPoller = new cliwa.StdoutPoller(job);
    var stdoutUpdater = new cliwa.StdoutUpdater(_options['stdoutSelector']);
    stdoutPoller.on('data', stdoutUpdater.onData.bind(stdoutUpdater));
    stdoutPoller.on('start', stdoutUpdater.onStart.bind(stdoutUpdater), loadingUpdater.onStart.bind(loadingUpdater));
    stdoutPoller.on('done', stdoutUpdater.onDone.bind(stdoutUpdater), loadingUpdater.onDone.bind(loadingUpdater));
    stdoutPoller.start();

    var stderrPoller = new cliwa.StderrPoller(job);
    var stderrUpdater = new cliwa.StderrUpdater(_options['stderrSelector']);
    stderrPoller.on('data', stderrUpdater.onData.bind(stderrUpdater));
    stderrPoller.on('start', stderrUpdater.onStart.bind(stderrUpdater), loadingUpdater.onStart.bind(loadingUpdater));
    stderrPoller.on('done', stderrUpdater.onDone.bind(stderrUpdater), loadingUpdater.onDone.bind(loadingUpdater));
    stderrPoller.start();
  }
})(cliwa, jQuery);
