/*
	Command parser for Pokemon Showdown Bot
*/
import { existsSync, readdirSync } from 'fs';
import { inspect } from 'util';

import { cmdr, errlog, error, info, monitor, ok } from './log';
import { FlatFileManager } from './settings';
import { equalOrHigherRank, highestRank, stripCommands, toId, toRoomid, uncacheTree } from './tools';

const MAX_COMMAND_RECURSION = 10;
const MAX_CMD_FLOOD = 30;
const FLOOD_INTERVAL = 45 * 1000;
const HELP_TIME_INTERVAL = 2 * 60 * 1000;

const COMMANDS_DIR = './commands/';
const FEATURES_DIR = './features/';

interface Room {
	id: string;
	type: string;
	title: string;
	users: string[];
}

interface User {
	room: string;
	ident: string;
	id: string;
	name: string;
	rank: string;
}

export class Context {
	arg: string;
	by: string;
	room: string;
	cmd: string;
	handler: string;
	cmdToken: string;
	roomType: string;
	botName?: string;
	isExcepted: boolean;
	language: string;
	parser: CommandParser;

	constructor(opts: Partial<Omit<Context, 'parser'>>, parser: CommandParser) {
		this.arg = opts.arg || '';
		this.by = opts.by || '';
		this.room = opts.room || 'lobby';
		this.cmd = opts.cmd || '';
		this.handler = opts.handler || '';
		this.cmdToken = opts.cmdToken || '';
		this.roomType = this.room.charAt(0) === ',' ? 'pm' : Bot.rooms[this.room]?.type || 'chat';
		this.botName = Bot.status.nickName;
		this.isExcepted = equalOrHigherRank(this.by, highestRank());
		this.language = (this.roomType === 'chat' && Settings.settings.language?.[this.room]) || Config.language || 'english';
		this.parser = parser;
	}

	send(...args: [string, string | string[], number?] | [string | string[]]): void {
		const interval = args[2] || 2000;
		if (!args[1]) {
			Bot.send(args[0], interval);
		} else {
			const arg1 = args[0] as string;
			const arg2 = args[1];
			if (arg1.charAt(0) !== ',') {
				Bot.sendRoom(arg1, arg2, interval);
			} else {
				const args2Array = Array.isArray(arg2) ? arg2 : [arg2];
				Bot.send(
					args2Array.map((arg) => '|/pm ' + arg1.substr(1) + ',' + arg),
					interval
				);
			}
		}
	}

	sendPM(targetUser: string, data: string | string[]): void {
		this.send(',' + targetUser, data);
	}

	reply(data: string | string[]): void {
		this.send(this.room, data);
	}

	pmReply(data: string | string[]): void {
		this.send(',' + this.by, data);
	}

	restrictReply(data: string | string[], perm?: string): void {
		if (!this.can(perm)) {
			this.pmReply(data);
		} else {
			this.reply(data);
		}
	}

	say(targetRoom: string, data: string | string[]): void {
		this.send(targetRoom, data);
	}

	isRanked(rank: string): boolean {
		return equalOrHigherRank(this.by, rank);
	}

	isRoomRanked(targetRoom: string, rank: string): boolean {
		if (Bot.rooms && Bot.rooms[targetRoom] && Bot.rooms[targetRoom].users) {
			const userIdent = Bot.rooms[targetRoom].users[toId(this.by)] || this.by;
			return equalOrHigherRank(userIdent, rank);
		}
		return this.isRanked(rank);
	}

	can(permission?: string): boolean {
		return Settings.userCan(this.roomType === 'battle' ? 'battle-' : this.room, this.by, permission);
	}

	canSet(permission: string, rank: string): boolean {
		const rankSet =
			Settings.settings.commands?.[this.room]?.[permission] || Config.permissionExceptions[permission] || Config.defaultPermission;

		if (equalOrHigherRank(this.by, rankSet) && equalOrHigherRank(this.by, rank)) return true;
		return false;
	}

	botRanked(rank: string): boolean {
		if (!Bot.rooms[this.room]) return false;
		const ident = Bot.rooms[this.room].users[toId(Bot.status.nickName)];
		if (ident) return equalOrHigherRank(ident, rank);
		return false;
	}

	hasRank(user: string, rank: string, targetRoom?: string): boolean {
		if (!targetRoom) targetRoom = this.room;
		if (Bot.rooms && Bot.rooms[targetRoom] && Bot.rooms[targetRoom].users) {
			const userIdent = Bot.rooms[targetRoom].users[toId(user)] || user;
			return equalOrHigherRank(userIdent, rank);
		}
		return equalOrHigherRank(user, rank);
	}

	getRoom(targetRoom: string): Room | null {
		const room = Bot.rooms[targetRoom];
		if (!room) return null;
		return {
			id: toRoomid(targetRoom),
			type: room.type,
			title: room.title,
			users: Object.values(room.users),
		};
	}

	getUser(user: string, targetRoom: string): User | null {
		if (!Bot.rooms[targetRoom]) return null;
		user = toId(user);
		if (!(user in Bot.rooms[targetRoom].users)) return null;
		return {
			room: targetRoom,
			ident: Bot.rooms[targetRoom].users[user],
			id: toId(Bot.rooms[targetRoom].users[user]),
			name: Bot.rooms[targetRoom].users[user].substr(1),
			rank: Bot.rooms[targetRoom].users[user].charAt(0),
		};
	}

	splitReply(str: string, maxMessageLength = 300): string[] {
		const msgs = [];
		while (str.length > maxMessageLength) {
			msgs.push(str.substr(0, maxMessageLength));
			str = str.substr(maxMessageLength);
		}
		msgs.push(str);
		return msgs;
	}

	trad(data: string): string {
		return Languages.translateCmd(this.handler, data, this.language);
	}

	parse(data: string): void {
		this.parser.parse(this.room, this.by, data);
	}

	sclog(data?: string): void {
		SecurityLog.log(`[${this.room}] [${this.by}] [${this.handler}] ${data || 'Command: ' + this.cmdToken + this.cmd + ' ' + this.arg}`);
	}

	getModule<T extends CommandModuleManager>(moduleClass: new () => T): T {
		return Object.values(this.parser.modules).filter((module) => module instanceof moduleClass)[0] as T;
	}
}

class ResourceMonitor {
	/* PM helper */
	lasthelp: Record<string, number> = {};
	counthelp(user: string): boolean {
		user = toId(user);
		const now = Date.now();
		for (const i in this.lasthelp) {
			if (now - this.lasthelp[i] >= HELP_TIME_INTERVAL) delete this.lasthelp[i];
		}
		if (this.lasthelp[user]) return false;
		this.lasthelp[user] = now;
		return true;
	}
	/* Cmd Usage */
	cmdusage: Record<string, number> = {};
	cmdtimes: Record<string, number> = {};
	lockedlist: Record<string, number> = {};
	countcmd(user: string): boolean {
		user = toId(user);
		const now = Date.now();
		if (!this.cmdtimes[user]) {
			this.cmdusage[user] = 1;
			this.cmdtimes[user] = now;
			return false;
		}
		const duration = now - this.cmdtimes[user];
		if (user in this.cmdusage && duration < FLOOD_INTERVAL) {
			this.cmdusage[user]++;
			if (this.cmdusage[user] < MAX_CMD_FLOOD && this.cmdusage[user] % 10 === 0 && duration < 12 * 1000) {
				monitor('User ' + user + ' has used ' + this.cmdusage[user] + ' commands in the last ' + duration + ' ms');
				SecurityLog.log('User ' + user + ' has used ' + this.cmdusage[user] + ' commands in the last ' + duration + ' ms');
			} else if (this.cmdusage[user] < MAX_CMD_FLOOD && this.cmdusage[user] % 20 === 0 && duration < 24 * 1000) {
				monitor('User ' + user + ' has used ' + this.cmdusage[user] + ' commands in the last ' + duration + ' ms');
				SecurityLog.log('User ' + user + ' has used ' + this.cmdusage[user] + ' commands in the last ' + duration + ' ms');
			} else if (this.cmdusage[user] >= MAX_CMD_FLOOD) {
				this.lock(user);
				monitor(`User ${user} has been ignored (command flood: ${this.cmdusage[user]} commands in the last ${duration} ms)`);
				SecurityLog.log(
					`User ${user} has been ignored (command flood: ${this.cmdusage[user]} commands in the last ${duration} ms)`
				);
				return true;
			}
		} else {
			this.cmdusage[user] = 1;
			this.cmdtimes[user] = now;
		}
		return false;
	}
	lock(user: string): void {
		user = toId(user);
		this.lockedlist[user] = 1;
	}
	unlock(user: string): void {
		user = toId(user);
		if (this.lockedlist[user]) delete this.lockedlist[user];
	}
	isLocked(user: string): number {
		return this.lockedlist[toId(user)];
	}
}

export type Command = (this: Context, sargs: string, by: string, room: string, cmd: string) => void;

export interface CommandModuleManager {
	init(): void;
}

export class CommandParser {
	commands: Record<string, string | Command> = {};
	modules: Record<string, CommandModuleManager> = {};
	dynCommands: Record<string, string> = {};
	dynCommandsFFM = new FlatFileManager(AppOptions.data + 'commands.json');
	tempVar = '';
	commandTokens: string[] = [];
	resourceMonitor = new ResourceMonitor();

	constructor() {
		try {
			this.dynCommands = this.dynCommandsFFM.readObj();
		} catch (e: any) {
			errlog(e.stack);
			error('Could not import dynamic commands: ' + inspect(e));
		}

		this.reloadTokens();
	}

	/* Load commands */
	loadCommands(reloading?: boolean): string[] {
		const errs: string[] = [];
		const commandFiles = readdirSync(COMMANDS_DIR)
			.filter((file) => file.endsWith('.ts'))
			.map((file) => COMMANDS_DIR + file);
		const featureCommandFiles = readdirSync(FEATURES_DIR)
			.map((file) => FEATURES_DIR + file + '/commands.ts')
			.filter((path) => existsSync(path));
		[...commandFiles, ...featureCommandFiles].forEach((file: string): void => {
			if (reloading) uncacheTree(file);
			try {
				const { commands, manager } = require(file) as {
					commands: [];
					manager?: new () => CommandModuleManager;
				};
				Object.assign(this.commands, commands);
				if (manager) {
					this.modules[file] = new manager();
					this.modules[file].init();
				}
			} catch (e: any) {
				errlog(e.stack);
				error('Could not import commands file: ' + file + ' | ' + inspect(e));
				errs.push(file);
			}
		});
		if (reloading) info('Commands reloaded' + (errs.length ? '. Errors: ' + errs.join(', ') : ''));
		else ok('Loaded commands' + (errs.length ? '. Errors: ' + errs.join(', ') : ''));
		return errs;
	}

	saveDynCmds(): void {
		this.dynCommandsFFM.writeObj(this.dynCommands);
	}

	/* Parser */

	reloadTokens(): void {
		this.commandTokens = exports.commandTokens = [];
		if (Config.commandTokens && Config.commandTokens.length) {
			for (let i = 0; i < Config.commandTokens.length; i++) this.commandTokens.push(Config.commandTokens[i]);
		}
		if (typeof Config.commandChar === 'string') this.commandTokens.push(Config.commandChar);
		if (!this.commandTokens.length) {
			error('No command Tokens, using "." by default');
			this.commandTokens = exports.commandTokens = ['.'];
		}
	}

	parse(room: string, by: string, msg: string): void {
		if (!equalOrHigherRank(by, highestRank())) {
			if (this.resourceMonitor.isLocked(by)) return;
		}
		if (msg.substr(0, 8) === '/invite ' && equalOrHigherRank(by, '%')) {
			Bot.say('', '/join ' + msg.substr(8));
			SecurityLog.log('User ' + by + ' used /invite ' + msg.substr(8));
			return;
		}

		if (Settings.callParseFilters(room, by, msg)) return;

		let cmdToken = null;

		for (let i = 0; i < this.commandTokens.length; i++) {
			if (typeof this.commandTokens[i] === 'string' && msg.substr(0, this.commandTokens[i].length) === this.commandTokens[i]) {
				cmdToken = this.commandTokens[i];
				break;
			}
		}

		if (!cmdToken) {
			if (room.charAt(0) === ',' && msg.charAt(0) !== '/' && Config.pmhelp && this.resourceMonitor.counthelp(by)) {
				Bot.pm(by, stripCommands(Config.pmhelp.replace(/#USER/g, by.substr(1))));
			}
			return;
		}

		const toParse = msg.substr(cmdToken.length);
		const spaceIndex = toParse.indexOf(' ');

		let cmd, args;
		if (spaceIndex === -1) {
			cmd = toParse;
			args = '';
		} else {
			cmd = toParse.substr(0, spaceIndex);
			args = toParse.substr(spaceIndex + 1);
		}

		cmd = cmd.toLowerCase();

		if (room.charAt(0) !== ',' && ['unsleep', 'wake'].indexOf(cmd) < 0 && Settings.isSleeping(room)) return;

		if (!this.commands[cmd] && this.dynCommands[toId(cmd)]) {
			args = cmd;
			cmd = 'dyn';
		}

		if (this.commands[cmd]) {
			let handler = cmd;
			let loopBreaker = 0;
			while (typeof this.commands[handler] === 'string' && loopBreaker++ < MAX_COMMAND_RECURSION) {
				const alias = this.commands[handler];
				if (typeof alias === 'string') handler = alias;
			}
			const command = this.commands[handler];
			if (typeof command === 'function') {
				const opts = {
					arg: args,
					by: by,
					room: room,
					cmd: cmd,
					handler: handler,
					cmdToken: cmdToken,
				};
				const context = new Context(opts, this);
				try {
					if (!equalOrHigherRank(by, highestRank())) {
						if (this.resourceMonitor.countcmd(by)) return;
					}
					cmdr(handler + ' | arg: ' + args + ' | by: ' + by + ' | room: ' + room + ' | cmd: ' + cmd);
					command.call(context, args, by, room, cmd);
				} catch (e: any) {
					errlog(e.stack);
					error('Command crash: ' + cmd + ' | by: ' + by + ' | room: ' + room + ' | ' + inspect(e));
					SecurityLog.log('COMMAND CRASH: ' + e.message + '\ncmd: ' + cmd + ' | by: ' + by + ' | room: ' + room + '\n' + e.stack);
					Bot.say(room, 'The command crashed: ' + inspect(e).toString().split('\n').join(' '));
				}
			} else {
				error('unkwown command type: ' + cmd + ' = ' + inspect(this.commands[handler]));
			}
		}
	}
}
