require('should');
const base64 = require('../lib/base64');

describe('base64', function() {

  const base64string = '77+/ae+/vQ==';
  const rawstring = Buffer.from(base64string, 'base64').toString();
  const base64urlstring = '77-_ae-_vQ';

  describe('#urlencode', function() {
    it('should not contain +', function(){
      base64.urlencode(rawstring).should.not.containEql('+');
    });

    it('should not contain /', function(){
      base64.urlencode(rawstring).should.not.containEql('/');
    });

    it('should not contain =', function(){
      base64.urlencode(rawstring).should.not.containEql('=');
    });

    it('should encode exactly', function(){
      base64.urlencode(rawstring).should.equal(base64urlstring);
    })
  });

  describe('#urldecode', function() {
    it('should decode exactly', function(){
      base64.urldecode(base64urlstring).should.equal(rawstring);
    });
  });
});
