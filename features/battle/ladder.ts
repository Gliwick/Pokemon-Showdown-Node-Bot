import { toId } from '../../tools';
import { BattleBot } from './battle-ai';
import { TeamBuilder } from './teambuilder';

export class LadderManager {
	reportsRoom: string | null = null;
	laddering = false;
	ladderTimer: NodeJS.Timeout | null = null;

	battleBot: BattleBot;
	teamBuilder: TeamBuilder;

	constructor(battleBot: BattleBot, teamBuilder: TeamBuilder) {
		this.battleBot = battleBot;
		this.teamBuilder = teamBuilder;
	}

	reportBattle(room: string): void {
		if (!this.reportsRoom) return;
		let lang = Config.language || 'english';
		if (Settings.settings.language?.[this.reportsRoom]) lang = Settings.settings['language'][this.reportsRoom];
		Bot.say(this.reportsRoom, Tools.intl.translateGlobal('battle', 'battlefound', lang) + ': <<' + room + '>>');
		this.reportsRoom = null;
	}

	start(format?: string): boolean {
		if (!format) return false;
		if (this.laddering) return false;
		format = toId(format);
		const check = ((): void => {
			if (Settings.lockdown) return;
			let counter = 0;
			let maxBattles = 1;
			if (Config.ladderNumberOfBattles) maxBattles = Config.ladderNumberOfBattles;
			for (const battle in this.battleBot.battles) {
				if (
					this.battleBot.battles[battle].tier &&
					toId(this.battleBot.battles[battle].tier) === format &&
					this.battleBot.battles[battle].rated
				)
					counter++;
			}
			if (counter >= maxBattles) return;
			const cmds: string[] = [];
			const team = this.teamBuilder.getTeam(format as string);
			if (team) cmds.push('|/useteam ' + team);
			cmds.push('|/search ' + format);
			Bot.send(cmds);
		}).bind(this);
		this.laddering = true;
		this.ladderTimer = setInterval(check, Config.ladderCheckInterval || 10 * 1000);
		check();
		return true;
	}

	stop(): boolean {
		if (!this.laddering) return false;
		this.laddering = false;
		if (this.ladderTimer) clearTimeout(this.ladderTimer);
		this.ladderTimer = null;
		return true;
	}

	destroy(): void {
		this.laddering = false;
		if (this.ladderTimer) clearTimeout(this.ladderTimer);
		this.ladderTimer = null;
	}
}
