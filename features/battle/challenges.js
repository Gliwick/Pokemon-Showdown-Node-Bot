
exports.challenges = [];

function canChallenge(nBattles) {
	if (!nBattles) return true; //If it is not busy, accept the challenge
	if (Config.aceptAll) return true; //Acept all challenges if 'aceptAll' is enabled
	if (Config.maxBattles && Config.maxBattles > nBattles) return true; //If it is not in too many battles, accept the challenge
	if (Tools.equalOrHigherRank(i, Tools.getGroup('driver'))) return true; //Staff exception
	return false;
}

exports.parse = function (room, message, isIntro, spl) {
	if (!spl[3].startsWith('/challenge')) return;
	var nBattles = Object.keys(Features['battle'].BattleBot.battles).length;
	exports.challenges = [spl[4]];
	if (exports.challenges) {
		for (var format of exports.challenges) {
			const player = spl[1];
			if (canChallenge(nBattles)) {
				if (Settings.lockdown || !(format in Formats) || !Formats[format].chall) {
					Bot.say('', '/reject ' + player);
					continue;
				}
				if (Formats[format].team && !Features['battle'].TeamBuilder.hasTeam(format)) {
					Bot.say('', '/reject ' + player);
					continue;
				}

				var team = Features['battle'].TeamBuilder.getTeam(format);
				if (team) {
					Bot.say(spl[1], '/useteam ' + team);
				}
				//Bot.say('', '/ionext');
				Bot.say('', '/accept ' + player);
				nBattles++;
				debug("accepted battle: " + format);
			} else {
				Bot.say('', '/reject ' + player);
				debug("rejected battle: " + format);
				continue;
			}
		}
	}
};
