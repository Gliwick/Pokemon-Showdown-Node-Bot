/*
	Development Commands
*/

import { exec, ExecException } from 'child_process';
import { inspect } from 'util';

import { Command, Context } from '../command-parser';
import { checkConfig } from '../config-tools';
import { errlog, error, info } from '../log';
import { toId, toRoomid } from '../tools';

export const commands: Record<string, string | Command> = {
	eval: 'js',
	js: function (arg, by, room) {
		if (!this.isExcepted) return false;
		this.sclog();
		try {
			const result = eval(arg.trim());
			this.say(room, '``' + JSON.stringify(result) + '``');
		} catch (e) {
			this.say(room, e.name + ': ' + e.message);
		}
	},

	send: function (arg) {
		if (!this.isExcepted) return false;
		this.sclog();
		this.send(arg);
	},

	unignore: 'ignore',
	ignore: function (arg, by, room, cmd) {
		if (!this.isExcepted || !arg) return false;
		if (cmd.substr(0, 2) === 'un') {
			if (CommandParser.resourceMonitor.isLocked(arg)) {
				CommandParser.resourceMonitor.unlock(arg);
				this.sclog();
				this.reply('User ' + arg + ' is no longer ignored');
			} else {
				this.reply('User ' + arg + ' is not ignored');
			}
		} else {
			if (!CommandParser.resourceMonitor.isLocked(arg)) {
				CommandParser.resourceMonitor.lock(arg);
				this.sclog();
				this.reply('User ' + arg + ' has been ignored by CommandParser');
			} else {
				this.reply('User ' + arg + ' is already ignored');
			}
		}
	},

	sleep: function (arg, by, room) {
		if (!this.isExcepted) return false;
		const roomObj = this.getRoom(toRoomid(arg) || room);
		if (!roomObj) {
			if (!arg) return this.pmReply('Usage: ' + this.cmdToken + this.cmd + ' [room]');
			return this.pmReply('Room "' + arg + '" not found');
		}
		if (Settings.sleepRoom(roomObj.id)) {
			this.sclog();
			this.pmReply('Status for room <<' + roomObj.id + '>> is now ``Sleeping``');
		} else {
			this.pmReply('The <<' + roomObj.id + '>> room status was already ``Sleeping``');
		}
	},

	wake: 'unsleep',
	unsleep: function (arg, by, room) {
		if (!this.isExcepted) return false;
		const roomObj = this.getRoom(toRoomid(arg) || room);
		if (!roomObj) {
			if (!arg) return this.pmReply('Usage: ' + this.cmdToken + this.cmd + ' [room]');
			return this.pmReply('Room "' + arg + '" not found');
		}
		if (Settings.unsleepRoom(roomObj.id)) {
			this.sclog();
			this.pmReply('Status for room <<' + roomObj.id + '>> is now ``Ready``');
		} else {
			this.pmReply('The <<' + roomObj.id + '>> room status was already ``Ready``');
		}
	},

	roomstatus: 'status',
	status: function (arg, by, room) {
		if (!this.isExcepted) return false;
		if (this.cmd === 'roomstatus') {
			if (room.charAt(0) !== ',') arg = arg || room;
			else if (!arg) return this.pmReply('Usage: ' + this.cmdToken + this.cmd + ' [room]');
		}
		if (!arg) {
			const roomsArray = Object.entries(Bot.rooms).map(([i, room]) => {
				const botIdent = room.users[toId(Bot.status.nickName)] || ' ';
				return (
					'<<' +
					i +
					'>> (' +
					room.type.charAt(0).toLowerCase() +
					(Settings.isSleeping(i) ? 's' : 'r') +
					(botIdent.charAt(0) !== ' ' ? botIdent.charAt(0) : 'u') +
					(Config.privateRooms.includes(i) ? 'h' : 'p') +
					')'
				);
			});
			const cmds = Tools.joinWithLengthLimit(
				roomsArray.length ? roomsArray : ['(none)'],
				'**Bot status** |' +
					(Settings.lockdown ? ' **Lockdown** |' : '') +
					' Username: ``' +
					Bot.status.nickName +
					'`` | Rooms: '
			);
			return this.pmReply(cmds);
		}

		const tarRoom = toRoomid(arg);
		const roomObj = this.getRoom(tarRoom);
		if (!roomObj) return this.pmReply('Room "' + tarRoom + '" not found');
		const sleep = Settings.isSleeping(tarRoom) ? 'Sleeping' : 'Ready';
		const botIdent = Bot.rooms[roomObj.id].users[toId(Bot.status.nickName)] || ' ';
		this.pmReply(
			'**' +
				roomObj.title +
				'** <<' +
				roomObj.id +
				'>> | Type: ``' +
				roomObj.type +
				'``' +
				(Config.privateRooms.includes(roomObj.id) ? ' (Hidden)' : '') +
				' | Users: ``' +
				roomObj.users.length +
				'`` | Bot group: ``' +
				(botIdent.charAt(0) !== ' ' ? botIdent.charAt(0) : '(regular user)') +
				'`` | Status: ``' +
				sleep +
				'``'
		);
	},

	uncacheall: 'clearcache',
	clearcache: function () {
		if (!this.isExcepted) return false;
		Settings.unCacheUrl(true);
		this.reply('Http-Cache successfully cleared');
	},

	hotpatch: 'reload',
	reload: function (arg) {
		if (!this.isExcepted) return false;
		const args = arg.split(',');
		const opt = toId(args[0]);
		switch (opt) {
			case '':
			case 'commands':
				this.sclog();
				const res = CommandParser.loadCommands(true) || [];
				if (!res.length) {
					return this.reply('Commands hotpatched');
				}
				return this.reply('Some command files crashed: ' + res.join(', '));
			case 'features':
				this.sclog();
				const errs = Features.loadFeatures(true) || [];
				if (!errs.length) {
					return this.reply('Features hotpatched');
				}
				return this.reply('Some features crashed: ' + errs.join(', '));
			case 'feature':
				this.sclog();
				if (!args[1]) return this.reply('You must specify a feature');
				args[1] = args[1].trim();
				try {
					Features.loadFeature(args[1], true);
					return this.reply('Feature: ' + args[1] + ' hotpatched');
				} catch (e: any) {
					errlog(e.stack);
					return this.reply(e.message || 'Error: Feature: ' + args[1] + ' crashed');
				}
			case 'commandparser':
			case 'parser':
				this.sclog();
				try {
					Tools.uncacheTree('./command-parser.ts');
					global.CommandParser = new (require('./../command-parser.ts').CommandParser)();
					this.reply('command-parser.ts reloaded');
					info('command-parser.ts reloaded');
					CommandParser.loadCommands(true);
				} catch (e) {
					errlog(e.stack);
					this.reply('Error: command-parser.ts has errors');
				}
				break;
			case 'tools':
				this.sclog();
				try {
					Tools.uncacheTree('./tools.ts');
					global.Tools = new (require('./../tools.ts').Tools)();
					this.reply('tools.ts reloaded');
					info('tools.ts reloaded');
					Tools.intl.loadTranslations(true);
				} catch (e) {
					errlog(e.stack);
					this.reply('Error: tools.ts has errors');
				}
				break;
			case 'data':
				this.sclog();
				Tools.uncacheTree('./data-downloader.ts');
				global.DataDownloader = new (require('../bll/data-downloader.ts').DataDownloader)();
				DataDownloader.download();
				this.reply('Data files reloaded');
				break;
			case 'config':
				this.sclog();
				try {
					Tools.uncacheTree(AppOptions.config);
					global.Config = require('./../' + AppOptions.config);
					checkConfig();
					Settings.applyConfig();
					CommandParser.reloadTokens();
					this.reply(AppOptions.config + ' reloaded');
					info(AppOptions.config + ' reloaded');
				} catch (e) {
					error('could not reload ' + AppOptions.config);
					errlog(e.stack);
					this.reply('Error: ' + 'could not reload ' + AppOptions.config);
				}
				break;
			case 'lang':
			case 'languages':
				this.sclog();
				const _errs = Tools.intl.loadTranslations(true) || [];
				if (!_errs.length) return this.reply('Languages hotpatched');
				this.reply('Some languages crashed: ' + _errs.join(', '));
				break;
			default:
				this.reply('Valid arguments are: commands, feature, features, parser, tools, data, config, languages');
		}
	},

	updatebranch: 'updategit',
	updategit: function () {
		if (!this.isExcepted) return false;

		if (GlobalMonitor.updateGitLock) {
			return this.reply('There is currently another update in progress');
		}

		GlobalMonitor.updateGitLock = true;
		this.sclog();

		exec(
			'git diff-index --quiet HEAD --',
			function (this: Context, error: ExecException | null): void {
				let cmd = 'git pull --rebase';
				if (error) {
					if (error.code === 1) {
						// The working directory or index have local changes.
						cmd = 'git stash && ' + cmd + ' && git stash pop';
					} else {
						// The most likely case here is that the user does not have
						// `git` on the PATH (which would be error.code === 127).
						this.reply('Error:' + error);
						GlobalMonitor.updateGitLock = false;
						return;
					}
				}
				const entry = 'Running `' + cmd + '`';
				this.reply(entry);
				exec(cmd, function (error, stdout, stderr) {
					('' + stdout + stderr).split('\n').forEach(function (s) {
						this.reply(s);
					});
					GlobalMonitor.updateGitLock = false;
				});
			}.bind(this)
		);
	},

	endlockdown: 'lockdown',
	lockdown: function (arg, by, room, cmd) {
		if (!this.isExcepted) return false;
		this.sclog();
		if (cmd === 'endlockdown') {
			if (!Settings.lockdown) return this.reply('Not in lockdown mode');
			Settings.lockdown = false;
			this.reply('The lockdown was canceled');
		} else {
			if (Settings.lockdown) return this.reply('Already in lockdown mode');
			Settings.lockdown = true;
			this.reply('Bot is now in lockdown mode');
		}
	},

	forcekill: 'kill',
	kill: function (arg, by, room, cmd) {
		if (!this.isExcepted) return false;
		if (cmd === 'forcekill') {
			this.sclog();
			console.log('Forced Kill. By: ' + by);
			process.exit();
		} else {
			if (!Settings.lockdown)
				return this.reply('To kill the process you must use ``' + this.cmdToken + 'lockdown`` first');
			for (const f in Features) {
				const readyToDie = Features[f].readyToDie;
				if (readyToDie) {
					try {
						const err = readyToDie();
						if (err)
							return this.reply(
								'Feature "' +
									f +
									'" not ready | ' +
									err +
									' | Use ``' +
									this.cmdToken +
									'forcekill`` if you want to kill the process anyway'
							);
					} catch (e) {
						return this.reply(
							'Feature "' +
								f +
								'" not ready | ' +
								inspect(e) +
								' | Use ``' +
								this.cmdToken +
								'forcekill`` if you want to kill the process anyway'
						);
					}
				}
			}
			this.sclog();
			console.log('Kill. By: ' + by);
			process.exit();
		}
	},
};
