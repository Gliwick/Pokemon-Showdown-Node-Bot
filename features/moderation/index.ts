/*
	Moderation Feature
*/

import { ConfigType, validateConfigObject } from '../../config-tools';
import { toId } from '../../tools';
import { Feature } from '../index';

const DEFAULT_MOD_CONSTS: Required<ConfigType['moderation']['MOD_CONSTS']> = {
	FLOOD_MESSAGE_NUM: 5,
	FLOOD_PER_MSG_MIN: 500, // this is the minimum time between messages for legitimate spam. It's used to determine what "flooding" is caused by lag
	FLOOD_MESSAGE_TIME: 6 * 1000,
	MIN_CAPS_LENGTH: 18,
	MIN_CAPS_PROPORTION: 0.8,
	MAX_STRETCH: 7,
	MAX_REPEAT: 4,
};

const DEFAULT_MOD_VALUES: Required<ConfigType['moderation']['values']> = {
	'spam-p': 3,
	spam: 4,
	'spam-link': 4,
	'flood-hard': 3,
	flood: 2,
	caps: 1,
	stretch: 1,
	banwords: 2,
	inapwords: 2,
	servers: 2,
	youtube: 2,
	spoiler: 2,
	replays: 1,
};

const DEFAULT_MOD: ConfigType['moderation']['modDefault'] = {
	caps: 1,
	stretching: 1,
	flooding: 1,
	spam: 1,
	bannedwords: 1,
	inapropiate: 1,
	spoiler: 1,
	youtube: 1,
	psservers: 1,
	multiple: 1,
	zerotol: 1,
	replays: 1,
};

interface ChatData {
	times: number[];
	points: number;
	lastMsgs: string[];
	lastAction: number;
}

interface ChatLog {
	times: [number, number, number, number];
	users: [string, string, string, string];
	msgs: [string, string, string, string];
}

export class ModerationManager implements Feature {
	id = 'moderation';
	desc = 'Automated moderation for chat rooms';
	chatData: Record<string, Record<string, ChatData>> = {};
	chatLog: Record<string, ChatLog> = {};
	zeroTol: Record<string, number> = {};
	cleanDataTimer: NodeJS.Timeout | null = null;

	getConst(c: keyof ConfigType['moderation']['MOD_CONSTS']): number {
		return Config.moderation?.MOD_CONSTS?.[c] || DEFAULT_MOD_CONSTS[c];
	}

	getValue(key: keyof ConfigType['moderation']['values']): number {
		return Config.moderation?.values?.[key] || DEFAULT_MOD_VALUES[key];
	}

	getModException(room: string): string | true {
		return Settings.settings.modexception?.[room] || Config.moderation.modException || Tools.getGroup('driver');
	}

	trad(data: string, room: string): string {
		const lang = Settings.settings.language?.[room] || Config.language || 'english';
		return Tools.intl.translateGlobal('moderation', data, lang);
	}

	cleanData(): void {
		for (const room in this.chatData) {
			for (const user in this.chatData[room]) {
				const now = Date.now();
				if (!this.chatData[room][user] || !this.chatData[room][user].times.length) {
					delete this.chatData[room][user];
					continue;
				}
				if (
					now - this.chatData[room][user].times[this.chatData[room][user].times.length - 1] >
					24 * 60 * 60 * 1000
				) {
					delete this.chatData[room][user];
					continue;
				}
				this.chatData[room][user].times = this.chatData[room][user].times.filter(
					(time) => now - time < 60 * 60 * 1000
				);
				this.chatData[room][user].points--;
			}
		}
	}

	isBotRanked(room: string, rank: string | true): boolean {
		if (!Bot.rooms[room]) return false;
		const ident = Bot.rooms[room].users[toId(Bot.status.nickName)];
		if (ident) return Tools.equalOrHigherRank(ident, rank);
		return false;
	}

	isBanned(room: string, user: string, noregexp?: boolean): boolean | '#range' {
		user = toId(user);
		if (Settings.settings.autoban?.[room]?.[user]) return true;
		if (!noregexp && Settings.settings.regexautoban?.[room]) {
			for (const i in Settings.settings.regexautoban[room]) {
				try {
					const regexObj = new RegExp(i.substr(1, i.length - 3), 'i');
					if (regexObj.test(user)) return '#range';
				} catch (e) {}
			}
		}
		return false;
	}

	blacklistUser(room: string, user: string): boolean {
		if (!Settings.settings.autoban?.[room]?.[user]) {
			Settings.settings.autoban = Settings.settings.autoban || {};
			Settings.settings.autoban[room] = Settings.settings.autoban[room] || {};
			Settings.settings.autoban[room][user] = 1;
			return true;
		}
		return false;
	}

	getJoinPhrase(room: string, user: string): string | false {
		user = toId(user);
		if (Settings.settings.jpdisable?.[room]) return false;
		return (
			Settings.settings.joinphrases?.[room]?.[user] || Settings.settings.joinphrases?.['global']?.[user] || false
		);
	}

	addZeroTolUser(user: string, level: string): boolean {
		if (Settings.settings.zerotol?.[user] !== level) {
			Settings.settings.zerotol = Settings.settings.zerotol || {};
			Settings.settings.zerotol[user] = level;
			return true;
		}
		return false;
	}

	removeZeroTolUser(user: string): boolean {
		if (Settings.settings['zerotol'] && Settings.settings['zerotol'][user]) {
			delete Settings.settings['zerotol'][user];
			return true;
		}
		return false;
	}

	getZeroTol(user: string): string | false {
		if (Settings.settings['zerotol'] && Settings.settings['zerotol'][user])
			return Settings.settings['zerotol'][user];
		return false;
	}

	getServersAds(text: string): string[] {
		let aux = text.toLowerCase();
		const serversAds: string[] = [];
		let spamindex;
		let actualAd = '';
		while (aux.indexOf('.psim.us') > -1) {
			spamindex = aux.indexOf('.psim.us');
			actualAd = '';
			for (let i = spamindex - 1; i >= 0; i--) {
				if (aux.charAt(i).replace(/[^a-z0-9]/g, '') === '') break;
				actualAd = aux.charAt(i) + actualAd;
			}
			if (actualAd.length) serversAds.push(toId(actualAd));
			aux = aux.substr(spamindex + '.psim.us'.length);
		}
		return serversAds;
	}

	private pushAndShift<T>(arr: [T, T, T, T], el: T): [T, T, T, T] {
		return [arr[1], arr[2], arr[3], el];
	}

	parseChat(room: string, time: number, by: string, message: string): void {
		const user = toId(by);
		if (Tools.equalOrHigherRank(by, this.getModException(room))) return;
		const ban = this.isBanned(room, by);
		if (ban) Bot.say(room, '/roomban ' + by + ', ' + this.trad('ab', room) + (ban === '#range' ? ' (RegExp)' : ''));

		/* Chat Logs */

		if (!this.chatLog[room])
			this.chatLog[room] = {
				times: [0, 0, 0, 0],
				users: ['', '', '', ''],
				msgs: ['', '', '', ''],
			};

		this.chatLog[room].times = this.pushAndShift(this.chatLog[room].times, time);
		this.chatLog[room].users = this.pushAndShift(this.chatLog[room].users, user);
		this.chatLog[room].msgs = this.pushAndShift(this.chatLog[room].msgs, message);

		const msg = message.trim().replace(/[ \u0000\u200B-\u200F]+/g, ' '); // removes extra spaces and null characters so messages that should trigger stretching do so

		if (!this.chatData[room]) this.chatData[room] = {};

		if (!this.chatData[room][user])
			this.chatData[room][user] = { times: [], lastMsgs: ['', '', ''], points: 0, lastAction: 0 };

		this.chatData[room][user].lastMsgs.push(msg);
		this.chatData[room][user].lastMsgs.shift();

		this.chatData[room][user].times.push(time);

		/* Moderation */

		if (!Config.moderation.allowmute) return;
		if (!this.isBotRanked(room, Tools.getGroup('driver'))) return; // Bot is not a driver or above

		const infractions = [];
		let muteMessage = '';
		let pointVal = 0;
		let totalPointVal = 0;
		const times = this.chatData[room][user].times;

		const useDefault = !(Settings.settings['modding'] && Settings.settings['modding'][room]);
		const modSettings = useDefault
			? Config.moderation.modDefault
			: { ...Config.moderation.modDefault, ...(Settings.settings.modding?.[room] || {}) };

		let pv = 0;
		const capsMatchArray = msg.replace(/[^A-Za-zА-Яа-яЁё]/g, '').match(/[A-ZА-ЯЁ]/g);
		const capsMatch =
			capsMatchArray &&
			toId(msg).length > this.getConst('MIN_CAPS_LENGTH') &&
			capsMatchArray.length >= Math.floor(toId(msg).length * this.getConst('MIN_CAPS_PROPORTION'));
		const stretchRegExp = new RegExp('(.)\\1{' + this.getConst('MAX_STRETCH').toString() + ',}', 'g');
		const repeatRegExp = new RegExp('(..+)\\1{' + this.getConst('MAX_REPEAT').toString() + ',}', 'g');
		const stretchMatch = msg.toLowerCase().match(stretchRegExp);
		const inlineSpam = stretchMatch ? false : msg.toLowerCase().match(repeatRegExp);
		const isFlooding =
			times.length >= this.getConst('FLOOD_MESSAGE_NUM') &&
			time - times[times.length - this.getConst('FLOOD_MESSAGE_NUM')] < this.getConst('FLOOD_MESSAGE_TIME') &&
			time - times[times.length - this.getConst('FLOOD_MESSAGE_NUM')] >
				this.getConst('FLOOD_PER_MSG_MIN') * this.getConst('FLOOD_MESSAGE_NUM');
		let addFlood = false;

		/*****************
		 * Spam Mod
		 ******************/

		if (modSettings.spam || modSettings.flooding) {
			if (
				times.length >= this.getConst('FLOOD_MESSAGE_NUM') &&
				time - times[times.length - this.getConst('FLOOD_MESSAGE_NUM')] < this.getConst('FLOOD_MESSAGE_TIME')
			) {
				let isSpamming = false;
				for (let i = this.chatLog[room].users.length - 2; i > this.chatLog[room].users.length - 4; i--) {
					if (this.chatLog[room].users[i] !== this.chatLog[room].users[this.chatLog[room].users.length - 1]) {
						isSpamming = true;
						break;
					}
				}
				if (isSpamming) {
					if (
						msg.toLowerCase().indexOf('http://') > -1 ||
						msg.toLowerCase().indexOf('https://') > -1 ||
						msg.toLowerCase().indexOf('www.') > -1
					) {
						if (modSettings.spam) {
							muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('sl', room);
							pointVal = this.getValue('spam-link');
						} else if (modSettings.flooding) {
							pointVal = this.getValue('flood');
							muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('f', room);
							addFlood = true;
						}
					} else {
						if (
							msg.length > 70 ||
							capsMatch ||
							msg.toLowerCase().indexOf('**') > -1 ||
							stretchMatch ||
							inlineSpam
						) {
							if (modSettings.spam) {
								muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('s', room);
								pointVal = this.getValue('spam');
							} else if (modSettings.flooding) {
								pointVal = this.getValue('flood');
								muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('f', room);
								addFlood = true;
							}
						} else {
							if (modSettings.flooding) {
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
		if (modSettings.spam && pointVal < pv) {
			if (
				times.length >= 3 &&
				time - times[times.length - 3] < this.getConst('FLOOD_MESSAGE_TIME') &&
				msg === this.chatData[room][user].lastMsgs[0] &&
				this.chatData[room][user].lastMsgs[0] === this.chatData[room][user].lastMsgs[1]
			) {
				pointVal = pv;
				muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('fs', room);
				if (
					msg.toLowerCase().indexOf('http://') > -1 ||
					msg.toLowerCase().indexOf('https://') > -1 ||
					msg.toLowerCase().indexOf('www.') > -1
				) {
					muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('sl', room);
					pointVal = this.getValue('spam-link');
				} else if (
					msg.length > 70 ||
					capsMatch ||
					msg.toLowerCase().indexOf('**') > -1 ||
					stretchMatch ||
					inlineSpam
				) {
					muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('s', room);
					pointVal = this.getValue('spam');
				}
			}
		}

		/********************************************
		 * Bacic Mods (caps, stretching, flooding)
		 *********************************************/

		if (modSettings.caps && capsMatch) {
			infractions.push(this.trad('caps-0', room));
			pv = this.getValue('caps');
			totalPointVal += pv;
			if (pointVal < pv) {
				pointVal = pv;
				muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('caps', room);
			}
		}

		pv = this.getValue('stretch');
		if (inlineSpam) {
			infractions.push(this.trad('rep-0', room));
			totalPointVal += pv;
		}

		if (modSettings.stretching && stretchMatch) {
			infractions.push(this.trad('stretch-0', room));
			totalPointVal += pv;
			if (pointVal < pv) {
				pointVal = pv;
				muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('stretch', room);
			}
		}

		pv = this.getValue('flood');
		if (modSettings.flooding && isFlooding) {
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

		pv = this.getValue('spoiler');
		if (
			modSettings.spoiler &&
			(msg.toLowerCase().indexOf('spoiler:') > -1 || msg.toLowerCase().indexOf('spoilers:') > -1)
		) {
			infractions.push(this.trad('spoiler-0', room));
			totalPointVal += pv;
			if (pointVal < pv) {
				pointVal = pv;
				muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('spoiler', room);
			}
		}

		pv = this.getValue('youtube');
		if (
			modSettings.youtube &&
			(msg.toLowerCase().indexOf('youtube.com/channel/') > -1 ||
				msg.toLowerCase().indexOf('youtube.com/user/') > -1)
		) {
			infractions.push(this.trad('youtube-0', room));
			totalPointVal += pv;
			if (pointVal < pv) {
				pointVal = pv;
				muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('youtube', room);
			}
		}

		pv = this.getValue('replays');
		if (modSettings.replays && msg.toLowerCase().indexOf('replay.pokemonshowdown.com/') > -1) {
			infractions.push(this.trad('replays-0', room));
			totalPointVal += pv;
			if (pointVal < pv) {
				pointVal = pv;
				muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('replays', room);
			}
		}

		pv = this.getValue('servers');
		if (modSettings.psservers && msg.toLowerCase().indexOf('.psim.us') > -1) {
			const serverAds = this.getServersAds(msg);
			for (let z = 0; z < serverAds.length; z++) {
				if (Config.moderation.psServersExcepts && Config.moderation.psServersExcepts.includes(serverAds[z])) {
					continue;
				}
				infractions.push(this.trad('server-0', room));
				totalPointVal += pv;
				if (pointVal < pv) {
					pointVal = pv;
					muteMessage = ', ' + this.trad('automod', room) + ': ' + this.trad('server', room);
				}
				break;
			}
		}

		/****************************
		 * Banned Words
		 *****************************/

		pv = this.getValue('inapwords');
		if (modSettings.inapropiate) {
			const inapropiatephraseSettings = Settings.settings.inapropiatephrases;
			const inapropiatePhrases = !!inapropiatephraseSettings
				? Object.keys({ ...inapropiatephraseSettings[room], ...inapropiatephraseSettings['global'] })
				: [];
			const msgrip = ' ' + msg.toLowerCase().replace(/[^a-zа-яё0-9]/g, ' ') + ' ';
			for (let i = 0; i < inapropiatePhrases.length; i++) {
				if (msgrip.indexOf(' ' + inapropiatePhrases[i] + ' ') > -1) {
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

		pv = this.getValue('banwords');
		if (modSettings.bannedwords) {
			const banphraseSettings = Settings.settings.bannedphrases;
			const bannedPhrases = !!banphraseSettings
				? Object.keys({ ...banphraseSettings[room], ...banphraseSettings['global'] })
				: [];
			const msglow = msg.toLowerCase();
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

		if (modSettings.multiple) {
			if (infractions.length >= 2) {
				pointVal = totalPointVal;
				muteMessage =
					', ' + this.trad('automod', room) + '. ' + this.trad('mult', room) + ': ' + infractions.join(', ');
			}
		}

		/* Zero Tolerance */

		const zerotol = this.getZeroTol(user);
		if (
			modSettings.zerotol &&
			pointVal > 0 &&
			Config.moderation &&
			Config.moderation.zeroToleranceLevels &&
			zerotol
		) {
			const ztObj = Config.moderation.zeroToleranceLevels[zerotol];
			if (ztObj && ztObj.value) {
				muteMessage += ' ' + this.trad('0tol', room);
				pointVal += ztObj.value;
			}
		}

		/* Applying punishment */

		if (pointVal > 0) {
			let cmd = 'mute';
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
			if (Config.privateRooms.includes(room) && cmd === 'warn') cmd = 'mute'; //can't warn in private rooms

			Bot.say(room, '/' + cmd + ' ' + user + muteMessage);
		}
	}

	parseJoin(room: string, by: string): void {
		const jp = this.getJoinPhrase(room, by);
		if (jp) Bot.say(room, jp);
		if (Tools.equalOrHigherRank(by, Config.moderation.modException)) return;
		const ban = this.isBanned(room, by);
		if (ban) Bot.say(room, '/roomban ' + by + ', ' + this.trad('ab', room) + (ban === '#range' ? ' (RegExp)' : ''));
	}

	parseRename(room: string, by: string, old: string): void {
		if (Tools.equalOrHigherRank(by, Config.moderation.modException)) return;
		const ban = this.isBanned(room, by);
		if (ban) {
			Bot.say(room, '/roomban ' + by + ', ' + this.trad('ab', room) + (ban === '#range' ? ' (RegExp)' : ''));
			if (ban !== '#range' && !this.isBanned(room, old)) {
				this.blacklistUser(room, old); // Blacklist alt
				SecurityLog.log(
					'User "' + old + '" was blacklisted for being alt of "' + toId(by) + '" | Room: ' + room
				);
			}
		}
	}

	init(): void {
		this.chatData = {};
		this.chatLog = {};

		if (this.cleanDataTimer) clearInterval(this.cleanDataTimer);
		this.cleanDataTimer = null;
		this.cleanDataTimer = setInterval(this.cleanData, 30 * 60 * 1000);
	}

	parse(room: string, message: string, isIntro: boolean, spl: string[]): void {
		if (isIntro) return;
		if (!Bot.rooms[room] || Bot.rooms[room].type !== 'chat') return;
		validateConfigObject('moderation', {
			modException: '%',
			MOD_CONSTS: { ...DEFAULT_MOD_CONSTS },
			values: { ...DEFAULT_MOD_VALUES },
			modDefault: DEFAULT_MOD,
			punishments: ['warn', 'mute', 'hourmute', 'roomban'],
		});
		let by, timeOff;
		switch (spl[0]) {
			case 'c':
				by = spl[1];
				timeOff = Date.now();
				this.parseChat(room, timeOff, by, message.substr(('|' + spl[0] + '|' + spl[1] + '|').length));
				break;

			case 'c:':
				by = spl[2];
				timeOff = parseInt(spl[1]) * 1000;
				this.parseChat(
					room,
					timeOff,
					by,
					message.substr(('|' + spl[0] + '|' + spl[1] + '|' + spl[2] + '|').length)
				);
				break;

			case 'J':
			case 'j':
				this.parseJoin(room, spl[1]);
				break;

			case 'l':
			case 'L':
				// don't parse leave
				break;

			case 'n':
			case 'N':
				this.parseRename(room, spl[1], spl[2]);
				break;
		}
	}

	destroy(): void {
		if (this.cleanDataTimer) clearInterval(this.cleanDataTimer);
		this.cleanDataTimer = null;
		if (Features[this.id]) delete Features[this.id];
	}
}
