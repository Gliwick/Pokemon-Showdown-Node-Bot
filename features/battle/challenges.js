
exports.challenges = [];

function canChallenge(nBattles) {
	if (!nBattles) return true; //If it is not busy, accept the challenge
	if (Config.aceptAll) return true; //Acept all challenges if 'aceptAll' is enabled
	if (Config.maxBattles && Config.maxBattles > nBattles) return true; //If it is not in too many battles, accept the challenge
	if (Tools.equalOrHigherRank(i, Tools.getGroup('driver'))) return true; //Staff exception
	return false;
}

exports.parse = function (room, message, isIntro, spl) {
	let nBattles = Object.keys(Features['battle'].BattleBot.battles).length;
	try {
		exports.challenges = JSON.parse(spl[1]).challengesFrom;
	} catch (e) {return;}
	if (!exports.challenges) return;

	for (const player in exports.challenges) {
		const format = exports.challenges[player];
		if (canChallenge(nBattles)) {
			if (Settings.lockdown || !(format in Formats) || !Formats[format].chall) {
				Bot.say('', '/reject ' + player);
				continue;
			}
			if (Formats[format].team && !Features['battle'].TeamBuilder.hasTeam(format)) {
				Bot.say('', '/reject ' + player);
				continue;
			}

			const team = Features['battle'].TeamBuilder.getTeam(format);
			if (team) {
				Bot.say(spl[1], '/useteam ' + team);
			}
			Bot.say('', '/accept ' + player);
			nBattles++;
			debug("accepted battle: " + format);
		} else {
			Bot.say('', '/reject ' + player);
			debug("rejected battle: " + format);
			continue;
		}
	}
};
