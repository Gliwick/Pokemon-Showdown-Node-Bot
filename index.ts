/*
	Pokemon Showdown Bot, for NodeJS

	By: Gliwick
*/

import 'path';
import 'sugar';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { inspect } from 'util';

import { checkConfig, parseArguments } from './config-tools';

export const colors = require('colors') as Record<string, (s: string) => string>;

try {
	global.sys = { inspect };
} catch (e: any) {
	console.log(e.stack);
	console.log("ERROR: missing dependencies, try 'npm install'");
	process.exit(-1);
}

console.log(
	colors.yellow(
		'-----------------------------------------------\n' +
			'   Welcome to Pokemon Showdown Bot for Node!   \n' +
			'-----------------------------------------------\n'
	)
);

const cmdArgs = process.argv.slice(2);
if (!global.AppOptions) global.AppOptions = parseArguments(cmdArgs);

if (AppOptions.help) {
	console.log(
		'Options:\n' +
			'   [-h/-help] - Gives you this guide\n' +
			'   [-c/-config] config-file - Set a custom configuration file\n' +
			'   [-dt/-data] data-dir - Set a custom data directory\n' +
			'   [-p/-production] - Production mode (recommended)\n' +
			'   [-m/-monitor] - Monitor mode\n' +
			'   [-d/-debug] - Debug mode\n' +
			'   [-t/-test] - Test Mode\n'
	);
	process.exit();
}

if (!existsSync(AppOptions.data)) {
	console.log(AppOptions.data + ' does not exist - creating data directory...');
	mkdirSync(AppOptions.data);
}

if (!existsSync(AppOptions.data + '_temp/')) {
	console.log(AppOptions.data + '_temp/' + ' does not exist - creating temp directory...');
	mkdirSync(AppOptions.data + '_temp/');
}

if (!existsSync(AppOptions.config)) {
	console.log(AppOptions.config + ' does not exist - creating one with default settings...');
	writeFileSync(AppOptions.config, readFileSync('./config-example.js'));
}

global.Config = require(AppOptions.config);
checkConfig();

global.Tools = new (require('./tools.ts').Tools)();

if (AppOptions.debugmode) info(['Debug', 'Monitor', 'Production'][AppOptions.debugmode - 1] + ' mode');

info('Loading globals');

/* Globals */

global.Formats = {};

global.Settings = new (require('./settings.ts').SettingsManager)();
global.FlatFileManager = require('./settings.ts').FlatFileManager;

global.DataDownloader = new (require('./data-downloader.ts').DataDownloader)();

global.CommandParser = new (require('./command-parser.ts').CommandParser)();

global.SecurityLog = new (require('./security-log.ts').SecurityLogger)();

/* Commands */

if (!AppOptions.testmode) CommandParser.loadCommands();

/* Languages (translations) */

if (!AppOptions.testmode) Tools.loadTranslations();

/* Features */

global.Features = {};

if (!AppOptions.testmode) {
	Features = require('./features/index.ts').initFeatures();

	Object.values(Features).forEach((f) => {
		ok('New feature: ' + f.id + ' | ' + f.desc);
	});
}

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

const opts = {
	serverid: Config.serverid,
	secprotocols: [],
	connectionTimeout: Config.connectionTimeout,
	loginServer: 'https://play.pokemonshowdown.com/~~' + Config.serverid + '/action.php',
	nickName: Config.nick,
	pass: Config.pass,
	retryLogin: 0,
	autoConnect: false,
	autoReconnect: false,
	autoReconnectDelay: 0,
	showErrors: Config.debug?.debug ?? true,
	debug: Config.debug?.debug ?? true,
};

global.PSClient = require('./showdown-client.ts').Client;
global.Bot = new PSClient(Config.server, Config.port, opts);

let connected = false;
Bot.on('connect', (): void => {
	ok('Connected to server ' + Config.serverid + ' (' + Tools.getDateString() + ')');
	SecurityLog.log('Connected to server ' + Bot.opts.server + ':' + Bot.opts.port + ' (' + Bot.opts.serverid + ')');
	connected = true;
	for (const f in Features) {
		try {
			if (typeof Features[f].init === 'function') Features[f].init();
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

let retryingRename = false;
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
			retryingRename = true;
			setTimeout(function () {
				retryingRename = false;
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
		'Bot nickname has changed: ' + (named ? colors.green(name) : colors.yellow(name)) + (named ? '' : ' [guest]')
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

let reconnecting = false;
Bot.on('disconnect', (): void => {
	if (connected) SecurityLog.log('Disconnected from server');
	connected = false;
	if (Config.autoReconnectDelay) {
		if (reconnecting) return;
		reconnecting = true;
		error('Disconnected from server, retrying in ' + Config.autoReconnectDelay / 1000 + ' seconds');
		setTimeout(function () {
			reconnecting = false;
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
	for (const f in Features) {
		try {
			if (typeof Features[f].parse === 'function') Features[f].parse(room, message, isIntro, spl);
		} catch (e: any) {
			errlog(e.stack);
			error('Feature Crash: ' + f + ' | ' + inspect(e));
			SecurityLog.log('FEATURE CRASH: ' + f + ' | ' + e.message + '\n' + e.stack);
			delete Features[f];
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

/* Global Monitor */

const checkSystem = function (): void {
	let status = '';
	let issue: string | false = false;
	status += 'Connection: ';
	if (connected) {
		status += colors.green('connected');
		status += ' | Nickname: ';
		if (Bot.status.named) {
			status += colors.green(Bot.status.nickName || '');
		} else if (retryingRename) {
			status += colors.yellow(Bot.status.nickName || '');
		} else {
			status += colors.red(Bot.status.nickName || '');
			issue = 'login';
		}
	} else if (reconnecting) {
		status += colors.yellow('retrying');
	} else {
		issue = 'connect';
		status += colors.red('disconnected');
	}
	monitor(status + ' (' + Tools.getDateString() + ')', 'status');
	if (issue) {
		switch (issue) {
			case 'connect':
				monitor('Monitor failed: Connection issue. Reconnecting...');
				SecurityLog.log('Monitor failed: Connection issue. Reconnecting...');
				Bot.connect();
				break;
			case 'login':
				monitor('Monitor failed: Login issue. Logging in a random username.');
				SecurityLog.log('Monitor failed: Login issue. Logging in a random username.');
				Config.nick = '';
				Bot.rename('Bot ' + Tools.generateRandomNick(10));
				break;
		}
	}
};
if (!AppOptions.testmode) {
	setInterval(checkSystem, 60 * 60 * 1000);
	ok('Global monitor is working');
}

//CrashGuard
if (!AppOptions.testmode && Config.crashguard) {
	process.on('uncaughtException', function (err) {
		SecurityLog.log('CRASH: ' + err.message + '\n' + err.stack);
		error(colors.red('' + err.message));
		errlog(colors.red('' + err.stack));
	});
	ok('Crashguard enabled');
}

//WatchConfig
if (!AppOptions.testmode && Config.watchconfig) {
	Tools.watchFile(AppOptions.config, (curr, prev) => {
		if (curr.mtime <= prev.mtime) return;
		try {
			Tools.uncacheTree(AppOptions.config);
			global.Config = require(AppOptions.config);
			checkConfig();
			Settings.applyConfig();
			CommandParser.reloadTokens();
			info(AppOptions.config + ' reloaded');
		} catch (e: any) {
			error('could not reload ' + AppOptions.config + ' | ' + e.message);
			errlog(e.stack);
		}
	});
	ok('Watchconfig enabled');
}

console.log(colors.yellow('\n-----------------------------------------------\n'));

//Connection
if (AppOptions.testmode) {
	ok('Test mode enabled');
} else {
	info('Connecting to server ' + Config.server + ':' + Config.port);
	Bot.connect();
	Bot.startConnectionTimeOut();
}
