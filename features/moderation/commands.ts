/*
	Commands for Moderation Feature
*/

import { Command, CommandModuleManager, Context } from '../../command-parser';
import { ConfigType } from '../../config-tools';
import { getGroup, getTargetRoom, stripCommands, toId, toRoomid, uploadToHastebin } from '../../tools';
import { ModerationManager } from '.';

class ModerationModule implements CommandModuleManager {
	init(): void {
		Settings.addPermissions(['autoban', 'banword', 'joinphrase']);
	}
}

export const manager = ModerationModule;

export const commands: Record<string, string | Command> = {
	/**************************
	 * Autoban
	 ***************************/

	blacklist: 'autoban',
	ban: 'autoban',
	ab: 'autoban',
	autoban: function (arg, by, room) {
		if (!this.can('autoban')) return;
		let tarRoom = room;
		const targetObj = getTargetRoom(arg);
		let textHelper = '';
		if (targetObj && this.isExcepted) {
			arg = targetObj.arg;
			tarRoom = targetObj.room;
			textHelper = ' (' + tarRoom + ')';
		}
		if (Bot.rooms[tarRoom]?.type !== 'chat') return this.reply(this.trad('notchat') + textHelper);
		const moderator = getGroup('moderator');
		if (!this.isExcepted && !this.botRanked(moderator)) {
			return this.reply(this.botName + ' ' + this.trad('notmod').replace('@', moderator));
		}

		const argArray = arg.split(',');
		if (!argArray.join('').length) return this.reply(this.trad('notarg'));

		const added: string[] = [];
		const illegalNick: string[] = [];
		const alreadyAdded: string[] = [];

		for (let i = 0; i < argArray.length; i++) {
			const tarUser = toId(argArray[i]);
			if (tarUser.length < 1 || tarUser.length > 18) {
				illegalNick.push(tarUser);
				continue;
			}
			if (!Features.getFeature(ModerationManager).blacklistUser(tarUser, tarRoom)) {
				alreadyAdded.push(tarUser);
				continue;
			}
			this.say(tarRoom, '/roomban ' + tarUser + ', ' + this.trad('bu'));
			this.sclog('Blacklisted: ' + tarUser);
			added.push(tarUser);
		}

		let text = '';
		let mn = '';
		if (added.length) {
			text += this.trad('u') + ' "' + added.join('", "') + '" ' + this.trad('added') + ' ';
			mn += text;
			Settings.save();
		}
		if (alreadyAdded.length) {
			text += this.trad('u') + ' "' + alreadyAdded.join('", "') + '" ' + this.trad('already') + ' ';
		}
		if (illegalNick.length) {
			text += this.trad('all') + ' ' + (text.length ? this.trad('other') + ' ' : '') + ' ' + this.trad('illegal');
		}
		if (mn.length && !Config.moderation.disableModNote) this.say(tarRoom, '/mn ' + text + ' | By: ' + by);
		this.reply(text);
	},

	unblacklist: 'unautoban',
	unban: 'unautoban',
	unab: 'unautoban',
	unautoban: function (arg, by, room) {
		if (!this.can('autoban')) return;
		let tarRoom = room;
		const targetObj = getTargetRoom(arg);
		let textHelper = '';
		if (targetObj && this.isExcepted) {
			arg = targetObj.arg;
			tarRoom = targetObj.room;
			textHelper = ' (' + tarRoom + ')';
		}
		if (!Bot.rooms[tarRoom] || Bot.rooms[tarRoom].type !== 'chat') {
			return this.reply(this.trad('notchat') + textHelper);
		}
		const moderator = getGroup('moderator');
		if (!this.isExcepted && !this.botRanked(moderator)) {
			return this.reply(this.botName + ' ' + this.trad('notmod').replace('@', moderator));
		}

		const argArray = arg.split(',');

		if (!argArray.join('').length) return this.reply(this.trad('notarg'));

		const removed: string[] = [];
		const notRemoved: string[] = [];

		for (let i = 0; i < argArray.length; i++) {
			const tarUser = toId(argArray[i]);
			if (tarUser.length < 1 || tarUser.length > 18) {
				notRemoved.push(tarUser);
				continue;
			}
			if (!Features.getFeature(ModerationManager).unblacklistUser(tarUser, tarRoom)) {
				notRemoved.push(tarUser);
				continue;
			}
			this.say(tarRoom, '/roomunban ' + tarUser);
			this.sclog('Un-Blacklisted: ' + tarUser);
			removed.push(tarUser);
		}

		let text = '';
		if (removed.length) {
			text += this.trad('u') + ' "' + removed.join('", "') + '" ' + this.trad('r') + ' ';
			Settings.save();
		}
		if (notRemoved.length)
			text += (text.length ? this.trad('noother') + ' ' : this.trad('no') + ' ') + this.trad('nopresent');
		this.reply(text);
	},

	rab: 'regexautoban',
	regexautoban: function (arg, user, room) {
		if (!this.can('autoban')) return;
		let tarRoom = room;
		const targetObj = getTargetRoom(arg);
		let textHelper = '';
		if (targetObj && this.isExcepted) {
			arg = targetObj.arg;
			tarRoom = targetObj.room;
			textHelper = ' (' + tarRoom + ')';
		}
		if (!Bot.rooms[tarRoom] || Bot.rooms[tarRoom].type !== 'chat') {
			return this.reply(this.trad('notchat') + textHelper);
		}
		const moderator = getGroup('moderator');
		if (!this.isExcepted && !this.botRanked(moderator)) {
			return this.reply(this.botName + ' ' + this.trad('notmod').replace('@', moderator));
		}

		if (!arg) return this.reply(this.trad('notarg'));

		try {
			new RegExp(arg, 'i');
		} catch (e: any) {
			return this.reply(e.message);
		}

		if (/^(?:(?:\.+|[a-z0-9]|\\[a-z0-9SbB])(?![a-z0-9\.\\])(?:\*|\{\d+\,(?:\d+)?\}))+$/i.test(arg)) {
			return this.reply(this.trad('re') + ' /' + arg + '/i ' + this.trad('notadd'));
		}

		const regex = '/' + arg + '/i';
		if (!Features.getFeature(ModerationManager).blacklistRegex(regex, tarRoom)) {
			return this.reply('/' + regex + '/ ' + this.trad('already'));
		}
		Settings.save();
		this.sclog('Blacklisted RegExp: ' + regex);
		if (!Config.moderation.disableModNote) {
			this.say(
				tarRoom,
				'/modnote ' + this.trad('re') + ' ' + regex + ' ' + this.trad('addby') + ' ' + user + '.'
			);
		}
		this.reply(this.trad('re') + ' ' + regex + ' ' + this.trad('add'));
	},

	unrab: 'unregexautoban',
	unregexautoban: function (arg, user, room) {
		if (!this.can('autoban')) return;
		let tarRoom = room;
		const targetObj = getTargetRoom(arg);
		let textHelper = '';
		if (targetObj && this.isExcepted) {
			arg = targetObj.arg;
			tarRoom = targetObj.room;
			textHelper = ' (' + tarRoom + ')';
		}
		if (!Bot.rooms[tarRoom] || Bot.rooms[tarRoom].type !== 'chat') {
			return this.reply(this.trad('notchat') + textHelper);
		}
		const moderator = getGroup('moderator');
		if (!this.isExcepted && !this.botRanked(moderator)) {
			return this.reply(this.botName + ' ' + this.trad('notmod').replace('@', moderator));
		}

		if (!arg) return this.reply(this.trad('notarg'));

		arg = '/' + arg.replace(/\\\\/g, '\\') + '/i';
		if (!Features.getFeature(ModerationManager).unblacklistRegex(arg, tarRoom))
			return this.reply(this.trad('re') + ' ' + arg + ' ' + this.trad('notpresent'));
		Settings.save();
		this.sclog('Un-Blacklisted RegExp: ' + arg);
		if (!Config.moderation.disableModNote) {
			this.say(tarRoom, '/modnote ' + this.trad('re') + ' ' + arg + ' ' + this.trad('rby') + ' ' + user + '.');
		}
		this.reply(this.trad('re') + ' ' + arg + ' ' + this.trad('r'));
	},

	viewbans: 'viewblacklist',
	vab: 'viewblacklist',
	viewautobans: 'viewblacklist',
	viewblacklist: function (arg, by, room) {
		if (!this.can('autoban')) return;
		let tarRoom = room;
		const targetObj = getTargetRoom(arg);
		let textHelper = '';
		if (targetObj && this.isExcepted) {
			arg = targetObj.arg;
			tarRoom = targetObj.room;
			textHelper = ' (' + tarRoom + ')';
		}
		if (!Bot.rooms[tarRoom] || Bot.rooms[tarRoom].type !== 'chat') {
			return this.reply(this.trad('notchat') + textHelper);
		}

		if (arg.length) {
			if (!Settings.settings.autoban?.[tarRoom]) {
				return this.pmReply(this.trad('nousers') + ' ' + tarRoom);
			}

			const nick = toId(arg);
			if (nick.length < 1 || nick.length > 18) {
				return this.pmReply(this.trad('iu') + ': "' + nick + '".');
			} else {
				return this.pmReply(
					this.trad('u') +
						' "' +
						nick +
						'" ' +
						this.trad('currently') +
						' ' +
						(nick in Settings.settings.autoban[tarRoom] ? '' : this.trad('not') + ' ') +
						this.trad('b') +
						' ' +
						tarRoom +
						'.'
				);
			}
		}

		const { autoban, regexautoban } = Settings.settings;
		const bans = { autoban: autoban || {}, regexautoban: regexautoban || {} };
		const nBans = Object.values(bans)
			.map((settings) => Object.keys(settings).length)
			.reduce((acc, n) => acc + n, 0);
		const text = Object.entries(bans)
			.flatMap(([setting, settings]) => [
				this.trad(setting) + ' ' + tarRoom + ':\n\n',
				...Object.keys((settings as Record<string, Record<string, boolean>>)[tarRoom]),
			])
			.join('\n');

		if (nBans) {
			uploadToHastebin(
				text,
				function (this: Context, r: boolean, linkStr: any): void {
					if (r) this.pmReply(linkStr);
					else this.pmReply(this.trad('err'));
				}.bind(this)
			);
		} else {
			this.pmReply(this.trad('nousers') + ' ' + tarRoom);
		}
	},

	/**************************
	 * Zero Tolerance
	 ***************************/

	'0tol': 'zerotol',
	'0tole': 'zerotol',
	zt: 'zerotol',
	vzt: 'zerotol',
	viewzerotol: 'zerotol',
	zerotol: function (arg, by, room, cmd) {
		if (!this.isRanked(getGroup('admin'))) return;
		if (!Config.moderation.zeroToleranceLevels && Config.moderation.zeroToleranceDefaultLevel) {
			return this.reply(this.trad('nolevels'));
		}

		const ztLevels = Config.moderation.zeroToleranceLevels;
		const defaultLevel = Config.moderation.zeroToleranceDefaultLevel;
		const aliases = Object.entries(ztLevels || {})
			.map(([key, level]) => [key, level.name])
			.filter(([, name]) => !!name)
			.reduce((acc, [key, name]) => {
				acc[name] = key;
				return acc;
			}, {} as Record<string, string>);

		if (cmd === 'vzt' || cmd === 'viewzerotol') {
			const ztList = Object.entries(Settings.settings.zerotol || {})
				.map(([user, level]) => [user, ztLevels[level]?.name || level])
				.map(([user, level]) => this.trad('user') + ': ' + user + ' | ' + this.trad('level') + ': ' + level);
			if (ztList.length) {
				uploadToHastebin(
					this.trad('ztl') + ':\n\n' + ztList.join('\n'),
					function (this: Context, r: boolean, linkStr: any): void {
						if (r) this.pmReply(linkStr);
						else this.pmReply(this.trad('err'));
					}.bind(this)
				);
			} else {
				this.reply(this.trad('empty'));
			}
			return;
		}
		const args = arg.split(',');
		if (!args[1]) {
			const user = toId(args[0]);
			let level = Features.getFeature(ModerationManager).getZeroTol(user);
			if (level) level = ztLevels[level]?.name || level;
			this.reply(
				this.trad('user') +
					' "' +
					user +
					'" ' +
					this.trad('is') +
					' ' +
					(level ? this.trad('y') : this.trad('n')) +
					' ' +
					this.trad('in') +
					'. ' +
					(level ? '(' + level + ')' : '')
			);
		} else {
			let text;
			switch (toId(args[0])) {
				case 'add':
					if (args.length < 2) {
						return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u2'));
					}
					const added: string[] = [];
					const illegal: string[] = [];
					const alreadyAdded: string[] = [];
					const levelFail: string[] = [];
					for (let i = 1; i < args.length; i++) {
						const splArg = args[i].split(':');
						const user = toId(splArg[0]);
						let level = toId(splArg[1] || defaultLevel);
						if (aliases[level]) level = aliases[level];
						if (!user.length || user.length > 18) {
							illegal.push(user);
							continue;
						}
						if (!ztLevels[level]) {
							levelFail.push(user);
							continue;
						}
						if (Features.getFeature(ModerationManager).addZeroTolUser(user, level)) {
							added.push(user);
							this.sclog('0tol user: ' + user + '; Level: ' + level);
						} else {
							alreadyAdded.push(user);
						}
					}
					text = '';
					if (added.length) {
						text += this.trad('users') + ' "' + added.join('", "') + '" ' + this.trad('add') + '. ';
						Settings.save();
					}
					if (illegal.length) {
						text += illegal.length + ' ' + this.trad('illegal') + '. ';
					}
					if (levelFail.length) {
						text += this.trad('users') + ' "' + levelFail.join('", "') + '" ' + this.trad('invalid') + '. ';
					}
					if (alreadyAdded.length) {
						text +=
							this.trad('users') + ' "' + alreadyAdded.join('", "') + '" ' + this.trad('already') + '. ';
					}
					this.reply(text);
					break;
				case 'delete':
				case 'remove':
					if (args.length < 2)
						return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u2'));
					const removed: string[] = [];
					const notFound: string[] = [];
					for (const user of args) {
						const userId = toId(user);
						if (Features.getFeature(ModerationManager).removeZeroTolUser(userId)) {
							removed.push(userId);
							this.sclog('Un-0tol user: ' + userId);
						} else {
							notFound.push(userId);
						}
					}
					text = '';
					if (removed.length) {
						text += this.trad('users') + ' "' + removed.join('", "') + '" ' + this.trad('removed') + '. ';
						Settings.save();
					}
					if (notFound.length) {
						text += notFound.length + ' ' + this.trad('not') + '. ';
					}
					this.reply(text);
					break;
				default:
					this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u2'));
			}
		}
	},

	/**************************
	 * Banned words
	 ***************************/

	banphrase: 'banword',
	banword: function (arg, user, room) {
		if (!this.can('banword')) return;
		if (!arg) return false;

		let tarRoom;
		if (this.roomType === 'pm') {
			if (!this.isRanked(getGroup('admin'))) return false;
			tarRoom = 'global';
		} else {
			tarRoom = room;
		}

		const targetObj = getTargetRoom(arg);
		let textHelper = '';
		if (targetObj && this.isExcepted) {
			arg = targetObj.arg;
			tarRoom = targetObj.room;
			textHelper = ' (' + tarRoom + ')';
		}

		if (tarRoom !== 'global' && (!Bot.rooms[tarRoom] || Bot.rooms[tarRoom].type !== 'chat'))
			return this.reply(this.trad('notchat') + textHelper);
		arg = arg.trim().toLowerCase();

		if (!Settings.settings.bannedphrases) Settings.settings.bannedphrases = {};
		if (!Settings.settings.bannedphrases[tarRoom]) Settings.settings.bannedphrases[tarRoom] = {};
		const bannedPhrases = Settings.settings.bannedphrases[tarRoom];
		if (bannedPhrases[arg]) {
			return this.reply(this.trad('phrase') + ' "' + arg + '" ' + this.trad('already') + textHelper);
		}
		bannedPhrases[arg] = true;

		Settings.save();
		this.sclog();
		this.reply(this.trad('phrase') + ' "' + arg + '" ' + this.trad('ban') + textHelper);
	},

	unbanphrase: 'unbanword',
	unbanword: function (arg, user, room) {
		if (!this.can('banword')) return;
		if (!arg) return false;

		let tarRoom;
		if (this.roomType === 'pm') {
			if (!this.isRanked(getGroup('admin'))) return false;
			tarRoom = 'global';
		} else {
			tarRoom = room;
		}

		const targetObj = getTargetRoom(arg);
		let textHelper = '';
		if (targetObj && this.isExcepted) {
			arg = targetObj.arg;
			tarRoom = targetObj.room;
			textHelper = ' (' + tarRoom + ')';
		}

		if (tarRoom !== 'global' && (!Bot.rooms[tarRoom] || Bot.rooms[tarRoom].type !== 'chat'))
			return this.reply(this.trad('notchat') + textHelper);
		arg = arg.trim().toLowerCase();

		if (!Settings.settings.bannedphrases) {
			return this.reply(this.trad('phrase') + ' "' + arg + '" ' + this.trad('not') + textHelper);
		}

		const bannedPhrases = Settings.settings.bannedphrases[tarRoom];
		if (!bannedPhrases?.[arg]) {
			return this.reply(this.trad('phrase') + ' "' + arg + '" ' + this.trad('not') + textHelper);
		}

		delete bannedPhrases[arg];
		if (!Object.keys(bannedPhrases).length) {
			delete Settings.settings.bannedphrases[tarRoom];
		}

		Settings.save();
		this.sclog();
		this.reply(this.trad('phrase') + ' "' + arg + '" ' + this.trad('unban') + textHelper);
	},

	viewbannedphrases: 'viewbannedwords',
	vbw: 'viewbannedwords',
	viewbannedwords: function (arg, user, room) {
		if (!this.can('banword')) return;
		let tarRoom;
		let bannedFrom = '';
		if (this.roomType === 'pm') {
			if (!this.isRanked(getGroup('admin'))) return false;
			tarRoom = 'global';
		} else {
			tarRoom = room;
		}
		const targetObj = getTargetRoom(arg);
		let textHelper = '';
		if (targetObj && this.isExcepted) {
			arg = targetObj.arg;
			tarRoom = targetObj.room;
			textHelper = ' (' + tarRoom + ')';
		}

		if (tarRoom !== 'global' && (!Bot.rooms[tarRoom] || Bot.rooms[tarRoom].type !== 'chat'))
			return this.reply(this.trad('notchat') + textHelper);

		if (tarRoom === 'global') bannedFrom += this.trad('globally');
		else bannedFrom += this.trad('in') + ' ' + tarRoom;

		if (!Settings.settings.bannedphrases) return this.reply(this.trad('nowords') + textHelper);
		const bannedPhrases = Settings.settings.bannedphrases[tarRoom];
		if (!bannedPhrases) return this.reply(this.trad('nowords') + textHelper);

		if (arg.length) {
			return this.reply(
				this.trad('phrase') +
					' "' +
					arg +
					'" ' +
					this.trad('curr') +
					' ' +
					(bannedPhrases[arg] ? '' : this.trad('not') + ' ') +
					this.trad('banned') +
					' ' +
					bannedFrom +
					'.'
			);
		}

		const banList = Object.keys(bannedPhrases);
		if (!banList.length) return this.reply(this.trad('nowords') + textHelper);

		uploadToHastebin(
			this.trad('list') + ' ' + bannedFrom + ':\n\n' + banList.join('\n'),
			function (this: Context, r: boolean, link: string): void {
				if (r) return this.pmReply(this.trad('link') + ' ' + bannedFrom + ': ' + link);
				else this.pmReply(this.trad('err'));
			}.bind(this)
		);
	},

	inappropriatephrase: 'inapword',
	inapword: function (arg, user, room) {
		if (!this.can('banword')) return;
		if (!arg) return false;

		let tarRoom;
		if (this.roomType === 'pm') {
			if (!this.isRanked(getGroup('admin'))) return false;
			tarRoom = 'global';
		} else {
			tarRoom = room;
		}

		const targetObj = getTargetRoom(arg);
		let textHelper = '';
		if (targetObj && this.isExcepted) {
			arg = targetObj.arg;
			tarRoom = targetObj.room;
			textHelper = ' (' + tarRoom + ')';
		}

		if (tarRoom !== 'global' && (!Bot.rooms[tarRoom] || Bot.rooms[tarRoom].type !== 'chat'))
			return this.reply(this.trad('notchat') + textHelper);
		arg = arg.trim().toLowerCase();

		if (!Settings.settings.inapropiatephrases) Settings.settings.inapropiatephrases = {};
		if (!Settings.settings.inapropiatephrases[tarRoom]) Settings.settings.inapropiatephrases[tarRoom] = {};
		const bannedPhrases = Settings.settings.inapropiatephrases[tarRoom];
		if (bannedPhrases[arg]) {
			return this.reply(this.trad('phrase') + ' "' + arg + '" ' + this.trad('already') + textHelper);
		}
		bannedPhrases[arg] = true;

		Settings.save();
		this.sclog();
		this.reply(this.trad('phrase') + ' "' + arg + '" ' + this.trad('ban') + textHelper);
	},

	uninappropriatephrase: 'uninapword',
	uninapword: function (arg, user, room) {
		if (!this.can('banword')) return;
		if (!arg) return false;

		let tarRoom;
		if (this.roomType === 'pm') {
			if (!this.isRanked(getGroup('admin'))) return false;
			tarRoom = 'global';
		} else {
			tarRoom = room;
		}

		const targetObj = getTargetRoom(arg);
		let textHelper = '';
		if (targetObj && this.isExcepted) {
			arg = targetObj.arg;
			tarRoom = targetObj.room;
			textHelper = ' (' + tarRoom + ')';
		}

		if (tarRoom !== 'global' && (!Bot.rooms[tarRoom] || Bot.rooms[tarRoom].type !== 'chat'))
			return this.reply(this.trad('notchat') + textHelper);
		arg = arg.trim().toLowerCase();

		if (!Settings.settings.inapropiatephrases) {
			return this.reply(this.trad('phrase') + ' "' + arg + '" ' + this.trad('not') + textHelper);
		}

		const bannedPhrases = Settings.settings.inapropiatephrases[tarRoom];
		if (!bannedPhrases?.[arg]) {
			return this.reply(this.trad('phrase') + ' "' + arg + '" ' + this.trad('not') + textHelper);
		}
		delete bannedPhrases[arg];
		if (!Object.keys(bannedPhrases).length) {
			delete Settings.settings.inapropiatephrases[tarRoom];
		}

		Settings.save();
		this.sclog();
		this.reply(this.trad('phrase') + ' "' + arg + '" ' + this.trad('unban') + textHelper);
	},

	viewinapropiatephrases: 'viewinapwords',
	viw: 'viewinapwords',
	viewinapwords: function (arg, user, room) {
		if (!this.can('banword')) return;
		let tarRoom;
		let bannedFrom = '';
		if (this.roomType === 'pm') {
			if (!this.isRanked(getGroup('admin'))) return false;
			tarRoom = 'global';
		} else {
			tarRoom = room;
		}
		const targetObj = getTargetRoom(arg);
		let textHelper = '';
		if (targetObj && this.isExcepted) {
			arg = targetObj.arg;
			tarRoom = targetObj.room;
			textHelper = ' (' + tarRoom + ')';
		}

		if (tarRoom !== 'global' && (!Bot.rooms[tarRoom] || Bot.rooms[tarRoom].type !== 'chat'))
			return this.reply(this.trad('notchat') + textHelper);

		if (tarRoom === 'global') bannedFrom += this.trad('globally');
		else bannedFrom += this.trad('in') + ' ' + tarRoom;

		if (!Settings.settings.inapropiatephrases) return this.reply(this.trad('nowords') + textHelper);
		const bannedPhrases = Settings.settings.inapropiatephrases[tarRoom];
		if (!bannedPhrases) return this.reply(this.trad('nowords') + textHelper);

		if (arg.length) {
			return this.reply(
				this.trad('phrase') +
					' "' +
					arg +
					'" ' +
					this.trad('curr') +
					' ' +
					(bannedPhrases[arg] || this.trad('not') + ' ') +
					this.trad('banned') +
					' ' +
					bannedFrom +
					'.'
			);
		}

		const banList = Object.keys(bannedPhrases);
		if (!banList.length) return this.reply(this.trad('nowords') + textHelper);

		uploadToHastebin(
			this.trad('list') + ' ' + bannedFrom + ':\n\n' + banList.join('\n'),
			function (this: Context, r: boolean, link: string): void {
				if (r) return this.pmReply(this.trad('link') + ' ' + bannedFrom + ': ' + link);
				else this.pmReply(this.trad('err'));
			}.bind(this)
		);
	},

	/**************************
	 * Join Phrases
	 ***************************/

	jp: 'joinphrase',
	joinphrase: function (arg, by, room, cmd) {
		if (!this.can('joinphrase')) return;
		if (!Settings.settings.joinphrases) Settings.settings.joinphrases = {};

		let tarRoom;
		if (this.roomType === 'pm') {
			if (!this.isRanked(getGroup('admin'))) return false;
			tarRoom = 'global';
		} else {
			tarRoom = room;
		}

		const targetObj = getTargetRoom(arg);
		let textHelper = '';
		if (targetObj && this.isExcepted) {
			arg = targetObj.arg;
			tarRoom = targetObj.room;
			textHelper = ' (' + tarRoom + ')';
		}
		if (tarRoom !== 'global' && (!Bot.rooms[tarRoom] || Bot.rooms[tarRoom].type !== 'chat'))
			return this.reply(this.trad('notchat') + textHelper);

		if (Bot.rooms[tarRoom] && Bot.rooms[tarRoom].type === 'chat' && toId(arg) in { on: 1, enable: 1 }) {
			if (!this.isRanked(getGroup('roomowner'))) return false;
			if (!Settings.settings.jpdisable) Settings.settings.jpdisable = {};
			if (!Settings.settings.jpdisable[tarRoom]) return this.reply(this.trad('ae') + textHelper);
			delete Settings.settings.jpdisable[tarRoom];
			Settings.save();
			this.sclog();
			return this.reply(this.trad('e') + textHelper);
		}

		if (Bot.rooms[tarRoom] && Bot.rooms[tarRoom].type === 'chat' && toId(arg) in { off: 1, disable: 1 }) {
			if (!this.isRanked(getGroup('roomowner'))) return false;
			if (!Settings.settings.jpdisable) Settings.settings.jpdisable = {};
			if (Settings.settings.jpdisable[tarRoom]) return this.reply(this.trad('ad') + textHelper);
			Settings.settings.jpdisable[tarRoom] = true;
			Settings.save();
			this.sclog();
			return this.reply(this.trad('d') + textHelper);
		}

		let args = arg.split(',');

		if (args.length < 2) return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u2'));
		if (Settings.settings.jpdisable?.[tarRoom]) return this.reply(this.trad('dis') + textHelper);

		if (toId(args[0]) !== 'delete' && args.length === 2) {
			arg = 'set,' + toId(args[0]) + ',' + arg.substr(args[0].length + 1);
			args = arg.split(',');
		}

		arg = arg.substr(args[0].length + args[1].length + 2).trim();

		const user = toId(args[1]);
		if (!user) return false;

		switch (toId(args[0])) {
			case 'set':
			case 'add':
			case 'change':
				if (!arg?.length) return false;
				if (args.length < 3) {
					return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u2'));
				}
				if (!Settings.settings.joinphrases[tarRoom]) Settings.settings.joinphrases[tarRoom] = {};
				Settings.settings.joinphrases[tarRoom][user] = stripCommands(arg);
				Settings.save();
				this.sclog();
				this.reply(
					this.trad('jpfor') +
						' ' +
						user +
						' ' +
						this.trad('modified') +
						' ' +
						(tarRoom === 'global' ? this.trad('globally') : this.trad('forthis') + textHelper)
				);
				break;
			case 'delete':
				if (!Settings.settings.joinphrases[tarRoom]) Settings.settings.joinphrases[tarRoom] = {};
				if (!Settings.settings.joinphrases[tarRoom][user]) {
					return this.reply(
						this.trad('jpfor') +
							' ' +
							user +
							' ' +
							this.trad('not') +
							' ' +
							(tarRoom === 'global' ? this.trad('globally') : this.trad('forthis') + textHelper)
					);
				}
				delete Settings.settings.joinphrases[tarRoom][user];
				Settings.save();
				this.sclog();
				this.reply(
					this.trad('jpfor') +
						' ' +
						user +
						' ' +
						this.trad('del') +
						' ' +
						(tarRoom === 'global' ? this.trad('globally') : this.trad('forthis') + textHelper)
				);
				break;
			default:
				return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u2'));
		}
	},

	vjp: 'viewjoinphrases',
	viewjoinphrases: function (arg, by, room) {
		if (!this.can('joinphrase')) return;
		if (!Settings.settings.joinphrases) Settings.settings.joinphrases = {};

		let tarRoom: string;
		if (this.roomType === 'pm') {
			if (!this.isRanked(getGroup('admin'))) return false;
			tarRoom = 'global';
		} else {
			tarRoom = room;
		}

		const targetObj = getTargetRoom(arg);
		let textHelper = '';
		if (targetObj && this.isExcepted) {
			arg = targetObj.arg;
			tarRoom = targetObj.room;
			textHelper = ' (' + tarRoom + ')';
		}
		if (tarRoom !== 'global' && (!Bot.rooms[tarRoom] || Bot.rooms[tarRoom].type !== 'chat'))
			return this.reply(this.trad('notchat') + textHelper);

		arg = toId(arg);

		if (!Settings.settings.joinphrases[tarRoom]) Settings.settings.joinphrases[tarRoom] = {};

		if (arg) {
			if (arg.length < 1 || arg.length > 18) return this.reply(this.trad('iu'));
			return this.reply(Settings.settings.joinphrases[tarRoom][arg] || this.trad('not') + ' ' + arg + '.');
		}

		const list = Object.entries(Settings.settings.joinphrases[tarRoom]).map(
			([i, joinPhrase]) => i + ' => ' + joinPhrase
		);
		if (!list.length) return this.reply(this.trad('empty') + textHelper);
		uploadToHastebin(
			this.trad('jp') +
				' ' +
				(tarRoom === 'global' ? this.trad('globally') : this.trad('in') + ' ' + tarRoom) +
				':\n\n' +
				list.join('\n'),
			function (this: Context, r: boolean, link: string): void {
				if (r)
					return this.pmReply(
						this.trad('jp') +
							' ' +
							(tarRoom === 'global' ? this.trad('globally') : this.trad('in') + ' ' + tarRoom) +
							': ' +
							link
					);
				else this.pmReply(this.trad('err'));
			}.bind(this)
		);
	},

	/**************************
	 * Mod Settings
	 ***************************/

	modex: 'modexception',
	modexception: function (arg, by, room) {
		let tarRoom = room;
		const targetObj = getTargetRoom(arg);
		let textHelper = '';
		if (targetObj && this.isExcepted) {
			arg = targetObj.arg;
			tarRoom = targetObj.room;
			textHelper = ' (' + tarRoom + ')';
		}
		if (!Bot.rooms[tarRoom] || Bot.rooms[tarRoom].type !== 'chat')
			return this.reply(this.trad('notchat') + textHelper);
		if (!arg) {
			const exceptionSettings = Settings.settings.modexception || {};
			const ex = exceptionSettings[tarRoom] || Config.moderation.modException;
			const translation = ex === ' ' ? '**' + this.trad('all') + '**' : this.trad('rank') + ' **' + ex + '**';
			return this.restrictReply(
				this.trad('modex-inf1') + ' ' + translation + ' ' + this.trad('modex-inf2') + textHelper,
				'info'
			);
		}
		if (!this.isRanked(getGroup('roomowner'))) return false;
		if (!Settings.settings.modexception) Settings.settings.modexception = {};
		const rank = arg.trim();
		if (Config.ranks.indexOf(rank) >= 0) {
			Settings.settings.modexception[tarRoom] = rank;
			Settings.save();
			this.sclog();
			return this.reply(
				this.trad('modex-set1') +
					' ' +
					this.trad('rank') +
					' **' +
					rank +
					'** ' +
					this.trad('modex-set2') +
					textHelper
			);
		} else if (toId(rank) === 'all') {
			Settings.settings.modexception[tarRoom] = ' ';
			Settings.save();
			this.sclog();
			return this.reply(
				this.trad('modex-set1') + ' **' + this.trad('all') + '** ' + this.trad('modex-set2') + textHelper
			);
		} else {
			return this.reply(this.trad('not1') + ' ' + rank + ' ' + this.trad('not2'));
		}
	},

	setmod: 'mod',
	modset: 'mod',
	modsettings: 'mod',
	mod: function (arg, by, room, cmd) {
		if (!this.isRanked(getGroup('roomowner'))) return false;
		let tarRoom = room;
		const args = arg.split(',');
		if (args.length > 2) {
			if (!this.isRanked(getGroup('admin'))) return false;
			tarRoom = toRoomid(args[0]);
		}
		if (!Bot.rooms[tarRoom] || Bot.rooms[tarRoom].type !== 'chat') {
			return this.reply(this.trad('notchat') + ' (' + tarRoom + ')');
		}

		if (args.length < 2) return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u2'));
		const [modArg, set] = (args.length < 3 ? args.slice(0, 2) : args.slice(1, 3)).map(toId);
		if (set !== 'on' && set !== 'off') {
			return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u2'));
		}
		if (!(modArg in Config.moderation.modDefault)) {
			return this.reply(this.trad('valid') + ': ' + Object.keys(Config.moderation.modDefault).sort().join(', '));
		}

		if (!Settings.settings.modding) Settings.settings.modding = {};
		if (!Settings.settings.modding[tarRoom]) {
			Settings.settings.modding[tarRoom] = { ...Config.moderation.modDefault };
		}

		const mod = modArg as keyof ConfigType['moderation']['modDefault'];
		if (set === 'on') {
			if (Settings.settings.modding[tarRoom][mod] === 1) {
				this.reply(this.trad('mod') + ' **' + mod + '** ' + this.trad('ae') + ' ' + tarRoom);
			} else {
				Settings.settings.modding[tarRoom][mod] = 1;
				Settings.save();
				this.sclog();
				this.reply(this.trad('mod') + ' **' + mod + '** ' + this.trad('e') + ' ' + tarRoom);
			}
		} else {
			if (Settings.settings.modding[tarRoom][mod] === 0) {
				this.reply(this.trad('mod') + ' **' + mod + '** ' + this.trad('ad') + ' ' + tarRoom);
			} else {
				Settings.settings.modding[tarRoom][mod] = 0;
				Settings.save();
				this.sclog();
				this.reply(this.trad('mod') + ' **' + mod + '** ' + this.trad('d') + ' ' + tarRoom);
			}
		}
	},
};
