/*
	Settings Manager
*/
import { existsSync, PathLike, readFile, readFileSync, rename, unlinkSync, writeFile, writeFileSync } from 'fs';
import { inspect } from 'util';

import { ConfigType, LeaderboardConfig } from './config-tools';
import { debug, errlog, error, ok } from './log';
import type PackageJsonType from './package.json';
import { equalOrHigherRank, generateRandomNick, httpGet, toId } from './tools';

export class FlatFileManager {
	file: PathLike;
	writing: boolean;
	writePending: boolean;
	dataPending: string | null;

	constructor(file: PathLike) {
		this.file = file;
		if (!existsSync(file)) writeFileSync(file, '{}');
		this.writing = false;
		this.writePending = false;
		this.dataPending = null;
	}

	read(): string {
		return readFileSync(this.file).toString();
	}

	readObj(): any {
		return JSON.parse(this.read());
	}

	readObjSafe(): any {
		try {
			return this.readObj();
		} catch (e: any) {
			errlog(e.stack);
			error('Could not import read object: ' + inspect(e));
		}
	}

	write(data: string): void {
		const finishWriting = ((): void => {
			this.writing = false;
			if (this.writePending) {
				this.writePending = false;
				if (this.dataPending) this.write(this.dataPending);
				this.dataPending = null;
			}
		}).bind(this);
		if (this.writing) {
			this.writePending = true;
			this.dataPending = data;
			return;
		}
		writeFile(
			this.file + '.0',
			data,
			((): void => {
				// rename is atomic on POSIX, but will throw an error on Windows
				rename(
					this.file + '.0',
					this.file,
					((err: NodeJS.ErrnoException | null): void => {
						if (err) {
							// This should only happen on Windows.
							writeFile(this.file, data, finishWriting);
							return;
						}
						finishWriting();
					}).bind(this)
				);
			}).bind(this)
		);
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	writeObj(obj: any): void {
		this.write(JSON.stringify(obj));
	}
}

type UserAction = 'j' | 'l' | 'c' | 'n';

class User {
	name: string;
	id: string;
	alts: User[];
	lastSeen: {
		name: string;
		time: number;
		room?: string;
		action?: UserAction;
		args?: string[];
	} | null;
	online: boolean;
	rooms: Record<string, { group: string }>;

	constructor(name: string) {
		this.name = name;
		this.id = toId(name);
		this.alts = [];
		this.lastSeen = null;
		this.online = false;
		this.rooms = {};
	}

	markAlt(alt: User): void {
		const altId = toId(alt.id);
		if (altId === this.id) return;
		if (!this.alts.some((a) => a.id === altId)) {
			this.alts.push(alt);
			this.alts.forEach((a) => a.markAlt(alt));
		}
	}

	setOnline(): void {
		this.online = true;
	}

	setOffline(): void {
		this.online = false;
		this.rooms = {};
	}

	reportSeen(room: string, action: string, args: string[] = []): void {
		const dSeen: User['lastSeen'] = { name: this.name, time: Date.now() };
		if (!Config.privateRooms.includes(room)) {
			dSeen.room = room;
			if (action === 'j' || action === 'l' || action === 'c' || action === 'n') dSeen.action = action;
			dSeen.args = args;
		}
		this.lastSeen = dSeen;
	}
}

class UserManager {
	users: Record<string, User> = {};

	isOnline(user: string): boolean {
		const userid = toId(user);
		if (!this.users[userid]) return false;
		return !!this.users[userid].online;
	}

	getName(user: string): string {
		const userid = toId(user);
		if (!this.users[userid]) return userid;
		return this.users[userid].name;
	}

	getSeen(user: string): User['lastSeen'] {
		const userid = toId(user);
		if (!this.users[userid]) return null;
		return this.users[userid].lastSeen;
	}

	getAlts(user: string): string[] {
		const userid = toId(user);
		if (!this.users[userid]) return [];
		return this.users[userid].alts.map((alt) => alt.id);
	}

	reportJoin(user: string, room: string): void {
		if (Config.disableSeen) return;
		const userid = toId(user);
		if (!this.users[userid]) {
			this.users[userid] = new User(user.substring(1));
		}
		const userObj = this.users[userid];
		userObj.setOnline();
		userObj.rooms[room] = { group: user.charAt(0) };
		userObj.reportSeen(room, 'j', []);
	}

	reportChat(user: string, room: string): void {
		if (Config.disableSeen) return;
		const userid = toId(user);
		if (!this.users[userid]) {
			this.users[userid] = new User(user.substring(1));
		}
		const userObj = this.users[userid];
		userObj.setOnline();
		userObj.reportSeen(room, 'c', []);
	}

	reportLeave(user: string, room: string): void {
		if (Config.disableSeen) return;
		const userid = toId(user);
		if (!this.users[userid]) {
			this.users[userid] = new User(user.substring(1));
		}
		const userObj = this.users[userid];
		if (userObj.rooms[room]) delete userObj.rooms[room];
		userObj.reportSeen(room, 'l', []);
		if (Object.keys(userObj.rooms).length > 0) {
			userObj.setOnline();
		} else {
			userObj.setOffline();
		}
	}

	reportRename(user: string, newName: string, room: string): void {
		if (Config.disableSeen) return;
		const userid = toId(user);
		if (!this.users[userid]) {
			this.users[userid] = new User(user.substring(1));
		}
		const userObj = this.users[userid];
		if (toId(user) === toId(newName)) {
			// Just a name change
			userObj.name = newName.substring(1);
			userObj.rooms[room] = { group: newName.charAt(0) };
		} else {
			// User change
			const newUserid = toId(newName);
			userObj.setOffline();
			userObj.reportSeen(room, 'n', [newName.substring(1)]);
			if (!this.users[newUserid]) {
				this.users[newUserid] = new User(newName.substring(1));
			}
			if (!Config.disableAlts) userObj.markAlt(this.users[newUserid]);
			const newUserObj = this.users[newUserid];
			newUserObj.setOnline();
			newUserObj.rooms[room] = { group: newName.charAt(0) };
			if (!Config.disableAlts) {
				newUserObj.markAlt(this.users[userid]);
				// merge alts
				for (let i = 0; i < userObj.alts.length; i++) {
					newUserObj.markAlt(userObj.alts[i]);
				}
			}
			newUserObj.reportSeen(room, 'j', []);
		}
	}
}

interface Autopromote {
	enabled: boolean;
	users: Record<string, string>;
	all: string | null;
}

interface PmWelcomeMessage {
	enabled: boolean;
	msg: string | null;
}

export class SettingsManager {
	settings: {
		autoban?: Record<string, Record<string, boolean>>;
		autopromote?: Record<string, Autopromote>;
		bannedphrases?: Record<string, Record<string, boolean>>;
		commands?: Record<string, Record<string, string>>;
		deftier?: Record<string, string>;
		inapropiatephrases?: Record<string, Record<string, boolean>>;
		joinphrases?: Record<string, Record<string, string>>;
		jointours?: Record<string, boolean>;
		jpdisable?: Record<string, boolean>;
		language?: Record<string, string>;
		leaderboards?: Record<string, LeaderboardConfig>;
		modding?: Record<string, ConfigType['moderation']['modDefault']>;
		modexception?: Record<string, string>;
		regexautoban?: Record<string, Record<string, boolean>>;
		pmwmsg?: Record<string, PmWelcomeMessage>;
		sleep?: Record<string, boolean>;
		suspect?: Record<string, { poke: string; link?: string }>;
		usagelink?: string;
		zerotol?: Record<string, string>;
	} = {};
	settingsFFM = new FlatFileManager(AppOptions.data + 'settings.json');
	permissions: Record<string, boolean> = {};
	parserFilters: Record<string, (room: string, by: string, msg: string) => boolean> = {};
	userManager: UserManager;
	httpCache: Record<string, { url: string; time: number }> = {};
	cacheFFM = new FlatFileManager(AppOptions.data + '_temp/' + 'http-cache.json');
	lockdown = false;
	package: typeof PackageJsonType;

	constructor() {
		try {
			this.settings = this.settingsFFM.readObj();
		} catch (e: any) {
			errlog(e.stack);
			error('Could not import settings: ' + inspect(e));
		}

		try {
			this.httpCache = this.httpCache = this.cacheFFM.readObj();
		} catch (e: any) {
			errlog(e.stack);
			error('Could not import http cache: ' + inspect(e));
		}

		this.userManager = new UserManager();

		this.package = require('./package.json');
		ok('Loaded Settings. Bot version: ' + this.package.version);
	}

	save(): void {
		this.settingsFFM.writeObj(this.settings);
	}

	/*
	 * Permissions
	 */

	userCan(room: string, user: string, permission?: string): boolean {
		const rank =
			(permission && (this.settings.commands?.[room]?.[permission] || Config.permissionExceptions[permission])) ||
			Config.defaultPermission;
		return equalOrHigherRank(user, rank);
	}

	addPermissions(perms: string[]): void {
		for (let i = 0; i < perms.length; i++) {
			this.permissions[perms[i]] = true;
		}
	}

	setPermission(room: string, perm: string, rank: string): void {
		if (!this.settings.commands) this.settings.commands = {};
		if (!this.settings.commands[room]) this.settings.commands[room] = {};
		this.settings.commands[room][perm] = rank;
	}

	/*
	 * Configuration
	 */

	callParseFilters(room: string, by: string, msg: string): boolean {
		return Object.values(this.parserFilters).some((f) => f.call(this, room, by, msg));
	}

	addParseFilter(id: string, func: (room: string, by: string, msg: string) => boolean): boolean {
		this.parserFilters[id] = func;
		return true;
	}

	deleteParseFilter(id: string): boolean {
		if (!this.parserFilters[id]) return false;
		delete this.parserFilters[id];
		return true;
	}

	isSleeping(room: string): boolean {
		if (this.settings.sleep && typeof this.settings.sleep[room] === 'boolean') return this.settings.sleep[room];
		if (Config.ignoreRooms) return Config.ignoreRooms.includes(room);
		return false;
	}

	sleepRoom(room: string): boolean {
		if (this.isSleeping(room)) return false;
		if (!this.settings.sleep) this.settings.sleep = {};
		this.settings.sleep[room] = true;
		this.save();
		return true;
	}

	unsleepRoom(room: string): boolean {
		if (!this.isSleeping(room)) return false;
		if (!this.settings.sleep) this.settings.sleep = {};
		this.settings.sleep[room] = false;
		this.save();
		return true;
	}

	applyConfig(): void {
		Bot.opts.server = Config.server;
		Bot.opts.port = Config.port;
		Bot.opts.loginServer = 'https://play.pokemonshowdown.com/~~' + Config.serverid + '/action.php';
		Bot.opts.serverid = Config.serverid;
		Bot.opts.connectionTimeout = Config.connectionTimeout;
		Bot.opts.nickName = Config.nick;
		Bot.opts.pass = Config.pass;
		Bot.opts.showErrors = Config.debug?.debug ?? true;
		Bot.opts.debug = Config.debug?.debug ?? true;
	}

	/*
	 * Cache System
	 */

	httpGetAndCache(
		url: string,
		callback?: (data: string | null, error: NodeJS.ErrnoException | null) => void,
		onDownload?: () => void
	): void {
		for (const i in this.httpCache) {
			if (this.httpCache[i].url === url) {
				readFile(AppOptions.data + '_temp/' + i, (err, data) => {
					if (err) {
						Settings.unCacheUrl(url);
						if (callback) callback(null, err);
						return;
					}
					if (callback) callback(data.toString(), null);
				});
				return;
			}
		}
		if (onDownload) onDownload();
		httpGet(
			url,
			((data: string | null, err: Error | null): void => {
				if (err) {
					if (callback) callback(null, err);
					return;
				}
				let file: string;
				do {
					file = 'cache.http.' + generateRandomNick(5) + '.tmp';
				} while (this.httpCache[file]);
				if (!data) return;
				writeFile(
					AppOptions.data + '_temp/' + file,
					data,
					((err: NodeJS.ErrnoException | null): void => {
						if (!err) {
							this.httpCache[file] = { url: url, time: Date.now() };
							this.cacheFFM.writeObj(this.httpCache);
						}
						if (callback) callback(data, null);
					}).bind(this)
				);
			}).bind(this)
		);
	}

	unCacheUrl(url: string | RegExp | true): void {
		let uncache,
			changed = false;
		for (const file in this.httpCache) {
			uncache = false;
			if (typeof url === 'string') {
				if (url === this.httpCache[file].url) uncache = true;
			} else if (typeof url === 'object' && url instanceof RegExp) {
				if (url.test(this.httpCache[file].url)) uncache = true;
			} else if (url === true) {
				uncache = true;
			}
			if (uncache) {
				try {
					unlinkSync(AppOptions.data + '_temp/' + file);
				} catch (err: any) {
					debug(err.stack);
					debug('Could not remove cache file: ' + AppOptions.data + '_temp/' + file);
				}
				delete this.httpCache[file];
				changed = true;
			}
		}
		if (changed) this.cacheFFM.writeObj(this.httpCache);
	}
}
