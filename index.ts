/*
	Pokemon Showdown Bot, for NodeJS

	By: Gliwick
*/

import 'path';
import 'sugar';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { inspect } from 'util';

import { setupBot } from './bot-setup';
import { checkConfig, parseArguments } from './config-tools';
import { globalMonitor } from './global-monitor';
import { errlog, error, info, ok } from './log';

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

setupBot();

/* Global Monitor */

globalMonitor.checkSystem();

if (!AppOptions.testmode) {
	setInterval(globalMonitor.checkSystem.bind(globalMonitor), 60 * 60 * 1000);
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
