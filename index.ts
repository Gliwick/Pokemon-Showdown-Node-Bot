/*
	Pokemon Showdown Bot, for NodeJS

	By: Gliwick
*/

import 'path';
import 'sugar';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

import { setupBot } from './bot-setup';
import { CommandParser as CommandParserClass } from './command-parser';
import { checkConfig } from './config-tools';
import { DataDownloader as DataDownloaderClass } from './data-downloader';
import { FeatureManager } from './features';
import { GlobalMonitor as GlobalMonitorClass } from './global-monitor';
import { AppOptionsType } from './global-types';
import { Intl } from './intl';
import { errlog, error, info, ok } from './log';
import { SecurityLogger } from './security-log';
import { SettingsManager } from './settings';
import { Tools as ToolsType } from './tools';

function importColors(): Record<string, (s: string) => string> {
	try {
		return require('colors');
	} catch (e: any) {
		console.log(e.stack);
		console.log("ERROR: missing dependencies, try 'npm install'");
		process.exit(-1);
	}
}

export const colors = importColors();

console.log(
	colors.yellow(
		'-----------------------------------------------\n' +
			'   Welcome to Pokemon Showdown Bot for Node!   \n' +
			'-----------------------------------------------\n'
	)
);

function parseArguments(arr: string[]): AppOptionsType {
	const opts: AppOptionsType = {
		config: './config.js',
		data: './data/',
	};
	let arg = '';
	for (let i = 0; i < arr.length; i++) {
		arg = arr[i].toLowerCase().trim();
		if (arg.charAt(0) === '-') {
			switch (arg) {
				case '-h':
				case '-help':
					opts.help = true;
					break;
				case '-production':
				case '-p':
					opts.debugmode = 3;
					break;
				case '-monitor':
				case '-m':
					opts.debugmode = 2;
					break;
				case '-debug':
				case '-d':
					opts.debugmode = 1;
					break;
				case '-test':
				case '-t':
					opts.testmode = true;
					break;
				case '-c':
				case '-config':
					if (!arr[i + 1]) opts.help = true;
					opts.config = arr[i + 1];
					i++;
					break;
				case '-dt':
				case '-data':
					if (!arr[i + 1]) opts.help = true;
					opts.data = arr[i + 1];
					i++;
					break;
				default:
					console.log('unknown parametter: ' + arg);
					opts.help = true;
			}
		}
	}
	if (!opts.data.endsWith('/')) opts.data += '/';
	return opts;
}

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

global.Tools = new ToolsType();

if (AppOptions.debugmode) info(['Debug', 'Monitor', 'Production'][AppOptions.debugmode - 1] + ' mode');

info('Loading globals');

/* Globals */

global.CommandParser = new CommandParserClass();

global.DataDownloader = new DataDownloaderClass();

global.Formats = {};

global.I18n = new Intl();

global.SecurityLog = new SecurityLogger();

global.Settings = new SettingsManager();

/* Commands */

if (!AppOptions.testmode) CommandParser.loadCommands();

/* Languages (translations) */

if (!AppOptions.testmode) I18n.loadTranslations();

/* Features */

global.Features = new FeatureManager();

if (!AppOptions.testmode) {
	global.Features.loadFeatures();
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

const PSClient = require('./showdown-client.ts').Client;
global.Bot = new PSClient(Config.server, Config.port, opts);

const globalMonitor = new GlobalMonitorClass();
global.GlobalMonitor = globalMonitor;

setupBot(globalMonitor);

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
