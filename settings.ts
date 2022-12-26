/*
	Settings Manager
*/
import { existsSync, PathLike, readFile, readFileSync, rename, unlinkSync, writeFile, writeFileSync } from "fs";
import { inspect } from "util";
import { debug, errlog, error, ok } from "./console-reports";
import { toId } from "./tools";

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
	};

	readObj(): any {
		return JSON.parse(this.read());
	};

	readObjSafe(): any {
		try {
			return this.readObj();
		} catch (e: any) {
			errlog(e.stack);
			error("Could not import read object: " + inspect(e));
		}
	};

	write(data: string): void {
		const self = this;
		const finishWriting = () => {
			self.writing = false;
			if (self.writePending) {
				self.writePending = false;
				if (self.dataPending) self.write(self.dataPending);
				self.dataPending = null;
			}
		};
		if (self.writing) {
			self.writePending = true;
			self.dataPending = data;
			return;
		}
		writeFile(self.file + '.0', data, function () {
			// rename is atomic on POSIX, but will throw an error on Windows
			rename(self.file + '.0', self.file, function (err) {
				if (err) {
					// This should only happen on Windows.
					writeFile(self.file, data, finishWriting);
					return;
				}
				finishWriting();
			});
		});
	};

	writeObj(obj: any): void {
		this.write(JSON.stringify(obj));
	};
};

class User {
	name: string;
	id: string;
	alts: User[];
	lastSeen: {
		name: string;
		time: number;
		room?: string;
		action?: string;
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
		if (!this.alts.some(a => a.id === altId)) {
			this.alts.push(alt);
			this.alts.forEach(a => a.markAlt(alt));
		}
	};

	setOnline(): void {
		this.online = true;
	};

	setOffline(): void {
		this.online = false;
		this.rooms = {};
	};

	reportSeen(room: string, action: string, args: string[] = []): void {
		const dSeen: User['lastSeen'] = { name: this.name, time: Date.now() };
		if (!Config.privateRooms.includes(room)) {
			dSeen.room = room;
			dSeen.action = action;
			dSeen.args = args;
		}
		this.lastSeen = dSeen;
	};
};

class UserManager {
	users: Record<string, User> = {};

	isOnline(user: string): boolean {
		var userid = toId(user);
		if (!this.users[userid]) return false;
		return !!this.users[userid].online;
	};

	getName(user: string): string {
		var userid = toId(user);
		if (!this.users[userid]) return userid;
		return this.users[userid].name;
	};

	getSeen(user: string): User['lastSeen'] {
		var userid = toId(user);
		if (!this.users[userid]) return null;
		return this.users[userid].lastSeen;
	};

	getAlts(user: string): string[] {
		var userid = toId(user);
		if (!this.users[userid]) return [];
		return this.users[userid].alts.map(alt => alt.id);
	};

	reportJoin(user: string, room: string): void {
		if (Config.disableSeen) return;
		var userid = toId(user);
		if (!this.users[userid]) {
			this.users[userid] = new User(user.substr(1));
		}
		var userObj = this.users[userid];
		userObj.setOnline();
		userObj.rooms[room] = { group: user.charAt(0) };
		userObj.reportSeen(room, 'j', []);
	};

	reportChat(user: string, room: string): void {
		if (Config.disableSeen) return;
		var userid = toId(user);
		if (!this.users[userid]) {
			this.users[userid] = new User(user.substr(1));
		}
		var userObj = this.users[userid];
		userObj.setOnline();
		userObj.reportSeen(room, 'c', []);
	};

	reportLeave(user: string, room: string): void {
		if (Config.disableSeen) return;
		var userid = toId(user);
		if (!this.users[userid]) {
			this.users[userid] = new User(user.substr(1));
		}
		var userObj = this.users[userid];
		if (userObj.rooms[room]) delete userObj.rooms[room];
		userObj.reportSeen(room, 'l', []);
		if (Object.keys(userObj.rooms).length > 0) {
			userObj.setOnline();
		} else {
			userObj.setOffline();
		}
	};

	reportRename(user: string, newName: string, room: string): void {
		if (Config.disableSeen) return;
		var userid = toId(user);
		if (!this.users[userid]) {
			this.users[userid] = new User(user.substr(1));
		}
		var userObj = this.users[userid];
		if (toId(user) === toId(newName)) {
			// Just a name change
			userObj.name = newName.substr(1);
			userObj.rooms[room] = { group: newName.charAt(0) };
		} else {
			// User change
			const newUserid = toId(newName);
			userObj.setOffline();
			userObj.reportSeen(room, 'n', [newName.substr(1)]);
			if (!this.users[newUserid]) {
				this.users[newUserid] = new User(newName.substr(1));
			}
			if (!Config.disableAlts) userObj.markAlt(this.users[newUserid]);
			var newUserObj = this.users[newUserid];
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
};

export class SettingsManager {
	settings: {
		commands?: Record<string, Record<string, string>>;
		jointours?: Record<string, boolean>;
		language?: Record<string, string>;
		sleep?: Record<string, boolean>;
	};
	settingsFFM = new FlatFileManager(AppOptions.data + 'settings.json');
	permissions: Record<string, number> = {};
	parserFilters: Record<string, (room: string, by: string, msg: string) => boolean> = {};
	userManager: UserManager;
	httpCache: Record<string, { url: string, time: number }> = {};
	cacheFFM = new FlatFileManager(AppOptions.data + '_temp/' + 'http-cache.json');
	lockdown: boolean = false;
	package: Record<string, any>;

	constructor() {
		try {
			this.settings = this.settingsFFM.readObj();
		} catch (e: any) {
			errlog(e.stack);
			error("Could not import settings: " + inspect(e));
			this.settings = {};
		}

		try {
			this.httpCache = this.httpCache = this.cacheFFM.readObj();
		} catch (e: any) {
			errlog(e.stack);
			error("Could not import http cache: " + inspect(e));
		}

		this.userManager = new UserManager();

		this.package = require('./package.json');
		ok('Loaded Settings. Bot version: ' + this.package.version);
	}

	save(): void {
		this.settingsFFM.writeObj(this.settings);
	};

	/*
	 * Permissions
	 */

	userCan(room: string, user: string, permission: string): boolean {
		var rank;
		if (!this.settings.commands || !this.settings.commands[room] || typeof this.settings.commands[room][permission] === "undefined") {
			rank = Config.defaultPermission;
			if (Config.permissionExceptions[permission]) rank = Config.permissionExceptions[permission];
		} else {
			rank = this.settings.commands[room][permission];
		}
		return Tools.equalOrHigherRank(user, rank);
	};

	addPermissions(perms: string[]): void {
		for (let i = 0; i < perms.length; i++) {
			this.permissions[perms[i]] = 1;
		}
	};

	setPermission(room: string, perm: string, rank: string): void {
		if (!this.settings.commands) this.settings.commands = {};
		if (!this.settings.commands[room]) this.settings.commands[room] = {};
		this.settings.commands[room][perm] = rank;
	};

	/*
	 * Configuration
	 */

	callParseFilters(room: string, by: string, msg: string): boolean {
		return Object.values(this.parserFilters).some(f => f.call(this, room, by, msg));
	};

	addParseFilter(id: string, func: (room: string, by: string, msg: string) => boolean): boolean {
		this.parserFilters[id] = func;
		return true;
	};

	deleteParseFilter(id: string): boolean {
		if (!this.parserFilters[id]) return false;
		delete this.parserFilters[id];
		return true;
	};

	isSleeping(room: string): boolean {
		if (this.settings.sleep && typeof this.settings.sleep[room] === "boolean") return this.settings.sleep[room];
		if (Config.ignoreRooms) return Config.ignoreRooms.includes(room);
		return false;
	};

	sleepRoom(room: string): boolean {
		if (this.isSleeping(room)) return false;
		if (!this.settings.sleep) this.settings.sleep = {};
		this.settings.sleep[room] = true;
		this.save();
		return true;
	};

	unsleepRoom(room: string): boolean {
		if (!this.isSleeping(room)) return false;
		if (!this.settings.sleep) this.settings.sleep = {};
		this.settings.sleep[room] = false;
		this.save();
		return true;
	};

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
	};

	/*
	 * Cache System
	 */

	httpGetAndCache(url: string, callback?: (data: string | null, error: NodeJS.ErrnoException | null) => void, onDownload?: () => void): void {
		for (let i in this.httpCache) {
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
		Tools.httpGet(url, (function (this: SettingsManager, data, err) {
			if (err) {
				if (typeof callback === "function") callback(null, err);
				return;
			}
			let file: string;
			do {
				file = "cache.http." + Tools.generateRandomNick(5) + ".tmp";
			} while (this.httpCache[file]);
			writeFile(AppOptions.data + '_temp/' + file, data, (function (this: SettingsManager, err: NodeJS.ErrnoException | null) {
				if (!err) {
					this.httpCache[file] = { url: url, time: Date.now() };
					this.cacheFFM.writeObj(this.httpCache);
				}
				if (typeof callback === "function") callback(data, null);
			}).bind(this));
		}).bind(this));
	};

	unCacheUrl(url: string | RegExp | true): void {
		var uncache, changed = false;
		for (var file in this.httpCache) {
			uncache = false;
			if (typeof url === "string") {
				if (url === this.httpCache[file].url) uncache = true;
			} else if (typeof url === "object" && url instanceof RegExp) {
				if (url.test(this.httpCache[file].url)) uncache = true;
			} else if (url === true) {
				uncache = true;
			}
			if (uncache) {
				try {
					unlinkSync(AppOptions.data + '_temp/' + file);
				} catch (err: any) {
					debug(err.stack);
					debug("Could not remove cache file: " + AppOptions.data + '_temp/' + file);
				}
				delete this.httpCache[file];
				changed = true;
			}
		}
		if (changed) this.cacheFFM.writeObj(this.httpCache);
	};
};