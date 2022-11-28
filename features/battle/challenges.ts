import { BATTLE_BOT } from "./battle-ai";
import { TEAM_BUILDER } from "./teambuilder";

export class ChallengeManager {
	challenges: string[] = [];

	constructor() { };

	canChallenge(nBattles, i) {
		if (!nBattles) return true; //If it is not busy, accept the challenge
		if (Config.aceptAll) return true; //Acept all challenges if 'aceptAll' is enabled
		if (Config.maxBattles && Config.maxBattles > nBattles) return true; //If it is not in too many battles, accept the challenge
		if (Tools.equalOrHigherRank(i, Tools.getGroup('driver'))) return true; //Staff exception
		return false;
	}

	parse(room, message, isIntro, spl) {
		if (!spl[3].startsWith('/challenge ')) return;
		var nBattles = Object.keys(BATTLE_BOT.battles).length;
		this.challenges = [spl[4]];
		if (this.challenges) {
			for (var format of this.challenges) {
				const player = spl[1];
				if (canChallenge(nBattles)) {
					if (Settings.lockdown || !(format in Formats) || !Formats[format].chall) {
						Bot.say('', '/reject ' + player);
						debug("rejected battle: " + format);
						continue;
					}
					if (Formats[format].team && !TEAM_BUILDER.hasTeam(format)) {
						Bot.say('', '/reject ' + player);
						debug("rejected battle (no team) : " + format);
						continue;
					}

					var team = TEAM_BUILDER.getTeam(format);
					Bot.say(spl[1], '/useteam ' + (team || 'null'));
					Bot.say('', '/accept ' + player);
					nBattles++;
					debug("accepted battle: " + format);
				} else {
					Bot.say('', '/reject ' + player);
					debug("rejected battle (busy): " + format);
					continue;
				}
			}
		}
	};
};

export const CHALLENGE_MANAGER = new ChallengeManager();