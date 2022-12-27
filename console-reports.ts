declare global {
	interface String {
		green: string;
		cyan: string;
		red: string;
		blue: string;
		magenta: string;
		grey: string;
		yellow: string;
	}
}

/* Console reporting */

export function ok(str: string): void {
	if (AppOptions.debugmode) {
		if (AppOptions.debugmode > 3) return;
	} else if (Config.debug && Config.debug.ok === false) return;
	console.log('ok'.green + '\t' + str);
}

export function info(str: string): void {
	if (AppOptions.debugmode) {
		if (AppOptions.debugmode > 3) return;
	} else if (Config.debug && Config.debug.info === false) return;
	console.log('info'.cyan + '\t' + str);
}

export function error(str: string): void {
	if (AppOptions.debugmode) {
		if (AppOptions.debugmode > 3) return;
	} else if (Config.debug && Config.debug.error === false) return;
	console.log('error'.red + '\t' + str);
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
	console.log('debug'.blue + '\t' + str);
}

export function cmdr(str: string): void {
	if (AppOptions.debugmode) {
		if (AppOptions.debugmode > 1) return;
	} else if (Config.debug && Config.debug.cmdr === false) return;
	console.log('cmdr'.magenta + '\t' + str);
}

export function recv(str: string): void {
	if (AppOptions.debugmode) {
		if (AppOptions.debugmode > 1) return;
	} else if (Config.debug && Config.debug.recv === false) return;
	console.log('recv'.grey + '\t' + str);
}

export function sent(str: string): void {
	if (AppOptions.debugmode) {
		if (AppOptions.debugmode > 1) return;
	} else if (Config.debug && Config.debug.sent === false) return;
	console.log('sent'.grey + '\t' + str);
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
					console.log('room'.green + '\t' + str);
					break;
				case 'leave':
					console.log('room'.yellow + '\t' + str);
					break;
				case 'error':
					console.log('room'.red + '\t' + str);
					break;
				default:
					console.log('room'.blue + '\t' + str);
			}
			break;
		case 'battle':
			if (AppOptions.debugmode) {
				if (AppOptions.debugmode > 2) return;
			} else if (Config.debug && Config.debug.battle === false) return;
			switch (flag) {
				case 'join':
					console.log('battle'.green + '\t' + str);
					break;
				case 'leave':
					console.log('battle'.yellow + '\t' + str);
					break;
				case 'error':
					console.log('battle'.red + '\t' + str);
					break;
				default:
					console.log('battle'.blue + '\t' + str);
			}
			break;
		case 'status':
			if (AppOptions.debugmode) {
				if (AppOptions.debugmode > 2) return;
			} else if (Config.debug && Config.debug.status === false) return;
			console.log('status'.blue + '\t' + str);
			break;
		default:
			if (AppOptions.debugmode) {
				if (AppOptions.debugmode > 2) return;
			} else if (Config.debug && Config.debug.monitor === false) return;
			console.log('monitor'.cyan + '\t' + str);
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
