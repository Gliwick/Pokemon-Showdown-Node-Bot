/* Console reporting */

import { colors } from './index';

export function ok(str: string): void {
	if (AppOptions.debugmode) {
		if (AppOptions.debugmode > 3) return;
	} else if (Config.debug?.ok === false) return;
	console.log(colors.green('ok') + '\t' + str);
}

export function info(str: string): void {
	if (AppOptions.debugmode) {
		if (AppOptions.debugmode > 3) return;
	} else if (Config.debug?.info === false) return;
	console.log(colors.cyan('info') + '\t' + str);
}

export function error(str: string): void {
	if (AppOptions.debugmode) {
		if (AppOptions.debugmode > 3) return;
	} else if (Config.debug?.error === false) return;
	console.log(colors.red('error') + '\t' + str);
}

export function errlog(str: string): void {
	if (AppOptions.debugmode) {
		if (AppOptions.debugmode > 3) return;
	} else if (Config.debug?.errlog === false) return;
	console.log(str);
}

export function debug(str: string): void {
	if (AppOptions.debugmode) {
		if (AppOptions.debugmode > 1) return;
	} else if (Config.debug?.debug === false) return;
	console.log(colors.blue('debug') + '\t' + str);
}

export function cmdr(str: string): void {
	if (AppOptions.debugmode) {
		if (AppOptions.debugmode > 1) return;
	} else if (Config.debug?.cmdr === false) return;
	console.log(colors.magenta('cmdr') + '\t' + str);
}

export function recv(str: string): void {
	if (AppOptions.debugmode) {
		if (AppOptions.debugmode > 1) return;
	} else if (Config.debug?.recv === false) return;
	console.log(colors.grey('recv') + '\t' + str);
}

export function sent(str: string): void {
	if (AppOptions.debugmode) {
		if (AppOptions.debugmode > 1) return;
	} else if (Config.debug?.sent === false) return;
	console.log(colors.grey('sent') + '\t' + str);
}

export type MonitorType = 'room' | 'battle' | 'status';
export type MonitorFlag = 'join' | 'leave' | 'error';

export function monitor(str: string, type?: MonitorType, flag?: MonitorFlag): void {
	let color: (s: string) => string;
	switch (flag) {
		case 'join':
			color = colors.green;
			break;
		case 'leave':
			color = colors.yellow;
			break;
		case 'error':
			color = colors.red;
			break;
		default:
			color = colors.blue;
	}
	switch (type) {
		case 'room':
			if (AppOptions.debugmode) {
				if (AppOptions.debugmode > 3) return;
			} else if (Config.debug?.room === false) return;
			console.log(color('room') + '\t' + str);
			break;
		case 'battle':
			if (AppOptions.debugmode) {
				if (AppOptions.debugmode > 2) return;
			} else if (Config.debug?.battle === false) return;
			console.log(color('battle') + '\t' + str);
			break;
		case 'status':
			if (AppOptions.debugmode) {
				if (AppOptions.debugmode > 2) return;
			} else if (Config.debug?.status === false) return;
			console.log(colors.blue('status') + '\t' + str);
			break;
		default:
			if (AppOptions.debugmode) {
				if (AppOptions.debugmode > 2) return;
			} else if (Config.debug?.monitor === false) return;
			console.log(colors.cyan('monitor') + '\t' + str);
	}
}

export function issue(text: string): void {
	console.log(colors.yellow('issue') + '\t' + text);
}
