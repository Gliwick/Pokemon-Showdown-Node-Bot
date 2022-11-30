/*
	Battle Feature
*/

import { Feature } from '../index';
import { BattleBot } from './battle-ai';
import { ChallengeManager } from './challenges';
import { LadderManager } from './ladder';
import { TeamBuilder } from './teambuilder';
import { TourManager } from './tournaments';

export class BattleManager implements Feature {
	id = 'battle';
	desc = 'Automated battle bot';

	battleBot: BattleBot;
	teamBuilder: TeamBuilder;
	challengeManager: ChallengeManager;
	tourManager: TourManager;
	ladderManager: LadderManager;

	constructor() {
		this.battleBot = new BattleBot();
		this.teamBuilder = new TeamBuilder();
		this.challengeManager = new ChallengeManager();
		this.tourManager = new TourManager(this.teamBuilder);
		this.ladderManager = new LadderManager();
	};

	init() {
		this.battleBot.init();
		this.tourManager.clearData();
		this.teamBuilder.loadTeamList();
	};

	parse(room: string, message: string, isIntro: boolean, spl: string) {
		switch (spl[0]) {
			case 'tournament':
				this.tourManager.parse(room, message, isIntro, spl);
				break;
			case 'rated':
				this.ladderManager.reportBattle(room);
				break;
			default:
				if (spl.length > 3 && spl[3].startsWith('/challenge')) {
					this.challengeManager.parse(room, message, isIntro, spl);
				}
		}

		if (!Bot.rooms[room]) {
			if (spl[0] !== 'init' || spl[1] !== 'battle') return;
		} else if (Bot.rooms[room].type !== "battle") return;

		try {
			this.battleBot.receive(room, message, isIntro);
		} catch (e) {
			errlog(e.stack);
			error("battleBot crash");
		}
	};

	getInitCmds() {
		return this.battleBot.tryJoinAbandonedBattles();
	};

	readyToDie() {
		const battles = Object.keys(this.battleBot.battles);
		if (battles.length) return ("There are " + battles.length + " battles in progress");
	};

	destroy() {
		this.ladderManager.destroy();
		this.battleBot.destroy();
		if (Features[this.id]) delete Features[this.id];
	};
};