/*
 * Tools file
 */
import { watchFile as fsWatchFile } from 'fs';
import * as http from 'http';
import * as https from 'https';

import { Intl } from './bll/intl';
import { ConfigType } from './config-tools';
import { typechart } from './data/typechart';
import { errlog } from './log';

declare global {
	interface String {
		escapeHTML(): string;
	}
}

/* String utils */

export function toId(text?: string): string {
	if (!text) return '';
	return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}
global.toId = toId;

export function toRoomid(roomid: string): string {
	return roomid.replace(/[^a-zA-Z0-9-]+/g, '').toLowerCase();
}
global.toRoomid = toRoomid;

const DefaultPermissions: ConfigType['globalPermissions'] = {
	voice: '+',
	driver: '%',
	moderator: '@',
	roomowner: '#',
	admin: '~',
};

export type Stat = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';

const Stats: Stat[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

const BattleStatIDs: Record<string, Stat> = {
	HP: 'hp',
	hp: 'hp',
	Atk: 'atk',
	atk: 'atk',
	Def: 'def',
	def: 'def',
	SpA: 'spa',
	SAtk: 'spa',
	SpAtk: 'spa',
	spa: 'spa',
	SpD: 'spd',
	SDef: 'spd',
	SpDef: 'spd',
	spd: 'spd',
	Spe: 'spe',
	Spd: 'spe',
	spe: 'spe',
};

const BattleStatNames: Record<Stat, string> = {
	hp: 'HP',
	atk: 'Atk',
	def: 'Def',
	spa: 'SpA',
	spd: 'SpD',
	spe: 'Spe',
};

export interface PokeSet {
	name: string;
	species: string;
	item: string;
	ability: string;
	moves: string[];
	nature: string;
	evs?: Record<Stat, number>;
	gender?: string;
	ivs?: Partial<Record<Stat, number>>;
	shiny?: boolean;
	level?: number;
	happiness?: number;
	pokeball?: string;
	hpType?: string;
	gigantamax?: boolean;
	dynamaxLevel?: number;
	teraType?: string;
}

export class Tools {
	watchFile = fsWatchFile;
	intl = new Intl();

	toName(text?: string): string {
		if (!text) return '';
		return text.trim();
	}

	addLeftZero(num: number, numOfZeros: number): string {
		let str = num.toString();
		while (str.length < numOfZeros) str = '0' + str;
		return str;
	}

	escapeHTML(str?: string): string {
		if (!str) return '';
		return ('' + str).escapeHTML();
	}

	generateRandomNick(numChars: number): string {
		const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
		let str = '';
		for (let i = 0, l = chars.length; i < numChars; i++) {
			str += chars.charAt(~~(Math.random() * l));
		}
		return str;
	}

	levenshtein(s: string, t: string, l: number): number {
		// s = string 1, t = string 2, l = limit
		// Original levenshtein distance function by James Westgate, turned out to be the fastest
		const d: number[][] = []; // 2d matrix
		// Step 1
		const n = s.length;
		const m = t.length;
		if (n === 0) return m;
		if (m === 0) return n;
		if (l && Math.abs(m - n) > l) return Math.abs(m - n);
		// Create an array of arrays in javascript (a descending loop is quicker)
		for (let i = n; i >= 0; i--) d[i] = [];
		// Step 2
		for (let i = n; i >= 0; i--) d[i][0] = i;
		for (let j = m; j >= 0; j--) d[0][j] = j;
		// Step 3
		for (let i = 1; i <= n; i++) {
			const s_i = s.charAt(i - 1);
			// Step 4
			for (let j = 1; j <= m; j++) {
				// Check the jagged ld total so far
				if (i === j && d[i][j] > 4) return n;
				const t_j = t.charAt(j - 1);
				const cost = s_i === t_j ? 0 : 1; // Step 5
				// Calculate the minimum
				let mi = d[i - 1][j] + 1;
				const b = d[i][j - 1] + 1;
				const c = d[i - 1][j - 1] + cost;
				if (b < mi) mi = b;
				if (c < mi) mi = c;
				d[i][j] = mi; // Step 6
			}
		}
		// Step 7
		return d[n][m];
	}

	/* Commands and Permissions */

	stripCommands(text: string): string {
		return (text.trim().charAt(0) === '/' ? '/' : text.trim().charAt(0) === '!' ? ' ' : '') + text.trim();
	}

	getTargetRoom(arg?: string): { arg: string; room: string } | null {
		if (!arg) return null;
		if (arg.indexOf('[') !== 0) return null;
		if (arg.indexOf(']') < 0) return null;
		const newArg = toRoomid(arg.substr(arg.indexOf('[') + 1, arg.indexOf(']') - arg.indexOf('[') - 1));
		const room = arg.substr(arg.indexOf(']') + 1);
		return { arg: newArg, room };
	}

	equalOrHigherRank(userIdentity: string, rank: string | true): boolean {
		if (typeof rank === 'string' && rank.length > 1) rank = this.getGroup(rank);
		if (rank === ' ') return true;
		if (!Config.ranks) Config.ranks = [];
		const userId = toId(userIdentity);
		let userRank: string | true = '';
		if (userId in Config.exceptions) {
			userRank = Config.exceptions[userId];
		} else {
			userRank = userIdentity.charAt(0);
		}
		if (userRank === true) return true;
		if (rank === true) return false;
		if (Config.ranks.indexOf(userRank) === -1) return false;
		if (Config.ranks.indexOf(userRank) >= Config.ranks.indexOf(rank)) return true;
		return false;
	}

	getGroup(perm?: string): string | true {
		if (!perm) return true;
		return Config.globalPermissions[perm] || DefaultPermissions[perm] || true;
	}

	/* Time and Dates */

	getDateString(): string {
		const date = new Date();
		return (
			this.addLeftZero(date.getDate(), 2) +
			'/' +
			this.addLeftZero(date.getMonth() + 1, 2) +
			'/' +
			this.addLeftZero(date.getFullYear(), 4) +
			' ' +
			this.addLeftZero(date.getHours(), 2) +
			':' +
			this.addLeftZero(date.getMinutes(), 2) +
			':' +
			this.addLeftZero(date.getSeconds(), 2)
		);
	}

	getTimeAgo(time: number, lang?: string): string {
		time = Date.now() - time;
		time = Math.round(time / 1000); // rounds to nearest second
		const seconds = time % 60;
		let times = [];
		const trans = (data: string): string => {
			if (!lang) lang = Config.language || 'english';
			return this.intl.translateGlobal('time', data, lang);
		};
		if (seconds) times.push(String(seconds) + ' ' + (seconds === 1 ? trans('second') : trans('seconds')));
		let minutes, hours, days;
		if (time >= 60) {
			time = (time - seconds) / 60; // converts to minutes
			minutes = time % 60;
			if (minutes)
				times = [String(minutes) + ' ' + (minutes === 1 ? trans('minute') : trans('minutes'))].concat(times);
			if (time >= 60) {
				time = (time - minutes) / 60; // converts to hours
				hours = time % 24;
				if (hours) times = [String(hours) + ' ' + (hours === 1 ? trans('hour') : trans('hours'))].concat(times);
				if (time >= 24) {
					days = (time - hours) / 24; // you can probably guess this one
					if (days) times = [String(days) + ' ' + (days === 1 ? trans('day') : trans('days'))].concat(times);
				}
			}
		}
		if (!times.length) times.push('0 ' + trans('seconds'));
		return times.join(', ');
	}

	/* File system utils */

	/**
	 * @param path A path to a file from bot root
	 */
	uncacheTree(root: string): void {
		let uncache = [require.resolve(root)];
		do {
			let newuncache: string[] = [];
			for (let i = 0; i < uncache.length; ++i) {
				const cache = require.cache[uncache[i]];
				if (cache) {
					newuncache = [...newuncache, ...cache.children.map((module) => module.filename)];
					delete require.cache[uncache[i]];
				}
			}
			uncache = newuncache;
		} while (uncache.length > 0);
	}

	/* Http utils */

	httpGet(url: string, callback?: (data: string | null, e?: Error) => void): void {
		if (!callback) return;
		http.get(url, (res) => {
			const data = { data: '' };
			res.on('data', (part: any) => {
				data.data += part;
			});
			res.on('end', () => {
				callback(data.data);
			});
			res.on('error', (e: Error) => {
				callback(null, e);
			});
		}).on('error', (e: Error) => {
			callback(null, e);
		});
	}

	uploadToHastebin(toUpload: string, callback?: (success: boolean, linkStr: any) => void): void {
		const reqOpts: https.RequestOptions = {
			hostname: 'hastebin.com',
			method: 'POST',
			path: '/documents',
		};
		const req = https.request(reqOpts, (res: http.IncomingMessage) => {
			res.on('data', (chunk: any) => {
				try {
					const linkStr = 'hastebin.com/' + JSON.parse(chunk.toString())['key'];
					if (callback) callback(true, linkStr);
				} catch (e: any) {
					if (callback) callback(false, e);
				}
			});
		});
		req.on('error', (e: Error) => {
			if (typeof callback === 'function') callback(false, e);
		});
		req.write(toUpload);
		req.end();
	}

	/* Battle formats and data */

	parseAliases(format?: string): string {
		if (!format) return '';
		format = toId(format);
		const aliases = Config.formatAliases || {};
		if (Formats[format]) return format;
		if (aliases[format]) format = toId(aliases[format]);
		if (Formats[format]) return format;
		try {
			const psAliases = DataDownloader.getAliases();
			if (psAliases[format]) format = toId(psAliases[format]);
		} catch (e) {}
		return format;
	}

	/* Teams - Pokemon Showdown format */

	teamToJSON(text: string): any[] {
		const lines = text.split('\n');
		const team = [];
		let curSet: PokeSet | null = null;
		for (let i = 0; i < lines.length; i++) {
			let line = lines[i].trim();
			if (line === '' || line === '---') {
				curSet = null;
			} else if (!curSet) {
				curSet = { name: '', species: '', gender: '', item: '', ability: '', nature: '', moves: [] };
				team.push(curSet);
				const atIndex = line.lastIndexOf(' @ ');
				if (atIndex !== -1) {
					curSet.item = line.substr(atIndex + 3);
					if (toId(curSet.item) === 'noitem') curSet.item = '';
					line = line.substr(0, atIndex);
				}
				if (line.substr(line.length - 4) === ' (M)') {
					curSet.gender = 'M';
					line = line.substr(0, line.length - 4);
				}
				if (line.substr(line.length - 4) === ' (F)') {
					curSet.gender = 'F';
					line = line.substr(0, line.length - 4);
				}
				const parenIndex = line.lastIndexOf(' (');
				if (line.substr(line.length - 1) === ')' && parenIndex !== -1) {
					line = line.substr(0, line.length - 1);
					curSet.species = line.substr(parenIndex + 2);
					line = line.substr(0, parenIndex);
					curSet.name = line;
				} else {
					curSet.species = line;
					curSet.name = curSet.species;
				}
			} else if (line.substr(0, 7) === 'Trait: ') {
				line = line.substr(7);
				curSet.ability = line;
			} else if (line.substr(0, 9) === 'Ability: ') {
				line = line.substr(9);
				curSet.ability = line;
			} else if (line === 'Shiny: Yes') {
				curSet.shiny = true;
			} else if (line.substr(0, 7) === 'Level: ') {
				line = line.substr(7);
				curSet.level = parseInt(line);
			} else if (line.substr(0, 11) === 'Happiness: ') {
				line = line.substr(11);
				curSet.happiness = parseInt(line);
			} else if (line.substr(0, 9) === 'Ability: ') {
				line = line.substr(9);
				curSet.ability = line;
			} else if (line.substr(0, 5) === 'EVs: ') {
				line = line.substr(5);
				const evLines = line.split('/');
				curSet.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
				for (let j = 0; j < evLines.length; j++) {
					const evLine = evLines[j].trim();
					const spaceIndex = evLine.indexOf(' ');
					if (spaceIndex === -1) continue;
					const statid = BattleStatIDs[evLine.substr(spaceIndex + 1)];
					const statval = parseInt(evLine.substr(0, spaceIndex));
					if (!statid) continue;
					curSet.evs[statid] = statval;
				}
			} else if (line.substr(0, 5) === 'IVs: ') {
				line = line.substr(5);
				const ivLines = line.split(' / ');
				curSet.ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
				for (let j = 0; j < ivLines.length; j++) {
					const ivLine = ivLines[j];
					const spaceIndex = ivLine.indexOf(' ');
					if (spaceIndex === -1) continue;
					const statid = BattleStatIDs[ivLine.substr(spaceIndex + 1)];
					const statval = parseInt(ivLine.substr(0, spaceIndex));
					if (!statid) continue;
					curSet.ivs[statid] = statval;
				}
			} else if (line.match(/^[A-Za-z]+ (N|n)ature/)) {
				let natureIndex = line.indexOf(' Nature');
				if (natureIndex === -1) natureIndex = line.indexOf(' nature');
				if (natureIndex === -1) continue;
				line = line.substr(0, natureIndex);
				curSet.nature = line;
			} else if (line.substr(0, 1) === '-' || line.substr(0, 1) === '~') {
				line = line.substr(1);
				if (line.substr(0, 1) === ' ') line = line.substr(1);
				if (line.substr(0, 14) === 'Hidden Power [') {
					const hptype = line.substr(14, line.length - 15);
					line = 'Hidden Power ' + hptype;
					if (!curSet.ivs) {
						curSet.ivs = { ...typechart[hptype].HPivs };
					}
				}
				if (line === 'Frustration') {
					curSet.happiness = 0;
				}
				curSet.moves.push(line);
			}
		}
		return team;
	}

	isUndefinedOrDefault<T>(v: T | undefined, defaultValue: T): boolean {
		return typeof v === 'undefined' || v === defaultValue;
	}

	packTeam(team?: PokeSet[]): string {
		if (!team) return '';
		let buf = '';
		for (let i = 0; i < team.length; i++) {
			const set = team[i];
			if (buf) buf += ']';
			// name
			buf += set.name || set.species;
			// species
			let id = toId(set.species || set.name);
			buf += '|' + (toId(set.name || set.species) === id ? '' : id);
			// item
			buf += '|' + toId(set.item);
			// ability
			let template: Record<string, any> | null = null;
			try {
				template = DataDownloader.getPokedex()[toId(set.species || set.name)];
			} catch (e: any) {
				errlog(e.stack);
			}
			if (!template) return '';
			const abilities = template.abilities;
			id = toId(set.ability);
			if (abilities) {
				if (abilities['0'] && id === toId(abilities['0'])) {
					buf += '|';
				} else if (abilities['1'] && id === toId(abilities['1'])) {
					buf += '|1';
				} else if (abilities['H'] && id === toId(abilities['H'])) {
					buf += '|H';
				} else {
					buf += '|' + id;
				}
			} else {
				buf += '|' + id;
			}
			// moves
			buf += '|' + set.moves.map(toId).join(',');
			// nature
			buf += '|' + set.nature;
			// evs
			let evs = '|';
			if (set.evs) {
				evs =
					'|' +
					(set.evs['hp'] || '') +
					',' +
					(set.evs['atk'] || '') +
					',' +
					(set.evs['def'] || '') +
					',' +
					(set.evs['spa'] || '') +
					',' +
					(set.evs['spd'] || '') +
					',' +
					(set.evs['spe'] || '');
			}
			if (evs === '|,,,,,') {
				buf += '|';
			} else {
				buf += evs;
			}
			// gender
			if (set.gender && set.gender !== template.gender) {
				buf += '|' + set.gender;
			} else {
				buf += '|';
			}
			// ivs
			let ivs = '|';
			const setIvs = set.ivs;
			if (setIvs) {
				Stats.map((stat) => setIvs[stat])
					.map((v) => (this.isUndefinedOrDefault(v, 31) ? '' : v))
					.join(',');
				ivs =
					'|' +
					Stats.map((stat) => setIvs[stat])
						.map((v) => (this.isUndefinedOrDefault(v, 31) ? '' : v))
						.join(',');
			}
			if (ivs === '|,,,,,') {
				buf += '|';
			} else {
				buf += ivs;
			}
			// shiny
			if (set.shiny) {
				buf += '|S';
			} else {
				buf += '|';
			}
			// level
			if (set.level && set.level !== 100) {
				buf += '|' + set.level;
			} else {
				buf += '|';
			}
			// happiness
			if (!this.isUndefinedOrDefault(set.happiness, 255)) {
				buf += '|' + set.happiness;
			} else {
				buf += '|';
			}

			if (
				set.pokeball ||
				set.hpType ||
				set.gigantamax ||
				!this.isUndefinedOrDefault(set.dynamaxLevel, 10) ||
				set.teraType
			) {
				buf += ',' + (set.hpType || '');
				buf += ',' + toId(set.pokeball);
				buf += ',' + (set.gigantamax ? 'G' : '');
				buf += ',' + (!this.isUndefinedOrDefault(set.dynamaxLevel, 10) ? set.dynamaxLevel : '');
				buf += ',' + (set.teraType || '');
			}
		}
		return buf;
	}

	fastUnpackTeam(buf?: string): PokeSet[] {
		if (!buf) return [];

		const team: PokeSet[] = [];
		let i = 0,
			j = 0;

		while (true) {
			const set: PokeSet = {
				name: '',
				species: '',
				item: '',
				ability: '',
				moves: [],
				nature: '',
				gender: '',
				level: 100,
				happiness: 0,
			};
			team.push(set);

			// name
			j = buf.indexOf('|', i);
			set.name = buf.substring(i, j);
			i = j + 1;

			// species
			j = buf.indexOf('|', i);
			set.species = buf.substring(i, j) || set.name;
			i = j + 1;

			// item
			j = buf.indexOf('|', i);
			set.item = buf.substring(i, j);
			i = j + 1;

			// ability
			j = buf.indexOf('|', i);
			const ability = buf.substring(i, j);
			const template = this.getTemplate(set.species);
			set.ability =
				template.abilities && ability in { '': 1, 0: 1, 1: 1, H: 1 }
					? template.abilities[ability || '0']
					: ability;
			i = j + 1;

			// moves
			j = buf.indexOf('|', i);
			set.moves = buf.substring(i, j).split(',');
			i = j + 1;

			// nature
			j = buf.indexOf('|', i);
			set.nature = buf.substring(i, j);
			i = j + 1;

			// evs
			j = buf.indexOf('|', i);
			if (j !== i) {
				const evs = buf.substring(i, j).split(',');
				set.evs = {
					hp: Number(evs[0]) || 0,
					atk: Number(evs[1]) || 0,
					def: Number(evs[2]) || 0,
					spa: Number(evs[3]) || 0,
					spd: Number(evs[4]) || 0,
					spe: Number(evs[5]) || 0,
				};
			}
			i = j + 1;

			// gender
			j = buf.indexOf('|', i);
			if (i !== j) set.gender = buf.substring(i, j);
			i = j + 1;

			// ivs
			j = buf.indexOf('|', i);
			if (j !== i) {
				const ivs = buf.substring(i, j).split(',');
				set.ivs = {
					hp: ivs[0] === '' ? 31 : Number(ivs[0]),
					atk: ivs[1] === '' ? 31 : Number(ivs[1]),
					def: ivs[2] === '' ? 31 : Number(ivs[2]),
					spa: ivs[3] === '' ? 31 : Number(ivs[3]),
					spd: ivs[4] === '' ? 31 : Number(ivs[4]),
					spe: ivs[5] === '' ? 31 : Number(ivs[5]),
				};
			}
			i = j + 1;

			// shiny
			j = buf.indexOf('|', i);
			if (i !== j) set.shiny = true;
			i = j + 1;

			// level
			j = buf.indexOf('|', i);
			if (i !== j) set.level = parseInt(buf.substring(i, j), 10);
			i = j + 1;

			// happiness
			j = buf.indexOf(']', i);
			if (j < 0) {
				if (buf.substring(i)) {
					set.happiness = Number(buf.substring(i));
				}
				break;
			}
			if (i !== j) set.happiness = Number(buf.substring(i, j));
			i = j + 1;
		}
		return team;
	}

	teamOverview(buf?: string): string {
		const team = this.fastUnpackTeam(buf);
		if (!team) return '(empty)';
		const pokes = [];
		for (let i = 0; i < team.length; i++) {
			pokes.push(team[i].species);
		}
		if (!pokes.length) return '(empty)';
		return pokes.join(', ');
	}

	getTemplate(name?: string): Record<string, any> {
		name = toId(name || '');
		try {
			return DataDownloader.getPokedex()[name] || {};
		} catch (e) {}
		return {};
	}

	getItem(name?: string): Record<string, any> {
		name = toId(name || '');
		try {
			return DataDownloader.getItems()[name] || {};
		} catch (e) {}
		return {};
	}

	getAbility(name?: string): Record<string, any> {
		name = toId(name || '');
		try {
			return DataDownloader.getAbilities()[name] || {};
		} catch (e) {}
		return {};
	}

	getMove(name?: string): Record<string, any> {
		name = toId(name || '');
		try {
			return DataDownloader.getMovedex()[name] || {};
		} catch (e) {}
		return {};
	}

	exportTeam(team?: string | PokeSet[]): string {
		if (!team) return '';
		if (typeof team === 'string') {
			if (team.indexOf('\n') >= 0) return team;
			team = this.fastUnpackTeam(team);
		}
		let text = '';
		for (let i = 0; i < team.length; i++) {
			const curSet = team[i];
			if (curSet.name !== curSet.species) {
				text += '' + curSet.name + ' (' + (this.getTemplate(curSet.species).name || curSet.species) + ')';
			} else {
				text += '' + (this.getTemplate(curSet.species).name || curSet.species);
			}
			if (curSet.gender === 'M') text += ' (M)';
			if (curSet.gender === 'F') text += ' (F)';
			if (curSet.item) {
				curSet.item = this.getItem(curSet.item).name || curSet.item;
				text += ' @ ' + curSet.item;
			}
			text += '\n';
			if (curSet.ability) {
				text += 'Ability: ' + curSet.ability + '\n';
			}
			if (curSet.level && curSet.level !== 100) {
				text += 'Level: ' + curSet.level + '\n';
			}
			if (curSet.shiny) {
				text += 'Shiny: Yes\n';
			}
			if (typeof curSet.happiness === 'number' && curSet.happiness !== 255) {
				text += 'Happiness: ' + curSet.happiness + '\n';
			}
			let first = true;
			const { evs } = curSet;
			if (evs) {
				Stats.forEach((j) => {
					if (!evs[j]) return;
					if (first) {
						text += 'EVs: ';
						first = false;
					} else {
						text += ' / ';
					}
					text += '' + evs[j] + ' ' + BattleStatNames[j];
				});
			}
			if (!first) {
				text += '\n';
			}
			if (curSet.nature) {
				text += '' + curSet.nature + ' Nature' + '\n';
			}
			first = true;
			const { ivs } = curSet;
			if (ivs) {
				let defaultIvs = true;
				let hpType: string | null = null;
				for (let j = 0; j < curSet.moves.length; j++) {
					const move = curSet.moves[j];
					if (move.substr(0, 13) === 'Hidden Power ' && move.substr(0, 14) !== 'Hidden Power [') {
						hpType = move.substr(13);
						if (!hpType || !typechart[hpType]?.HPivs) {
							continue;
						}
						if (
							Stats.some(
								(stat) => (ivs[stat] ?? 31) !== (typechart[hpType as string].HPivs?.[stat] || 31)
							)
						) {
							defaultIvs = false;
						}
					}
				}
				if (defaultIvs && !hpType) {
					if (Stats.some((stat) => !this.isUndefinedOrDefault(ivs[stat], 31))) {
						defaultIvs = false;
					}
				}
				if (!defaultIvs) {
					Stats.forEach((stat) => {
						const iv = ivs[stat];
						if (!iv || isNaN(iv) || iv === 31) return;
						if (first) {
							text += 'IVs: ';
							first = false;
						} else {
							text += ' / ';
						}
						text += '' + iv + ' ' + BattleStatNames[stat];
					});
				}
			}
			if (!first) {
				text += '\n';
			}
			for (let j = 0; j < curSet.moves.length; j++) {
				let move = curSet.moves[j];
				if (move.substr(0, 13) === 'Hidden Power ') {
					move = move.substr(0, 13) + '[' + move.substr(13) + ']';
				}
				text += '- ' + (this.getMove(move).name || move) + '\n';
			}
			text += '\n';
		}
		return text;
	}
}
