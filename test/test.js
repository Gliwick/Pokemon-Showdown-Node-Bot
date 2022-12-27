/*
 * Test index file
 */

global.AppOptions = { config: './config-example.js', data: './test-data/', testmode: true };

require('./../index.ts');

for (let key in Config.debug) Config.debug[key] = false;

global.fs = require('fs');

const testFiles = fs.readdirSync('./test/testfiles');
testFiles.forEach((testFile) => {
	if (testFile.substr(-3) === '.js') require('./testfiles/' + testFile);
});
