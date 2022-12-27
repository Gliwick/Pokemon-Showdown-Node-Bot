/* Process arguments */

export interface AppOptionsType {
	help?: boolean;
	debugmode?: number;
	testmode?: boolean;
	config: string;
	data: string;
}

export function parseArguments(arr: string[]): AppOptionsType {
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

interface LogConfig {
	ageOfLogs: number;
}

export interface LeaderboardConfig {
	tierFilter?: string | string[] | RegExp | Record<string, boolean>;
	winnerPoints: number;
	finalistPoints: number;
	semiFinalistPoints: number;
	battlePoints: number;
	onlyOfficial: boolean;
}

export interface ConfigType {
	commandChar: string;
	disableSeen?: boolean;
	disableAlts?: boolean;
	server: string;
	port: number;
	serverid: string;
	autoReconnectDelay: number;
	connectionTimeout: number;
	crashguard: boolean;
	securityLog?: LogConfig;
	watchconfig: boolean;
	nick: string;
	pass: string;
	autoReloginDelay: number;
	rooms: 'all' | 'official' | 'public' | string[];
	privateRooms: string[];
	ignoreRooms: string[];
	initCmds: string[];
	exceptions: Record<string, string | true>;
	ranks: string[];
	globalPermissions: Record<string, string>;
	commandTokens: string[];
	defaultPermission: string;
	permissionExceptions: Record<string, string>;
	botguide: string;
	pmhelp: string;
	language: string;
	debug: {
		error: boolean;
		ok: boolean;
		errlog: boolean;
		info: boolean;
		room: boolean;
		monitor: boolean;
		status: boolean;
		battle: boolean;
		debug: boolean;
		cmdr: boolean;
		recv: boolean;
		sent: boolean;
	};
	moderation: {
		modException: string;
		allowmute?: boolean;
		disableModNote?: boolean;
		MOD_CONSTS: {
			FLOOD_MESSAGE_NUM?: number;
			FLOOD_PER_MSG_MIN?: number;
			FLOOD_MESSAGE_TIME?: number;
			MIN_CAPS_LENGTH?: number;
			MIN_CAPS_PROPORTION?: number;
			MAX_STRETCH?: number;
			MAX_REPEAT?: number;
		};
		values: {
			'spam-p'?: number;
			spam?: number;
			'spam-link'?: number;
			'flood-hard'?: number;
			flood?: number;
			caps?: number;
			stretch?: number;
			banwords?: number;
			inapwords?: number;
			servers?: number;
			youtube?: number;
			spoiler?: number;
			replays?: number;
		};
		modDefault: {
			caps: number;
			stretching: number;
			flooding: number;
			spam: number;
			bannedwords: number;
			inapropiate: number;
			spoiler: number;
			youtube: number;
			psservers: number;
			replays: number;
			multiple: number;
			zerotol: number;
		};
		punishments: string[];
		psServersExcepts?: string[];
		zeroToleranceDefaultLevel?: string;
		zeroToleranceLevels?: Record<string, { name: string; value: number }>;
	};
	aceptAll: boolean;
	maxBattles: number;
	initBattleMsg: string[];
	winmsg: string[];
	losemsg: string[];
	battleMessages: Record<string, { self?: string[]; foe?: string[] } | string[]>;
	formatMods: Record<string, string>;
	battleModules: Record<string, string>;
	battleLog?: LogConfig;
	abandonedBattleAutojoin: boolean;
	ladderCheckInterval: number;
	ladderNumberOfBattles: number;
	formatAliases: Record<string, string>;
	tourDefault: {
		format: string;
		type: 'elimination' | 'roundrobin';
		maxUsers: number | null;
		timeToStart: number;
		autodq: number;
		scoutProtect: boolean;
	};
	leaderboards: Record<string, LeaderboardConfig>;
	chatLogger: LogConfig & {
		rooms: string[];
		ignore: {
			tournament: string[];
			formats: boolean;
			challstr: boolean;
			updateuser: boolean;
			queryresponse: boolean;
		};
		logIntroMessages: boolean;
	};
	groupchats: Record<string, { toJoin: string[]; onJoin: string[]; onLeave: string[] }>;
	groupChatTryJoinInterval: number;
}

function issue(text: string): void {
	console.log('issue'.yellow + '\t' + text);
}

type KeyOf<T, V> = { [K in keyof T]-?: V extends T[K] ? K : never }[keyof T];

function enforceConfigArray(key: KeyOf<ConfigType, any[]>): void {
	if (!Config[key] || !Array.isArray(Config[key])) {
		issue('Config.' + key + ' is not an array');
		Config[key] = [];
	}
}

export function enforceConfigObject<T extends keyof ConfigType>(
	key: KeyOf<ConfigType, ConfigType[T]>,
	defaultValue: ConfigType[KeyOf<ConfigType, ConfigType[T]>]
): void {
	if (!Config[key] || typeof Config[key] !== 'object' || Array.isArray(Config[key])) {
		issue('Config' + key + ' is not an object');
		Config[key] = defaultValue;
	}
}

export function checkConfig(): void {
	if (Config.server && Config.server.substr(-8) === '.psim.us') {
		issue(
			'WARNING: YOUR SERVER URL ' +
				Config.server.red +
				' SEEMS A CLIENT URL, NOT A SERVER ONE. USE ' +
				'node serverconfig.js'.cyan +
				' TO GET THE CORRECT SERVER, PORT AND SERVERID VALUES\n'
		);
	}
	if (typeof Config.rooms !== 'string' || !['all', 'official', 'public'].includes(Config.rooms)) {
		enforceConfigArray('rooms');
	}
	enforceConfigArray('privateRooms');
	enforceConfigArray('ignoreRooms');
	enforceConfigArray('initCmds');
	enforceConfigObject('exceptions', {});
	enforceConfigArray('ranks');
	enforceConfigObject('permissionExceptions', {});
	enforceConfigObject('debug', {
		error: false,
		ok: false,
		errlog: false,
		info: false,
		room: false,
		monitor: false,
		status: false,
		battle: false,
		debug: false,
		cmdr: false,
		recv: false,
		sent: false,
	});
}
