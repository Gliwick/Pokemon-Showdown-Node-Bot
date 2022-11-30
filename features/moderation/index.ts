/*
	Moderation Feature
*/

import { Feature } from '../index';

const MOD_CONSTS = {
	FLOOD_MESSAGE_NUM: 5,
	FLOOD_PER_MSG_MIN: 500, // this is the minimum time between messages for legitimate spam. It's used to determine what "flooding" is caused by lag
	FLOOD_MESSAGE_TIME: 6 * 1000,
	MIN_CAPS_LENGTH: 18,
	MIN_CAPS_PROPORTION: 0.8,
	MAX_STRETCH: 7,
	MAX_REPEAT: 4
};

const DEFAULT_MOD_VALUES = {
	'spam-p': 3,
	'spam': 4,
	'spam-link': 4,
	'flood-hard': 3,
	'flood': 2,
	'caps': 1,
	'stretch': 1,
	'banwords': 2,
	'inapwords': 2,
	'servers': 2,
	'youtube': 2,
	'spoiler': 2,
	'replays': 1
};

export class ModerationManager implements Feature {
	id = 'moderation';
	desc = 'Automated moderation for chat rooms';
	chatData = {};
	chatLog = {};
	zeroTol = {};
	cleanDataTimer: number | null = null;

	constructor() { }

	getConst(c) {
		if (Config.moderation && Config.moderation.MOD_CONSTS && typeof Config.moderation.MOD_CONSTS[c] !== 'undefined') return Config.moderation.MOD_CONSTS[c];
		return MOD_CONSTS[c];
	}

	getValue(key) {
		if (Config.moderation && Config.moderation.values && typeof Config.moderation.values[key] === 'number') return parseInt(Config.moderation.values[key]);
		return DEFAULT_MOD_VALUES[key] || 1;
	}

	getModException(room) {
		if (Settings.settings['modexception'] && typeof Settings.settings['modexception'][room] !== 'undefined') return Settings.settings['modexception'][room];
		if (Config.moderation && typeof Config.moderation.modException !== 'undefined') return Config.moderation.modException;
		return Tools.getGroup('driver');
	}

	trad(data, room) {
		var lang = Config.language || 'english';
		if (Settings.settings['language'] && Settings.settings['language'][room]) lang = Settings.settings['language'][room];
		return Tools.translateGlobal('moderation', data, lang);
	}

	cleanData() {
		for (var room in this.chatData) {
			for (var user in this.chatData[room]) {
				var now = Date.now();
				if (!this.chatData[room][user] || !this.chatData[room][user].times.length) {
					delete this.chatData[room][user];
					continue;
				}
				if (now - this.chatData[room][user].times[this.chatData[room][user].times.length - 1] > 24 * 60 * 60 * 1000) {
					delete this.chatData[room][user];
					continue;
				}
				var newTimes = [];
				for (var j = 0; j < this.chatData[room][user].times.length; j++) {
					if (now - this.chatData[room][user].times[j] < 60 * 60 * 1000) newTimes.push(this.chatData[room][user].times[j]);
				}
				delete this.chatData[room][user].times;
				this.chatData[room][user].times = newTimes;
				if (this.chatData[room][user].points) this.chatData[room][user].points--;
			}
		}
	};

	isBotRanked(room, rank) {
		if (!Bot.rooms[room]) return false;
		var ident = Bot.rooms[room].users[toId(Bot.status.nickName)];
		if (ident) return Tools.equalOrHigherRank(ident, rank);
		return false;
	}

	isBanned(room, user, noregexp?: boolean) {
		user = toId(user);
		if (Settings.settings['autoban'] && Settings.settings['autoban'][room] && Settings.settings['autoban'][room][user]) return true;
		if (!noregexp && Settings.settings['regexautoban'] && Settings.settings['regexautoban'][room]) {
			for (var i in Settings.settings['regexautoban'][room]) {
				try {
					var regexObj = new RegExp(i.substr(1, i.length - 3), 'i');
					if (regexObj.test(user)) return '#range';
				} catch (e) { }
			}
		}
		return false;
	}

	blacklistUser(user, room) {
		if (!Settings.settings['autoban'] || !Settings.settings['autoban'][room] || !Settings.settings['autoban'][room][user]) {
			if (!Settings.settings['autoban']) Settings.settings['autoban'] = {};
			if (!Settings.settings['autoban'][room]) Settings.settings['autoban'][room] = {};
			Settings.settings['autoban'][room][user] = 1;
			return true;
		}
		return false;
	}

	getJoinPhrase(room, user) {
		user = toId(user);
		if (Settings.settings['jpdisable'] && Settings.settings['jpdisable'][room]) return false;
		if (Settings.settings['joinphrases'] && Settings.settings['joinphrases'][room] && Settings.settings['joinphrases'][room][user]) return Settings.settings['joinphrases'][room][user];
		if (Settings.settings['joinphrases'] && Settings.settings['joinphrases']['global'] && Settings.settings['joinphrases']['global'][user]) return Settings.settings['joinphrases']['global'][user];
		return false;
	}

	addZeroTolUser(user, level) {
		if (!Settings.settings['zerotol'] || Settings.settings['zerotol'][user] !== level) {
			if (!Settings.settings['zerotol']) Settings.settings['zerotol'] = {};
			Settings.settings['zerotol'][user] = level;
			return true;
		}
		return false;
	}

	removeZeroTolUser(user) {
		if (Settings.settings['zerotol'] && Settings.settings['zerotol'][user]) {
			delete Settings.settings['zerotol'][user];
			return true;
		}
		return false;
	}

	getZeroTol(user) {
		if (Settings.settings['zerotol'] && Settings.settings['zerotol'][user]) return Settings.settings['zerotol'][user];
		return false;
	}

	getServersAds(text) {
		var aux = text.toLowerCase();
		var serversAds: string[] = [];
		var spamindex;
		var actualAd = '';
		while (aux.indexOf(".psim.us") > -1) {
			spamindex = aux.indexOf(".psim.us");
			actualAd = '';
			for (var i = spamindex - 1; i >= 0; i--) {
				if (aux.charAt(i).replace(/[^a-z0-9]/g, '') === '') break;
				actualAd = aux.charAt(i) + actualAd;
			}
			if (actualAd.length) serversAds.push(toId(actualAd));
			aux = aux.substr(spamindex + ".psim.us".length);
		}
		return serversAds;
	}

	parseChat(room, time, by, message) {
		var user = toId(by);
		if (Tools.equalOrHigherRank(by, this.getModException(room))) return;
		var ban = this.isBanned(room, by);
		if (ban) Bot.say(room, '/roomban ' + by + ', ' + this.trad('ab', room) + ((ban === '#range') ? ' (RegExp)' : ''));

		/* Chat Logs */

		if (!this.chatLog[room]) this.chatLog[room] = {
			times: [0, 0, 0, 0],
			users: ['', '', '', ''],
			msgs: ['', '', '', '']
		};

		this.chatLog[room].times.push(time);
		this.chatLog[room].users.push(user);
		this.chatLog[room].msgs.push(message);

		this.chatLog[room].times.shift();
		this.chatLog[room].users.shift();
		this.chatLog[room].msgs.shift();

		var msg = message.trim().replace(/[ \u0000\u200B-\u200F]+/g, " "); // removes extra spaces and null characters so messages that should trigger stretching do so

		if (!this.chatData[room]) this.chatData[room] = {};

		if (!this.chatData[room][user]) this.chatData[room][user] = { times: [], lastMsgs: ['', '', ''], points: 0, lastAction: 0 };

		this.chatData[room][user].lastMsgs.push(msg);
		this.chatData[room][user].lastMsgs.shift();

		this.chatData[room][user].times.push(time);

		/* Moderation */

		if (!Config.moderation.allowmute) return;
		if (!this.isBotRanked(room, Tools.getGroup('driver'))) return; // Bot is not a driver or above

		var infractions = [];
		var muteMessage = '';
		var pointVal = 0;
		var totalPointVal = 0;
		var times = this.chatData[room][user].times;

		var modSettings = {};
		var useDefault = !(Settings.settings['modding'] && Settings.settings['modding'][room]);
		if (useDefault) {
			modSettings = Config.moderation.modDefault;
		} else {
			for (var i in Config.moderation.modDefault) {
				if (typeof Settings.settings['modding'][room][i] === "undefined") {
					modSettings[i] = Config.moderation.modDefault[i];
				} else {
					modSettings[i] = Settings.settings['modding'][room][i];
				}
			}
		}

		var pv = 0;
		var capsMatch = msg.replace(/[^A-Za-zА-Яа-яЁё]/g, '').match(/[A-ZА-ЯЁ]/g);
		capsMatch = capsMatch && toId(msg).length > this.getConst('MIN_CAPS_LENGTH') && (capsMatch.length >= Math.floor(toId(msg).length * this.getConst('MIN_CAPS_PROPORTION')));
		var stretchRegExp = new RegExp('(.)\\1{' + this.getConst('MAX_STRETCH').toString() + ',}', 'g');
		var repeatRegExp = new RegExp('(..+)\\1{' + this.getConst('MAX_REPEAT').toString() + ',}', 'g');
		var stretchMatch = msg.toLowerCase().match(stretchRegExp);
		var inlineSpam = stretchMatch ? false : msg.toLowerCase().match(repeatRegExp);
		var isFlooding = (times.length >= this.getConst('FLOOD_MESSAGE_NUM') && (time - times[times.length - this.getConst('FLOOD_MESSAGE_NUM')]) < this.getConst('FLOOD_MESSAGE_TIME') && (time - times[times.length - this.getConst('FLOOD_MESSAGE_NUM')]) > (this.getConst('FLOOD_PER_MSG_MIN') * this.getConst('FLOOD_MESSAGE_NUM')));
		var addFlood = false;

		/*****************
		* Spam Mod
		******************/

		if (modSettings['spam'] !== 0 || modSettings['flooding'] !== 0) {
			if (times.length >= this.getConst('FLOOD_MESSAGE_NUM') && (time - times[times.length - this.getConst('FLOOD_MESSAGE_NUM')]) < this.getConst('FLOOD_MESSAGE_TIME')) {
				var isSpamming = false;
				for (let i = this.chatLog[room].users.length - 2; i > this.chatLog[room].users.length - 4; i--) {
					if (this.chatLog[room].users[i] !== this.chatLog[room].users[this.chatLog[room].users.length - 1]) {
						isSpamming = true;
						break;
					}
				}
				if (isSpamming) {
					if (msg.toLowerCase().indexOf("http://") > -1 || msg.toLowerCase().indexOf("https://") > -1 || msg.toLowerCase().indexOf("www.") > -1) {
						if (modSettings['spam'] !== 0) {
							muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('sl', room);
							pointVal = this.getValue('spam-link');
						} else if (modSettings['flooding'] !== 0) {
							pointVal = this.getValue('flood');
							muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('f', room);
							addFlood = true;
						}
					} else {
						if (msg.length > 70 || capsMatch || msg.toLowerCase().indexOf("**") > -1 || stretchMatch || inlineSpam) {
							if (modSettings['spam'] !== 0) {
								muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('s', room);
								pointVal = this.getValue('spam');
							} else if (modSettings['flooding'] !== 0) {
								pointVal = this.getValue('flood');
								muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('f', room);
								addFlood = true;
							}
						} else {
							if (modSettings['flooding'] !== 0) {
								pointVal = this.getValue('flood');
								muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('f', room);
								addFlood = true;
							}
						}
					}
				}
			}
		}

		pv = this.getValue('spam-p');
		if (modSettings['spam'] !== 0 && pointVal < pv) {
			if (times.length >= 3 && (time - times[times.length - 3]) < this.getConst('FLOOD_MESSAGE_TIME') && msg === this.chatData[room][user].lastMsgs[0] && this.chatData[room][user].lastMsgs[0] === this.chatData[room][user].lastMsgs[1]) {
				pointVal = pv;
				muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('fs', room);
				if (msg.toLowerCase().indexOf("http://") > -1 || msg.toLowerCase().indexOf("https://") > -1 || msg.toLowerCase().indexOf("www.") > -1) {
					muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('sl', room);
					pointVal = this.getValue('spam-link');
				} else if (msg.length > 70 || capsMatch || msg.toLowerCase().indexOf("**") > -1 || stretchMatch || inlineSpam) {
					muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('s', room);
					pointVal = this.getValue('spam');
				}
			}
		}

		/********************************************
		* Bacic Mods (caps, stretching, flooding)
		*********************************************/

		if (modSettings['caps'] !== 0 && capsMatch) {
			infractions.push(this.trad('caps-0', room));
			pv = this.getValue("caps");
			totalPointVal += pv;
			if (pointVal < pv) {
				pointVal = pv;
				muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('caps', room);
			}
		}

		pv = this.getValue("stretch");
		if (inlineSpam) {
			infractions.push(this.trad('rep-0', room));
			totalPointVal += pv;
		}

		if (modSettings['stretching'] !== 0 && stretchMatch) {
			infractions.push(this.trad('stretch-0', room));
			totalPointVal += pv;
			if (pointVal < pv) {
				pointVal = pv;
				muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('stretch', room);
			}
		}

		pv = this.getValue("flood");
		if (modSettings['flooding'] !== 0 && isFlooding) {
			addFlood = true;
			if (pointVal < pv) {
				pointVal = pv;
				muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('f', room);
			}
		}
		if (addFlood) {
			infractions.push(this.trad('flood-0', room));
			totalPointVal += pv;
		}

		/*****************************
		* Specific Mods
		******************************/

		pv = this.getValue("spoiler");
		if (modSettings['spoiler'] !== 0 && (msg.toLowerCase().indexOf("spoiler:") > -1 || msg.toLowerCase().indexOf("spoilers:") > -1)) {
			infractions.push(this.trad('spoiler-0', room));
			totalPointVal += pv;
			if (pointVal < pv) {
				pointVal = pv;
				muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('spoiler', room);
			}
		}

		pv = this.getValue("youtube");
		if (modSettings['youtube'] !== 0 && (msg.toLowerCase().indexOf("youtube.com/channel/") > -1 || msg.toLowerCase().indexOf("youtube.com/user/") > -1)) {
			infractions.push(this.trad('youtube-0', room));
			totalPointVal += pv;
			if (pointVal < pv) {
				pointVal = pv;
				muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('youtube', room);
			}
		}

		pv = this.getValue("replays");
		if (modSettings['replays'] !== 0 && (msg.toLowerCase().indexOf("replay.pokemonshowdown.com/") > -1)) {
			infractions.push(this.trad('replays-0', room));
			totalPointVal += pv;
			if (pointVal < pv) {
				pointVal = pv;
				muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('replays', room);
			}
		}

		pv = this.getValue("servers");
		if (modSettings['psservers'] !== 0 && msg.toLowerCase().indexOf(".psim.us") > -1) {
			var serverAds = this.getServersAds(msg);
			for (var z = 0; z < serverAds.length; z++) {
				if (!(serverAds[z] in Config.moderation.psServersExcepts)) {
					infractions.push(this.trad('server-0', room));
					totalPointVal += pv;
					if (pointVal < pv) {
						pointVal = pv;
						muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('server', room);
					}
					break;
				}
			}
		}

		/****************************
		* Banned Words
		*****************************/

		pv = this.getValue("inapwords");
		if (modSettings['inapropiate'] !== 0) {
			var inapropiatephraseSettings = Settings.settings['inapropiatephrases'];
			var inapropiatePhrases = !!inapropiatephraseSettings ? (Object.keys(inapropiatephraseSettings[room] || {})).concat(Object.keys(inapropiatephraseSettings['global'] || {})) : [];
			var msgrip = " " + msg.toLowerCase().replace(/[^a-zа-яё0-9]/g, ' ') + " ";
			for (let i = 0; i < inapropiatePhrases.length; i++) {
				if (msgrip.indexOf(" " + inapropiatePhrases[i] + " ") > -1) {
					infractions.push(this.trad('inapword-0', room));
					totalPointVal += pv;
					if (pointVal < pv) {
						pointVal = pv;
						muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('inapword', room);
					}
					break;
				}
			}
		}

		pv = this.getValue("banwords");
		if (modSettings['bannedwords'] !== 0) {
			var banphraseSettings = Settings.settings['bannedphrases'];
			var bannedPhrases = !!banphraseSettings ? (Object.keys(banphraseSettings[room] || {})).concat(Object.keys(banphraseSettings['global'] || {})) : [];
			var msglow = msg.toLowerCase();
			for (let i = 0; i < bannedPhrases.length; i++) {
				if (msglow.indexOf(bannedPhrases[i]) > -1) {
					infractions.push(this.trad('banword-0', room));
					totalPointVal += pv;
					if (pointVal < pv) {
						pointVal = pv;
						muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('banword', room);
					}
					break;
				}
			}
		}

		/*****************************
		* Multiple infraction
		******************************/

		if (modSettings['multiple'] !== 0) {
			if (infractions.length >= 2) {
				pointVal = totalPointVal;
				muteMessage = ', ' + this.trad('automod', room) + '. ' + this.trad('mult', room) + ': ' + infractions.join(", ");
			}
		}

		/* Zero Tolerance */

		if (modSettings['zerotol'] && pointVal > 0 && Config.moderation && Config.moderation.zeroToleranceLevels && this.getZeroTol(user)) {
			var ztObj = Config.moderation.zeroToleranceLevels[this.getZeroTol(user)];
			if (ztObj && ztObj.value) {
				muteMessage += ' ' + this.trad('0tol', room);
				pointVal += ztObj.value;
			}
		}

		/* Applying punishment */

		if (pointVal > 0) {
			var cmd = 'mute';
			pointVal += this.chatData[room][user].points;
			this.chatData[room][user].points++;
			if (pointVal > Config.moderation.punishments.length) pointVal = Config.moderation.punishments.length;
			if (pointVal >= 2) {
				if (!this.zeroTol[user]) this.zeroTol[user] = 0;
				this.zeroTol[user]++;
				if (this.zeroTol[user] > 4 && Config.moderation.zeroToleranceDefaultLevel) {
					this.addZeroTolUser(user, Config.moderation.zeroToleranceDefaultLevel);
				}
			}

			cmd = Config.moderation.punishments[pointVal - 1];

			if (cmd === 'roomban' && !this.isBotRanked(room, Tools.getGroup('moderator'))) cmd = 'hourmute'; //Bot is not a moderator
			if ((room in Config.privateRooms) && cmd === 'warn') cmd = 'mute'; //can't warn in private rooms

			Bot.say(room, '/' + cmd + ' ' + user + muteMessage);
		}
	}

	parseJoin(room, by) {
		var jp = this.getJoinPhrase(room, by);
		if (jp) Bot.say(room, jp);
		if (Tools.equalOrHigherRank(by, Config.moderation.modException)) return;
		var ban = this.isBanned(room, by);
		if (ban) Bot.say(room, '/roomban ' + by + ', ' + this.trad('ab', room) + ((ban === '#range') ? ' (RegExp)' : ''));
	}

	parseLeave(room, by) {
		return; // parseLeave is useless now, but can be useful later
	}

	parseRename(room, by, old) {
		if (Tools.equalOrHigherRank(by, Config.moderation.modException)) return;
		var ban = this.isBanned(room, by);
		if (ban) {
			Bot.say(room, '/roomban ' + by + ', ' + this.trad('ab', room) + ((ban === '#range') ? ' (RegExp)' : ''));
			if (ban !== '#range' && !this.isBanned(room, old)) {
				this.blacklistUser(room, old); // Blacklist alt
				SecurityLog.log("User \"" + old + "\" was blacklisted for being alt of \"" + toId(by) + "\" | Room: " + room);
			}
		}
	}

	init() {
		for (var i in this.chatData)
			delete this.chatData[i];
		for (var i in this.chatLog)
			delete this.chatLog[i];

		if (this.cleanDataTimer) clearInterval(this.cleanDataTimer);
		this.cleanDataTimer = null;
		this.cleanDataTimer = setInterval(this.cleanData, 30 * 60 * 1000);
	};

	parse(room, message, isIntro, spl) {
		if (isIntro) return;
		if (!Bot.rooms[room] || Bot.rooms[room].type !== "chat") return;
		if (!Config.moderation) Config.moderation = {};
		var by, timeOff;
		switch (spl[0]) {
			case 'c':
				by = spl[1];
				timeOff = Date.now();
				this.parseChat(room, timeOff, by, message.substr(("|" + spl[0] + "|" + spl[1] + "|").length));
				break;

			case 'c:':
				by = spl[2];
				timeOff = parseInt(spl[1]) * 1000;
				this.parseChat(room, timeOff, by, message.substr(("|" + spl[0] + "|" + spl[1] + "|" + spl[2] + "|").length));
				break;

			case 'J': case 'j':
				this.parseJoin(room, spl[1]);
				break;

			case 'l': case 'L':
				this.parseLeave(room, spl[1]);
				break;

			case 'n': case 'N':
				this.parseRename(room, spl[1], spl[2]);
				break;
		}
	};

	destroy() {
		if (this.cleanDataTimer) clearInterval(this.cleanDataTimer);
		this.cleanDataTimer = null;
		if (Features[this.id]) delete Features[this.id];
	};
};