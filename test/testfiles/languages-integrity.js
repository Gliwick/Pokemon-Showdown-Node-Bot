const COMMAND_PATH = './commands';

var assert = require('assert');

describe('Languages', function () {
	it('Should be loaded without errors', function () {
		var translations = {};
		fs.readdirSync('./languages').forEach(function (lang) {
			if (fs.lstatSync('./languages/' + lang).isDirectory()) {
				translations[lang] = Tools.intl.loadLang(lang, false);
			}
		});
	});
	it('Should exist a default language', function () {
		Tools.intl.loadTranslations();
		assert.notStrictEqual(Tools.intl.translations['english'], undefined);
	});
});
