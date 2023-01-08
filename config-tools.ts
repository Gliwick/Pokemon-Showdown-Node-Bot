/* Process arguments */

import { KeyOfValueType } from './global-types';
import { colors } from './index';
import { issue } from './log';

export interface LogConfig {
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
	exceptions: Record<string, string>;
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
		zeroToleranceLevels: Record<string, { name: string; value: number }>;
	};
	acceptAll: boolean;
	maxBattles: number;
	initBattleMsg: string[];
	winmsg: string[];
	losemsg: string[];
	battleMessages: Record<string, { self?: string[]; foe?: string[] } | string[]>;
	battleModules: Record<string, string>;
	battleFormatMods: Record<string, string>;
	battleModsDir?: string;
	battleLog?: LogConfig;
	abandonedBattleAutojoin: boolean;
	ladderCheckInterval: number;
	ladderNumberOfBattles: number;
	formatAliases: Record<string, string>;
	tourDefault: {
		format: string;
		type: 'elimination' | 'roundrobin';
		eliminationCount?: number;
		maxUsers: number | null;
		timeToStart: number | null;
		autodq: number | null;
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
	autoInvite: {
		linked: string;
		private: string;
		rank: string;
	}[];
	groupchats: Record<string, { toJoin: string[]; onJoin: string[]; onLeave: string[] }>;
	groupChatTryJoinInterval: number;
	disableDownload?: boolean;
	commandChar: string;
	disableSeen?: boolean;
	disableAlts?: boolean;
}

export function validateConfigArray(key: KeyOfValueType<ConfigType, any[]>): void {
	if (!Config[key] || !Array.isArray(Config[key])) {
		issue('Config.' + key + ' is not an array');
		Config[key] = [];
	}
}

export function validateConfigObject<T extends keyof ConfigType>(
	key: KeyOfValueType<ConfigType, ConfigType[T]>,
	defaultValue: ConfigType[KeyOfValueType<ConfigType, ConfigType[T]>]
): void {
	if (!Config[key] || typeof Config[key] !== 'object' || Array.isArray(Config[key])) {
		issue('Config.' + key + ' is not an object');
		Config[key] = defaultValue;
	}
	Config[key] = Object.assign(defaultValue as any, Config[key]);
}

export function checkConfig(): void {
	if (Config.server && Config.server.substr(-8) === '.psim.us') {
		issue(
			'WARNING: YOUR SERVER URL ' +
				colors.red(Config.server) +
				' SEEMS A CLIENT URL, NOT A SERVER ONE. USE ' +
				colors.cyan('node getserver.js') +
				' TO GET THE CORRECT SERVER, PORT AND SERVERID VALUES\n'
		);
	}
	if (typeof Config.rooms !== 'string' || !['all', 'official', 'public'].includes(Config.rooms)) {
		validateConfigArray('rooms');
	}
	validateConfigArray('privateRooms');
	validateConfigArray('ignoreRooms');
	validateConfigArray('initCmds');
	validateConfigObject('exceptions', {});
	validateConfigArray('ranks');
	validateConfigObject('permissionExceptions', {});
	validateConfigObject('debug', {
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
	validateConfigObject('globalPermissions', {
		voice: '+',
		driver: '%',
		moderator: '@',
		roomowner: '#',
		admin: '&',
	});
	if (Config.battleModsDir && !Config.battleModsDir.endsWith('/')) Config.battleModsDir += '/';
}
