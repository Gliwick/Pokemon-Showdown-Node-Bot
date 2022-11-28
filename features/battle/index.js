/*
	Battle Feature
*/

exports.id = 'battle';
exports.desc = 'Automated battle bot';

const BattleBot = exports.BattleBot = require('./battle-ai/index').BattleBot;
const battleBot = exports.battleBot = require('./battle-ai/index').battleBot;

const teamBuilder = exports.teamBuilder = require('./teambuilder').teamBuilder;

const challengeManager = exports.challengeManager = require('./challenges').challengeManager;

const tourManager = exports.tourManager = require('./tournaments').tourManager;

const ladderManager = exports.ladderManager = require('./ladder').ladderManager;

exports.init = function () {
	battleBot.init();
	tourManager.clearData();
	teamBuilder.loadTeamList();
};

exports.parse = function (room, message, isIntro, spl) {
	switch (spl[0]) {
		case 'tournament':
			TourManager.parse(room, message, isIntro, spl);
			break;
		case 'rated':
			ladderManager.reportBattle(room);
			break;
		default:
			if (spl.length > 3 && spl[3].startsWith('/challenge')) {
				challengeManager.parse(room, message, isIntro, spl);
			}
	}

	if (!Bot.rooms[room]) {
		if (spl[0] !== 'init' || spl[1] !== 'battle') return;
	} else if (Bot.rooms[room].type !== "battle") return;

	try {
		battleBot.receive(room, message, isIntro);
	} catch (e) {
		errlog(e.stack);
		error("battleBot crash");
	}
};

exports.getInitCmds = function () {
	return battleBot.tryJoinAbandonedBattles();
};

exports.readyToDie = function () {
	var battles = Object.keys(battleBot.battles);
	if (battles.length) return ("There are " + battles.length + " battles in progress");
};

exports.destroy = function () {
	ladderManager.destroy();
	battleBot.destroy();
	if (Features[exports.id]) delete Features[exports.id];
};
