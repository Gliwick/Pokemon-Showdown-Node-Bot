import { debug } from '../../log';
import { Parser } from '..';
import { BattleBot } from './battle-ai';
import { TeamBuilder } from './teambuilder';

export class ChallengeManager implements Parser {
	challenges: string[] = [];

	battleBot: BattleBot;
	teamBuilder: TeamBuilder;

	constructor(battleBot: BattleBot, teamBuilder: TeamBuilder) {
		this.battleBot = battleBot;
		this.teamBuilder = teamBuilder;
	}

	canChallenge(nBattles: number, user: string): boolean {
		if (!nBattles) return true; //If it is not busy, accept the challenge
		if (Config.acceptAll) return true; //Acept all challenges if 'acceptAll' is enabled
		if (Config.maxBattles && Config.maxBattles > nBattles) return true; //If it is not in too many battles, accept the challenge
		if (Tools.equalOrHigherRank(user, Tools.getGroup('driver'))) return true; //Staff exception
		return false;
	}

	parse(room: string, message: string, isIntro: boolean, spl: string[]): void {
		if (!spl[3].startsWith('/challenge ')) return;
		let nBattles = Object.keys(this.battleBot.battles).length;
		this.challenges = [spl[4]];
		if (this.challenges) {
			for (const format of this.challenges) {
				const player = spl[1];
				if (this.canChallenge(nBattles, player)) {
					if (Settings.lockdown || !(format in Formats) || !Formats[format].chall) {
						Bot.say('', '/reject ' + player);
						debug('rejected battle: ' + format);
						continue;
					}
					if (Formats[format].team && !this.teamBuilder.hasTeam(format)) {
						Bot.say('', '/reject ' + player);
						debug('rejected battle (no team) : ' + format);
						continue;
					}

					const team = this.teamBuilder.getTeam(format);
					Bot.say(spl[1], '/useteam ' + (team || 'null'));
					Bot.say('', '/accept ' + player);
					nBattles++;
					debug('accepted battle: ' + format);
				} else {
					Bot.say('', '/reject ' + player);
					debug('rejected battle (busy): ' + format);
					continue;
				}
			}
		}
	}
}
