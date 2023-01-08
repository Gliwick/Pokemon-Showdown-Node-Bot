/*
 * Tools file
 */

import { get, IncomingMessage } from 'http';
import { request, RequestOptions } from 'https';

/* String utils */

export type ID = '' | (string & { __isID: true });

export function toId(text?: string): ID {
	if (!text) return '';
	return text.toLowerCase().replace(/[^a-z0-9]/g, '') as ID;
}

export function toName(text?: string): string {
	if (!text) return '';
	return text.trim();
}

export function pad(num: number, numOfZeros: number): string {
	return num.toString().padStart(numOfZeros, '0');
}

const ID_CHARACTERS = 'abcdefghijklmnopqrstuvwxyz0123456789';
export function generateRandomNick(numChars: number): string {
	let str = '';
	for (let i = 0; i < numChars; i++) {
		str += ID_CHARACTERS.charAt(~~(Math.random() * ID_CHARACTERS.length));
	}
	return str;
}

export function levenshtein(s: string, t: string, l: number): number {
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

export function joinWithLengthLimit(arr: string[], prefix: string, separator = ', ', length = 300): string[] {
	return arr
		.map((s, i) => s + (i < arr.length - 1 ? separator : ''))
		.reduce(
			(acc, toAdd) => {
				acc[acc.length - 1].length + toAdd.length > length ? acc.push(toAdd) : (acc[acc.length - 1] += toAdd);
				return acc;
			},
			[prefix]
		);
}

class Normalizer {
	normalObj: Record<string, string> = {};

	constructor() {
		const str1 = 'ÃÀÁÄÂÈÉËÊÌÍÏÎÒÓÖÔÙÚÜÛãàáäâèéëêìíïîòóöôùúüûÑÇç';
		const str2 = 'AAAAAEEEEIIIIOOOOUUUUaaaaaeeeeiiiioooouuuuñcc';
		for (let i = 0; i < str1.length; i++) {
			this.normalObj[str1.charAt(i)] = str2.charAt(i);
		}
	}

	normalize(str: string): string {
		if (!str) return '';
		let res = '';
		for (let i = 0; i < str.length; i++) {
			res += this.normalObj[str.charAt(i)] || str.charAt(i);
		}
		return toId(res);
	}
}
const normalizer = new Normalizer();

export function normalize(str: string): string {
	return normalizer.normalize(str);
}

export function splitFirst(s: string, separator: string): [string, string] {
	const i = s.indexOf(separator);
	if (i < 0) return [s, ''];
	return [s.substring(0, i), s.substring(i + separator.length)];
}

export function splitLast(s: string, separator: string): [string, string] {
	const i = s.lastIndexOf(separator);
	if (i < 0) return [s, ''];
	return [s.substring(0, i), s.substring(i + separator.length)];
}

/* Commands and Permissions */

export function stripCommands(text: string): string {
	return (text.trim().charAt(0) === '/' ? '/' : text.trim().charAt(0) === '!' ? ' ' : '') + text.trim();
}

export function getTargetRoom(arg?: string): { arg: string; room: string } | null {
	if (!arg) return null;
	if (!arg.startsWith('[')) return null;
	if (!arg.includes(']')) return null;
	const [newArg, room] = splitFirst(arg.substring(1), ']');
	return { arg: toId(newArg), room };
}

export function highestRank(): string {
	return Config.ranks[Config.ranks.length - 1];
}

export function getGroup(perm?: string): string {
	if (!perm) return highestRank();
	return Config.globalPermissions[perm] || highestRank();
}

export function equalOrHigherRank(userIdentity: string, rank: string): boolean {
	if (rank.length > 1) rank = getGroup(rank);
	if (rank === ' ') return true;
	const userId = toId(userIdentity);
	const userRank = Config.exceptions[userId] || userIdentity.charAt(0);
	if (!Config.ranks.includes(userRank)) return false;
	if (Config.ranks.indexOf(userRank) >= Config.ranks.indexOf(rank)) return true;
	return false;
}

/* Time and Dates */

export function getDateString(): string {
	const date = new Date();
	return (
		`${pad(date.getDate(), 2)}/${pad(date.getMonth() + 1, 2)}/${pad(date.getFullYear(), 4)} ` +
		`${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}:${pad(date.getSeconds(), 2)}`
	);
}

export function getTimeAgo(time: number, lang?: string): string {
	time = Date.now() - time;
	time = Math.round(time / 1000); // rounds to nearest second
	const trans = (data: string): string => {
		return Languages.translateGlobal('time', data, lang || Config.language || 'english');
	};
	let times = [];
	const seconds = time % 60;
	if (seconds) times.push(String(seconds) + ' ' + trans(seconds === 1 ? 'second' : 'seconds'));
	if (time >= 60) {
		time = (time - seconds) / 60; // converts to minutes
		const minutes = time % 60;
		if (minutes) times = [String(minutes) + ' ' + trans(minutes === 1 ? 'minute' : 'minutes')].concat(times);
		if (time >= 60) {
			time = (time - minutes) / 60; // converts to hours
			const hours = time % 24;
			if (hours) times = [String(hours) + ' ' + trans(hours === 1 ? 'hour' : 'hours')].concat(times);
			if (time >= 24) {
				const days = (time - hours) / 24; // you can probably guess this one
				if (days) times = [String(days) + ' ' + trans(days === 1 ? 'day' : 'days')].concat(times);
			}
		}
	}
	if (!times.length) times.push('0 ' + trans('seconds'));
	return times.join(', ');
}

export function getESTDiff(timestamp: number): number {
	const date = new Date(timestamp);
	if (date.getMonth() < 11 && date.getMonth() > 1) {
		if (date.getMonth() === 10 && date.getDate() - date.getDay() <= 6) return -5;
		if (date.getMonth() === 2 && date.getDate() - date.getDay() < 0) return -5;
		return -4;
	}
	return -5;
}

/* File system utils */

/**
 * @param path A path to a file from bot root
 */
export function uncacheTree(root: string): void {
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

export function httpGet(url: string, callback?: (data: string | null, e: Error | null) => void): void {
	if (!callback) return;
	get(url, (res: IncomingMessage): void => {
		const data = { data: '' };
		res.on('data', (part: any) => {
			data.data += part;
		});
		res.on('end', () => {
			callback(data.data, null);
		});
		res.on('error', (e: Error) => {
			callback(null, e);
		});
	}).on('error', (e: Error) => {
		callback(null, e);
	});
}

export function uploadToHastebin(toUpload: string, callback?: (success: boolean, link: any) => void): void {
	const reqOpts: RequestOptions = {
		hostname: 'hastebin.com',
		method: 'POST',
		path: '/documents',
	};
	const req = request(reqOpts, (res: IncomingMessage) => {
		res.on('data', (chunk: any) => {
			try {
				const link = 'hastebin.com/' + JSON.parse(chunk.toString())['key'];
				if (callback) callback(true, link);
			} catch (e: any) {
				if (callback) callback(false, e);
			}
		});
	});
	req.on('error', (e: Error) => {
		if (callback) callback(false, e);
	});
	req.write(toUpload);
	req.end();
}

/* Battle data */

export function parseAliases(format?: string): string {
	if (!format) return '';
	format = toId(format);
	const aliases = Config.formatAliases || {};
	if (Formats[format]) return format;
	if (aliases[format]) format = toId(aliases[format]);
	if (Formats[format]) return format;
	try {
		const psAliases = DataDownloader.getAliases();
		if (psAliases[format]) format = toId(psAliases[format]);
	} catch (e: any) {}
	return format;
}

/* Generics */

export function isUndefinedOrEquals<T>(v: T | undefined, other: T): boolean {
	return (v ?? other) === other;
}

export function emptyIfDefault<T>(v: T | undefined, defaultValue: T): string {
	return isUndefinedOrEquals(v, defaultValue) ? '' : '' + v;
}
