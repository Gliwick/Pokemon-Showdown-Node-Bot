/* Console reporting */

import { colors } from './index';

export function ok(str: string): void {
	if (AppOptions.debugmode) {
		if (AppOptions.debugmode > 3) return;
	} else if (Config.debug && Config.debug.ok === false) return;
	console.log(colors.green('ok') + '\t' + str);
}

export function info(str: string): void {
	if (AppOptions.debugmode) {
		if (AppOptions.debugmode > 3) return;
	} else if (Config.debug && Config.debug.info === false) return;
	console.log(colors.cyan('info') + '\t' + str);
}

export function error(str: string): void {
	if (AppOptions.debugmode) {
		if (AppOptions.debugmode > 3) return;
	} else if (Config.debug && Config.debug.error === false) return;
	console.log(colors.red('error') + '\t' + str);
}

export function errlog(str: string): void {
	if (AppOptions.debugmode) {
		if (AppOptions.debugmode > 3) return;
	} else if (Config.debug && Config.debug.errlog === false) return;
	console.log(str);
}

export function debug(str: string): void {
	if (AppOptions.debugmode) {
		if (AppOptions.debugmode > 1) return;
	} else if (Config.debug && Config.debug.debug === false) return;
	console.log(colors.blue('debug') + '\t' + str);
}

export function cmdr(str: string): void {
	if (AppOptions.debugmode) {
		if (AppOptions.debugmode > 1) return;
	} else if (Config.debug && Config.debug.cmdr === false) return;
	console.log(colors.magenta('cmdr') + '\t' + str);
}

export function recv(str: string): void {
	if (AppOptions.debugmode) {
		if (AppOptions.debugmode > 1) return;
	} else if (Config.debug && Config.debug.recv === false) return;
	console.log(colors.grey('recv') + '\t' + str);
}

export function sent(str: string): void {
	if (AppOptions.debugmode) {
		if (AppOptions.debugmode > 1) return;
	} else if (Config.debug && Config.debug.sent === false) return;
	console.log(colors.grey('sent') + '\t' + str);
}

export type MonitorType = 'room' | 'battle' | 'status';
export type MonitorFlag = 'join' | 'leave' | 'error';

export function monitor(str: string, type?: MonitorType, flag?: MonitorFlag): void {
	switch (type) {
		case 'room':
			if (AppOptions.debugmode) {
				if (AppOptions.debugmode > 3) return;
			} else if (Config.debug && Config.debug.room === false) return;
			switch (flag) {
				case 'join':
					console.log(colors.green('room') + '\t' + str);
					break;
				case 'leave':
					console.log(colors.yellow('room') + '\t' + str);
					break;
				case 'error':
					console.log(colors.red('room') + '\t' + str);
					break;
				default:
					console.log(colors.blue('room') + '\t' + str);
			}
			break;
		case 'battle':
			if (AppOptions.debugmode) {
				if (AppOptions.debugmode > 2) return;
			} else if (Config.debug && Config.debug.battle === false) return;
			switch (flag) {
				case 'join':
					console.log(colors.green('battle') + '\t' + str);
					break;
				case 'leave':
					console.log(colors.yellow('battle') + '\t' + str);
					break;
				case 'error':
					console.log(colors.red('battle') + '\t' + str);
					break;
				default:
					console.log(colors.blue('battle') + '\t' + str);
			}
			break;
		case 'status':
			if (AppOptions.debugmode) {
				if (AppOptions.debugmode > 2) return;
			} else if (Config.debug && Config.debug.status === false) return;
			console.log(colors.blue('status') + '\t' + str);
			break;
		default:
			if (AppOptions.debugmode) {
				if (AppOptions.debugmode > 2) return;
			} else if (Config.debug && Config.debug.monitor === false) return;
			console.log(colors.cyan('monitor') + '\t' + str);
	}
}

Object.assign(globalThis, {
	ok,
	info,
	error,
	errlog,
	debug,
	cmdr,
	recv,
	sent,
	monitor,
});
