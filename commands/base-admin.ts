/*
	Admin Commands
*/

import { Command } from '../bll/command-parser';
import { toId, toRoomid } from '../tools';

interface Room {
	title?: string;
}

interface Rooms {
	official?: Room[];
	chat?: Room[];
}

export const commands: Record<string, string | Command> = {
	c: 'custom',
	custom: function (arg, by, room) {
		if (!this.isRanked('admin')) return false;
		let tarRoom;
		if (arg.indexOf('[') === 0 && arg.indexOf(']') > -1) {
			tarRoom = toRoomid(arg.slice(1, arg.indexOf(']')));
			arg = arg.substr(arg.indexOf(']') + 1).trim();
		}
		this.sclog();
		this.say(tarRoom || room, arg);
	},

	sendpm: 'pm',
	pm: function (arg, by, room, cmd) {
		if (!this.isRanked('admin')) return false;
		const args = arg.split(',');
		if (args.length < 2) return this.reply('Usage: ' + this.cmdToken + cmd + ' [user], [message]');
		const targetUser = toId(args.shift());
		const msg = args.join(',').trim();
		if (!targetUser || !msg) return this.reply('Usage: ' + this.cmdToken + cmd + ' [user], [message]');
		this.sclog();
		this.sendPM(targetUser, msg);
	},

	join: function (arg) {
		if (!this.isRanked('admin')) return false;
		if (!arg) return;
		const cmds = arg.split(',').map((a) => '|/join ' + a);
		this.sclog();
		this.send(cmds);
	},

	leave: function (arg) {
		if (!this.isRanked('admin')) return false;
		if (!arg) {
			if (this.roomType !== 'pm') this.reply('/leave');
			this.sclog();
			return;
		}
		const cmds = arg.split(',').map((a) => toId(a) + '|/leave');
		this.sclog();
		this.send(cmds);
	},

	joinallrooms: 'joinall',
	joinrooms: 'joinall',
	joinall: function (arg, by, room, cmd) {
		if (!this.isRanked('admin')) return false;
		let target = 'all';
		arg = toId(arg);
		if (arg.length || cmd === 'joinrooms') {
			if (arg === 'official') target = 'official';
			else if (arg === 'public') target = 'public';
			else if (arg === 'all') target = 'all';
			else return this.reply('Usage: ' + this.cmdToken + cmd + ' [official/public/all]');
		}
		const qParser = (data: string): void => {
			const command = data.split('|')[0];
			if (command === 'rooms') {
				const str = data.substring(command.length + 1);
				let cmds: string[] = [];
				try {
					const roomsObject = JSON.parse(str) as Rooms;
					const rooms: Room[][] = [];
					if (target === 'all' || target === 'official') rooms.push(roomsObject.official || []);
					if (target === 'all' || target === 'public') rooms.push(roomsObject.chat || []);
					cmds = rooms
						.flat(1)
						.map((room) => toId(room.title))
						.filter((room) => !!room)
						.map((room) => '|/join ' + room);
				} catch (e) {}
				Bot.send(cmds, 2000);
				Bot.removeListener('queryresponse', qParser);
			}
		};
		Bot.on('queryresponse', qParser);
		this.sclog();
		Bot.send('|/cmd rooms');
	},

	lang: 'language',
	language: function (arg, by, room) {
		if (!this.isRanked('roomowner')) return false;
		let tarRoom = room;
		const targetObj = Tools.getTargetRoom(arg);
		let textHelper = '';
		if (targetObj && this.isExcepted) {
			arg = targetObj.arg;
			tarRoom = targetObj.room;
			textHelper = ' (' + tarRoom + ')';
		}
		if (!Bot.rooms[tarRoom] || Bot.rooms[tarRoom].type !== 'chat')
			return this.reply(this.trad('notchat') + textHelper);
		const lang = toId(arg);
		if (!lang.length)
			return this.reply(
				this.trad('nolang') + '. ' + this.trad('v') + ': ' + Object.keys(Tools.intl.translations).join(', ')
			);
		if (!Tools.intl.translations[lang])
			return this.reply(this.trad('v') + ': ' + Object.keys(Tools.intl.translations).join(', '));
		if (!Settings.settings['language']) Settings.settings['language'] = {};
		Settings.settings['language'][tarRoom] = lang;
		Settings.save();
		this.sclog();
		this.language = lang;
		this.reply(this.trad('l') + textHelper);
	},

	settings: 'set',
	set: function (arg, by, room, cmd) {
		if (!this.isRanked('roomowner')) return false;
		let tarRoom = room;
		const targetObj = Tools.getTargetRoom(arg);
		let textHelper = '';
		if (targetObj && this.isExcepted) {
			arg = targetObj.arg;
			tarRoom = targetObj.room;
			textHelper = ' (' + tarRoom + ')';
		}
		if (!Bot.rooms[tarRoom] || Bot.rooms[tarRoom].type !== 'chat')
			return this.reply(this.trad('notchat') + textHelper);
		const args = arg.split(',');
		if (args.length < 2) return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u2'));
		const perm = toId(args[0]);
		const rank = args[1].trim();
		if (!(perm in Settings.permissions)) {
			return this.reply(this.trad('ps') + ': ' + Object.keys(Settings.permissions).sort().join(', '));
		}
		if (rank in { off: 1, disable: 1 }) {
			if (!this.canSet(perm, true)) return this.reply(this.trad('denied'));
			Settings.setPermission(tarRoom, perm, true);
			Settings.save();
			this.sclog();
			return this.reply(this.trad('p') + ' **' + perm + '** ' + this.trad('d') + textHelper);
		}
		if (rank in { on: 1, all: 1, enable: 1 }) {
			if (!this.canSet(perm, ' ')) return this.reply(this.trad('denied'));
			Settings.setPermission(tarRoom, perm, ' ');
			Settings.save();
			this.sclog();
			return this.reply(this.trad('p') + ' **' + perm + '** ' + this.trad('a') + textHelper);
		}
		if (Config.ranks.indexOf(rank) >= 0) {
			if (!this.canSet(perm, rank)) return this.reply(this.trad('denied'));
			Settings.setPermission(tarRoom, perm, rank);
			Settings.save();
			this.sclog();
			return this.reply(
				this.trad('p') + ' **' + perm + '** ' + this.trad('r') + ' ' + rank + ' ' + this.trad('r2') + textHelper
			);
		} else {
			return this.reply(this.trad('not1') + ' ' + rank + ' ' + this.trad('not2'));
		}
	},

	battlepermissions: 'battleset',
	battlesettings: 'battleset',
	battleset: function (arg, by, room, cmd) {
		if (!this.isRanked('admin')) return false;
		const args = arg.split(',');
		if (args.length < 2) return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u2'));
		const perm = toId(args[0]);
		const rank = args[1].trim();
		if (!(perm in Settings.permissions)) {
			return this.reply(this.trad('ps') + ': ' + Object.keys(Settings.permissions).sort().join(', '));
		}
		if (rank in { off: 1, disable: 1 }) {
			Settings.setPermission('battle-', perm, true);
			Settings.save();
			this.sclog();
			return this.reply(this.trad('p') + ' **' + perm + '** ' + this.trad('d'));
		}
		if (rank in { on: 1, all: 1, enable: 1 }) {
			Settings.setPermission('battle-', perm, ' ');
			Settings.save();
			this.sclog();
			return this.reply(this.trad('p') + ' **' + perm + '** ' + this.trad('a'));
		}
		if (Config.ranks.indexOf(rank) >= 0) {
			Settings.setPermission('battle-', perm, rank);
			Settings.save();
			this.sclog();
			return this.reply(
				this.trad('p') + ' **' + perm + '** ' + this.trad('r') + ' ' + rank + ' ' + this.trad('r2')
			);
		} else {
			return this.reply(this.trad('not1') + ' ' + rank + ' ' + this.trad('not2'));
		}
	},
};
