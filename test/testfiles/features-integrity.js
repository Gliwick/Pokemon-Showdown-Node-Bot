const FEATURES_PATH = './features';

let assert = require('assert');

Bot.status = { connected: true, named: true, nickName: 'Bot' };

let nullfunction = function () {};

Bot.send = nullfunction;

Bot.rooms = {
	lobby: {
		type: 'chat',
		title: 'Lobby',
		users: { admin: '&Admin', regularuser: ' Regular User', bot: '*Bot' },
		userCount: 2
	}
};

const separatedFeatures = {};

describe('Features', function () {
	it('Should not crash on load', function () {
		let featureList = fs.readdirSync(FEATURES_PATH);
		featureList.forEach((feature) => {
			const path = FEATURES_PATH + '/' + feature + '/index.ts';
			if (fs.existsSync(path)) separatedFeatures[feature] = new (require('../../' + path).feature)();
		});
	});
	it('Should have an unique id', function () {
		for (let i in separatedFeatures) {
			assert.strictEqual(typeof separatedFeatures[i].id, 'string', `feature "${i}" does not have an id`);
			assert.strictEqual(Features.features[separatedFeatures[i].id], undefined, `feature "${i}" has a repeated id`);
			Features[separatedFeatures[i].id] = separatedFeatures[i];
		}
	});
	it('Should not crash on init', function () {
		for (let feature in Features.features) {
			if (typeof Features.features[feature].init === 'function') {
				Features.features[feature].init();
			}
		}
	});
	it('Should be destroyed properly', function () {
		for (let feature in Features.features) {
			if (typeof Features.features[feature].destroy === 'function') {
				Features.features[feature].destroy();
			} else {
				delete Features.features[feature];
			}
			assert.strictEqual(Features.features[feature], undefined, `feature "${feature}" does not have a proper destroy method`);
		}
	});
});
