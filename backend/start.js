const path = require('path');
const tsconfigPaths = require('tsconfig-paths');

tsconfigPaths.register({
  baseUrl: __dirname,
  paths: {
    '@/*': ['dist/*'],
  },
});

require('./dist/server.js');
