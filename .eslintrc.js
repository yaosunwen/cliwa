module.exports = {
  "extends": ["standard", "eslint:recommended"],

  "globals": {
    /* MOCHA */
    "describe"   : false,
    "it"         : false,
    "before"     : false,
    "beforeEach" : false,
    "after"      : false,
    "afterEach"  : false
  },

  "rules": {
    "indent": ["error", 2]
  }
};
