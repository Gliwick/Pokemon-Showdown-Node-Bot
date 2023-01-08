/*
	Log system
*/

import { createWriteStream, existsSync, mkdirSync, PathLike, readdirSync, unlinkSync, WriteStream } from 'fs';

import { LogConfig } from './config-tools';
import { errlog, error } from './log';
import { pad } from './tools';

export const LOGS_PATH = './logs/';

interface Date {
	day: number;
	month: number;
	year: number;
}

const DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function dateDifference(date1: Date, date2: Date): number {
	if (!date1 || !date1.day || !date1.month || !date1.year) return 0;
	if (!date2 || !date2.day || !date2.month || !date2.year) return 0;
	const daysA = DAYS.slice(1, date1.month).reduce((acc, v) => acc + v, date1.day);
	const daysB = DAYS.slice(1, date2.month).reduce((acc, v) => acc + v, date2.day);
	return Math.abs(365 * (date1.year - date2.year) + (daysA - daysB));
}

export function sweep(dir: PathLike, config?: LogConfig): void {
	//delete previous logs
	const ageOfLogs = config?.ageOfLogs || 15;
	const f = new Date();
	try {
		const logs = readdirSync(dir);
		for (let i = 0; i < logs.length; i++) {
			if (!logs[i].endsWith('.log')) continue;
			const aux = logs[i].split('.log')[0].split('_');
			if (aux.length < 4) continue;
			if (
				dateDifference(
					{ day: parseInt(aux[3]), month: parseInt(aux[2]), year: parseInt(aux[1]) },
					{ day: f.getDate(), month: f.getMonth() + 1, year: f.getFullYear() }
				) > ageOfLogs
			) {
				try {
					unlinkSync(dir + logs[i]);
				} catch (e: any) {
					error('failed to delete old security logs\n' + e.stack);
				}
			}
		}
	} catch (e: any) {
		errlog(e.message);
		errlog(e.stack);
	}
}

export function checkDir(dir: PathLike): void {
	try {
		if (!existsSync(dir)) mkdirSync(dir);
	} catch (e: any) {}
}

export class SecurityLogger {
	logStream: WriteStream | null = null;
	logDate: string | null = null;

	constructor() {
		checkDir(LOGS_PATH);
	}

	write(message: string): void {
		const f = new Date();
		const fstr = pad(f.getFullYear(), 4) + '_' + pad(f.getMonth() + 1, 2) + '_' + pad(f.getDate(), 2);
		if (!this.logStream || this.logDate !== fstr) {
			if (this.logStream) {
				try {
					this.logStream.close();
				} catch (e: any) {}
			}
			this.logDate = fstr;
			checkDir(LOGS_PATH + 'security-log' + '/');
			this.logStream = createWriteStream(LOGS_PATH + 'security-log' + '/' + 'security' + '_' + fstr + '.log', {
				flags: 'a+',
			});
			sweep(LOGS_PATH + 'security-log' + '/', Config.securityLog);
		}
		this.logStream.write('[' + [f.getHours(), f.getMinutes(), f.getSeconds()].map((n) => pad(n, 2)).join(':') + ']' + message + '\n');
	}

	log(message: string): void {
		try {
			this.write(message);
		} catch (e: any) {
			errlog(e.stack);
			error('Failed to write security log: ' + e.message);
		}
	}
}
