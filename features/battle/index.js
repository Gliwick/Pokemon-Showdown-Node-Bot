/*
	Battle Feature
*/

exports.id = 'battle';
exports.desc = 'Automated battle bot';

const BATTLE_BOT = exports.BATTLE_BOT = require('./battle-ai/index').BATTLE_BOT;

const TEAM_BUILDER = exports.TEAM_BUILDER = require('./teambuilder').TEAM_BUILDER;

const CHALLENGE_MANAGER = exports.CHALLENGE_MANAGER = require('./challenges').CHALLENGE_MANAGER;

const TOUR_MANAGER = exports.TOUR_MANAGER = require('./tournaments').TOUR_MANAGER;

const LADDER_MANAGER = exports.LADDER_MANAGER = require('./ladder').LADDER_MANAGER;

exports.init = function () {
	BATTLE_BOT.init();
	TOUR_MANAGER.clearData();
	TEAM_BUILDER.loadTeamList();
};

exports.parse = function (room, message, isIntro, spl) {
	switch (spl[0]) {
		case 'tournament':
			TourManager.parse(room, message, isIntro, spl);
			break;
		case 'rated':
			LADDER_MANAGER.reportBattle(room);
			break;
		default:
			if (spl.length > 3 && spl[3].startsWith('/challenge')) {
				CHALLENGE_MANAGER.parse(room, message, isIntro, spl);
			}
	}

	if (!Bot.rooms[room]) {
		if (spl[0] !== 'init' || spl[1] !== 'battle') return;
	} else if (Bot.rooms[room].type !== "battle") return;

	try {
		BATTLE_BOT.receive(room, message, isIntro);
	} catch (e) {
		errlog(e.stack);
		error("BATTLE_BOT crash");
	}
};

exports.getInitCmds = function () {
	return BATTLE_BOT.tryJoinAbandonedBattles();
};

exports.readyToDie = function () {
	var battles = Object.keys(BATTLE_BOT.battles);
	if (battles.length) return ("There are " + battles.length + " battles in progress");
};

exports.destroy = function () {
	LADDER_MANAGER.destroy();
	BATTLE_BOT.destroy();
	if (Features[exports.id]) delete Features[exports.id];
};
