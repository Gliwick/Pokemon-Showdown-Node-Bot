/*
	Battle Feature
*/

import { Feature } from '../index';
import { BattleBot } from './battle-ai';
import { ChallengeManager } from './challenges';
import { LadderManager } from './ladder';
import { TeamBuilder } from './teambuilder';
import { TourManager } from './tournaments';

const battleBot = new BattleBot();

const teamBuilder = new TeamBuilder();

const challengeManager = new ChallengeManager();

const tourManager = new TourManager();

const ladderManager = new LadderManager();

export class BattleManager implements Feature {
	id = 'battle';
	desc = 'Automated battle bot';

	constructor() { };

	init() {
		battleBot.init();
		tourManager.clearData();
		teamBuilder.loadTeamList();
	};

	parse(room, message, isIntro, spl) {
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

	getInitCmds() {
		return battleBot.tryJoinAbandonedBattles();
	};

	readyToDie() {
		var battles = Object.keys(battleBot.battles);
		if (battles.length) return ("There are " + battles.length + " battles in progress");
	};

	destroy() {
		ladderManager.destroy();
		battleBot.destroy();
		if (Features[id]) delete Features[id];
	};
};