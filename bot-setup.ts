import { inspect } from 'util';

import { GlobalMonitor } from './global-monitor';
import { colors } from './index';
import { debug, errlog, error, info, monitor, ok, recv, sent } from './log';
import { toId } from './tools';

function getFeatureInitCmds(): string[] {
	return Object.values(Features).flatMap((f) => {
		if (f.getInitCmds) {
			try {
				return f.getInitCmds();
			} catch (e: any) {
				errlog(e.stack);
			}
		}
		return [];
	});
}

function joinByQueryRequest(target: 'all' | 'official' | 'public' | string[]): void {
	if (target === 'official' || target === 'public' || target === 'all') {
		info('Joining ' + target + ' rooms');
	} else {
		error('Config.rooms, as a string must be "official", "public" or "all"');
		const cmds = Config.initCmds.concat(getFeatureInitCmds());
		Bot.send(cmds, 2000);
		return;
	}
	const qParser = (dataString: string): void => {
		const data = dataString.split('|');
		if (data[0] === 'rooms') {
			data.splice(0, 1);
			const str = data.join('|');
			let cmds: string[] = [];
			try {
				const rooms = JSON.parse(str);
				const offRooms = [...(rooms.official || [])].map((room) => room.title).filter((title) => !!title);
				const publicRooms = [...(rooms.chat || [])].map((room) => room.title).filter((title) => !!title);
				if (target === 'all' || target === 'official') {
					cmds = cmds.concat(offRooms.map((room) => '|/join ' + room));
				}
				if (target === 'all' || target === 'public') {
					cmds = cmds.concat(publicRooms.map((room) => '|/join ' + room));
				}
			} catch (e) {}
			cmds = cmds.concat(Config.initCmds).concat(getFeatureInitCmds());
			Bot.send(cmds, 2000);
			Bot.removeListener('queryresponse', qParser);
		}
	};
	Bot.on('queryresponse', qParser);
	Bot.send('|/cmd rooms');
}

/* Bot creation and connection */

function botAfterConnect(): void {
	//join rooms
	if (typeof Config.rooms === 'string') {
		joinByQueryRequest(Config.rooms);
	} else {
		const cmds = Config.rooms
			.map((room) => '|/join ' + room)
			.concat(Config.initCmds)
			.concat(getFeatureInitCmds());
		Bot.send(cmds, 2000);
	}
}

export function setupBot(globalMonitor: GlobalMonitor): void {
	Bot.on('connect', (): void => {
		ok('Connected to server ' + Config.serverid + ' (' + Tools.getDateString() + ')');
		SecurityLog.log(
			'Connected to server ' + Bot.opts.server + ':' + Bot.opts.port + ' (' + Bot.opts.serverid + ')'
		);
		globalMonitor.connected = true;
		for (const f in Features.features) {
			try {
				Features.features[f].init();
			} catch (e: any) {
				errlog(e.stack);
				error('Feature Crash: ' + f + ' | ' + inspect(e));
				SecurityLog.log('FEATURE CRASH: ' + f + ' | ' + e.message + '\n' + e.stack);
			}
		}
	});

	interface FormatData {
		name: string;
		team: boolean;
		ladder: boolean;
		chall: boolean;
		disableTournaments?: boolean;
	}

	Bot.on('formats', (formats: string): void => {
		global.Formats = {};
		const formatsArr = formats.split('|');
		let commaIndex, code, name;
		for (let i = 0; i < formatsArr.length; i++) {
			commaIndex = formatsArr[i].indexOf(',');
			if (commaIndex === -1) {
				Formats[toId(formatsArr[i])] = { name: formatsArr[i], team: true, ladder: true, chall: true };
			} else if (commaIndex === 0) {
				i++;
				continue;
			} else {
				name = formatsArr[i];
				const formatData: FormatData = { name: name, team: true, ladder: true, chall: true };
				code = commaIndex >= 0 ? parseInt(name.substr(commaIndex + 1), 16) : NaN;
				if (!isNaN(code)) {
					name = name.substr(0, commaIndex);
					if (code & 1) formatData.team = false;
					if (!(code & 2)) formatData.ladder = false;
					if (!(code & 4)) formatData.chall = false;
					if (!(code & 8)) formatData.disableTournaments = true;
				} else {
					if (name.substr(name.length - 2) === ',#') {
						// preset teams
						formatData.team = false;
						name = name.substr(0, name.length - 2);
					}
					if (name.substr(name.length - 2) === ',,') {
						// search-only
						formatData.chall = false;
						name = name.substr(0, name.length - 2);
					} else if (name.substr(name.length - 1) === ',') {
						// challenge-only
						formatData.ladder = false;
						name = name.substr(0, name.length - 1);
					}
				}
				formatData.name = name;
				Formats[toId(name)] = formatData;
			}
		}
		ok('Received battle formats. Total: ' + formatsArr.length);
		if (!Config.disableDownload) {
			DataDownloader.download();
		}
	});

	Bot.on('challstr', (): void => {
		info('Received challstr, logging in...');
		if (!Config.nick) {
			Bot.rename('Bot ' + Tools.generateRandomNick(10));
		} else {
			Bot.rename(Config.nick, Config.pass);
		}
	});

	Bot.on('renamefailure', (e: number | Error): void => {
		if (e === -1) {
			if (!Config.nick) {
				debug('Login failure - generating another random nickname');
				Bot.rename('Bot ' + Tools.generateRandomNick(10));
			} else {
				error('Login failure - name registered, invalid or no password given');
				if (!Bot.status.named) {
					info('Invalid nick + pass, using a random nickname');
					Config.nick = '';
					Bot.rename('Bot ' + Tools.generateRandomNick(10));
				}
			}
		} else {
			if (Config.autoReloginDelay) {
				error('Login failure, retrying in ' + Config.autoReloginDelay / 1000 + ' seconds.');
				globalMonitor.retryingRename = true;
				setTimeout(function () {
					globalMonitor.retryingRename = false;
					if (!Config.nick) {
						Bot.rename('Bot ' + Tools.generateRandomNick(10));
					} else {
						Bot.rename(Config.nick, Config.pass);
					}
				}, Config.autoReloginDelay);
			} else {
				error('Login failure');
			}
		}
	});

	Bot.on('rename', (name: string, named: number): void => {
		monitor(
			'Bot nickname has changed: ' +
				(named ? colors.green(name) : colors.yellow(name)) +
				(named ? '' : ' [guest]')
		);
		SecurityLog.log('Bot nickname has changed to: ' + name + (named ? '' : ' [guest]'));
		if (named) {
			if (!Config.nick) {
				if (Bot.roomcount > 0) return; // Namechange, not initial login
				ok('Successfully logged in as ' + name);
				botAfterConnect();
			} else if (toId(Config.nick) === toId(name)) {
				ok('Successfully logged in as ' + name);
				botAfterConnect();
			}
		}
	});

	/* Reconnect timer */

	Bot.on('disconnect', (): void => {
		if (globalMonitor.connected) SecurityLog.log('Disconnected from server');
		globalMonitor.connected = false;
		if (Config.autoReconnectDelay) {
			if (globalMonitor.reconnecting) return;
			globalMonitor.reconnecting = true;
			error('Disconnected from server, retrying in ' + Config.autoReconnectDelay / 1000 + ' seconds');
			setTimeout(function () {
				globalMonitor.reconnecting = false;
				info('Connecting to server ' + Config.server + ':' + Config.port);
				Bot.connect();
			}, Config.autoReconnectDelay);
		} else {
			error('Disconnected from server, exiting...');
			process.exit(0);
		}
	});

	/* Commands */

	Bot.on('chat', (room: string, timeOff: number, by: string, msg: string): void => {
		CommandParser.parse(room, by, msg);
		Settings.userManager.reportChat(by, room);
	});

	Bot.on('pm', (by: string, msg: string): void => {
		CommandParser.parse(',' + by, by, msg);
	});

	Bot.on('userjoin', (room: string, by: string): void => {
		Settings.userManager.reportJoin(by, room);
	});

	Bot.on('userleave', (room: string, by: string): void => {
		Settings.userManager.reportLeave(by, room);
	});

	Bot.on('userrename', (room: string, old: string, by: string): void => {
		Settings.userManager.reportRename(old, by, room);
	});

	/* Features */

	Bot.on('line', (room: string, message: string, isIntro: boolean, spl: string[]): void => {
		for (const f in Features.features) {
			try {
				Features.features[f].parse(room, message, isIntro, spl);
			} catch (e: any) {
				errlog(e.stack);
				error('Feature Crash: ' + f + ' | ' + inspect(e));
				SecurityLog.log('FEATURE CRASH: ' + f + ' | ' + e.message + '\n' + e.stack);
				delete Features.features[f];
				info('Feature ' + f + ' has been disabled');
			}
		}
	});

	/* Info and debug */

	Bot.on('joinroom', (room: string, type: string): void => {
		SecurityLog.log('Joined room: ' + room + ' [' + type + ']');
		if (type === 'chat') monitor('Joined room ' + room, 'room', 'join');
		else if (type === 'battle') monitor('Joined battle ' + room, 'battle', 'join');
		else monitor('Joined room ' + room + ' [' + Bot.rooms[room].type + ']', 'room', 'join');
	});

	Bot.on('joinfailure', (room: string, e: string, moreInfo: string): void => {
		SecurityLog.log('Could not join ' + room + ': [' + e + '] ' + moreInfo);
		monitor('Could not join ' + room + ': [' + e + '] ' + moreInfo, 'room', 'error');
	});

	Bot.on('leaveroom', (room: string): void => {
		const roomType = Bot.rooms[room] ? Bot.rooms[room].type : 'chat';
		SecurityLog.log('Left room: ' + room + ' [' + roomType + ']');
		if (roomType === 'chat') monitor('Left room ' + room, 'room', 'leave');
		else if (roomType === 'battle') monitor('Left battle ' + room, 'battle', 'leave');
		else monitor('Left room ' + room + ' [' + Bot.rooms[room].type + ']', 'room', 'leave');
	});

	Bot.on('message', (msg: string): void => {
		recv(msg);
	});

	Bot.on('send', (msg: string): void => {
		sent(msg);
	});

	ok('Bot object is ready');
}
