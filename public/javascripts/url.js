var cliwa = cliwa || {};
(function (cliwa) {
  cliwa.createURL = function createURL(href) {
    var a = document.createElement("a");
    a.href = href;
    a.getQueryParam = function(name) {
      var r = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
      var query = this.search.substr(1);
      var match = query.match(r);
      if (match !== null) {
        return unescape(match[2]);
      }
      return null;
    };
    return a;
  }

  cliwa.getJob = function() {
    var url = cliwa.createURL($(location).attr('href'));
    var id = url.getQueryParam('id');
    var loc = url.getQueryParam('l');
    if (id == null) {
      return null;
    }
    return {
      id: id,
      loc: loc
    }
  }
})(cliwa);
