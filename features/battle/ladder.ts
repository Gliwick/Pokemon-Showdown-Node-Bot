import { battleBot } from "./battle-ai";
import { teamBuilder } from "./teambuilder";

export class LadderManager {
	reportsRoom: boolean = false;
	laddering: boolean = false;
	ladderTimer: number | null = null;

	constructor() { };

	reportBattle(room) {
		if (!this.reportsRoom) return;
		let lang = Config.language || 'english';
		if (Settings.settings['language'] && Settings.settings['language'][this.reportsRoom]) lang = Settings.settings['language'][this.reportsRoom];
		Bot.say(this.reportsRoom, Tools.translateGlobal('battle', 'battlefound', lang) + ": <<" + room + ">>");
		this.reportsRoom = false;
	};

	start(format) {
		if (!format) return false;
		if (this.laddering) return false;
		format = toId(format);
		const check = function () {
			if (Settings.lockdown) return;
			let counter = 0;
			let maxBattles = 1;
			if (Config.ladderNumberOfBattles) maxBattles = Config.ladderNumberOfBattles;
			for (let battle in battleBot.battles) {
				if (battleBot.battles[battle].tier && toId(battleBot.battles[battle].tier) === format && battleBot.battles[battle].rated) counter++;
			}
			if (counter >= maxBattles) return;
			const cmds: string[] = [];
			const team = teamBuilder.getTeam(format);
			if (team) cmds.push('|/useteam ' + team);
			cmds.push('|/search ' + format);
			Bot.send(cmds);
		};
		this.laddering = true;
		this.ladderTimer = setInterval(check, Config.ladderCheckInterval || (10 * 1000));
		check();
		return true;
	};

	stop() {
		if (!this.laddering) return false;
		this.laddering = false;
		if (this.ladderTimer) clearTimeout(this.ladderTimer);
		this.ladderTimer = null;
		return true;
	};

	destroy() {
		this.laddering = false;
		if (this.ladderTimer) clearTimeout(this.ladderTimer);
		this.ladderTimer = null;
	};
};