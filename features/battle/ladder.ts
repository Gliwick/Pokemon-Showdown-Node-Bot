import { BATTLE_BOT } from "./battle-ai";
import { TEAM_BUILDER } from "./teambuilder";

export class LadderManager {
	reportsRoom: boolean = false;
	laddering: boolean = false;
	ladderTimer: number | null = null;

	constructor() { };

	reportBattle(room) {
		if (!this.reportsRoom) return;
		var lang = Config.language || 'english';
		if (Settings.settings['language'] && Settings.settings['language'][this.reportsRoom]) lang = Settings.settings['language'][this.reportsRoom];
		Bot.say(this.reportsRoom, Tools.translateGlobal('battle', 'battlefound', lang) + ": <<" + room + ">>");
		this.reportsRoom = false;
	};

	start(format) {
		if (!format) return false;
		if (this.laddering) return false;
		format = toId(format);
		var check = function () {
			if (Settings.lockdown) return;
			var counter = 0;
			var maxBattles = 1;
			if (Config.ladderNumberOfBattles) maxBattles = Config.ladderNumberOfBattles;
			for (let battle in BATTLE_BOT.battles) {
				if (BATTLE_BOT.battles[battle].tier && toId(BATTLE_BOT.battles[battle].tier) === format && BATTLE_BOT.battles[battle].rated) counter++;
			}
			if (counter >= maxBattles) return;
			var cmds = [];
			var team = TEAM_BUILDER.getTeam(format);
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

export const LADDER_MANAGER = new LadderManager();