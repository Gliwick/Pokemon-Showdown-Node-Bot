const COMMAND_PATH = './commands';

var assert = require('assert');

describe('Languages', function () {
	it('Should be loaded without errors', function () {
		var translations = {};
		fs.readdirSync('./languages').forEach((lang) => {
			if (fs.lstatSync('./languages/' + lang).isDirectory()) {
				translations[lang] = Languages.loadLang(lang, false);
			}
		});
	});
	it('Should exist a default language', function () {
		Languages.loadTranslations();
		assert.notStrictEqual(Languages.translations['english'], undefined);
	});
});
