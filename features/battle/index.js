/*
	Battle Feature
*/

export const id = 'battle';
export const desc = 'Automated battle bot';

import { BATTLE_BOT } from './battle-ai/index';

import { TEAM_BUILDER } from './teambuilder';

import { CHALLENGE_MANAGER } from './challenges';

import { TOUR_MANAGER } from './tournaments';

import { LADDER_MANAGER } from './ladder';

export function init() {
	BATTLE_BOT.init();
	TOUR_MANAGER.clearData();
	TEAM_BUILDER.loadTeamList();
};

export function parse(room, message, isIntro, spl) {
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

export function getInitCmds() {
	return BATTLE_BOT.tryJoinAbandonedBattles();
};

export function readyToDie() {
	var battles = Object.keys(BATTLE_BOT.battles);
	if (battles.length) return ("There are " + battles.length + " battles in progress");
};

export function destroy() {
	LADDER_MANAGER.destroy();
	BATTLE_BOT.destroy();
	if (Features[exports.id]) delete Features[exports.id];
};
