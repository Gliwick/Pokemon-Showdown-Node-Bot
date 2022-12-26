
export interface Format {
    name: string;
    team: boolean;
    ladder: boolean;
    chall: boolean;
}

interface LogConfig {
    ageOfLogs: number
}

export interface ConfigType {
    commandChar: any;
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
        allowmute: boolean;
        disableModNote: boolean;
        MOD_CONSTS: {
            FLOOD_MESSAGE_NUM: number;
            FLOOD_PER_MSG_MIN: number;
            FLOOD_MESSAGE_TIME: number;
            MIN_CAPS_LENGTH: number;
            MIN_CAPS_PROPORTION: number;
            MAX_STRETCH: number;
            MAX_REPEAT: number;
        };
        values: {
            'spam-p': number;
            spam: number;
            'spam-link': number;
            'flood-hard': number;
            flood: number;
            caps: number;
            stretch: number;
            banwords: number;
            inapwords: number;
            servers: number;
            youtube: number;
            spoiler: number;
            replays: number;
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
        psServersExcepts: string[];
        zeroToleranceDefaultLevel: string,
        zeroToleranceLevels: Record<string, { name: string, value: number }>;
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
    leaderboards: Record<string, {
        winnerPoints: number;
        finalistPoints: number;
        semiFinalistPoints: number;
        battlePoints: number;
        onlyOfficial: boolean;
    }>;
    chatLogger: LogConfig & {
        rooms: string[];
        ignore: {
            tournament: string[];
            formats: boolean;
            challstr: boolean;
            updateuser: boolean;
            queryresponse: boolean;
        },
        logIntroMessages: boolean;
    };
    groupchats: Record<string, { toJoin: string[]; onJoin: string[]; onLeave: string[] }>;
    groupChatTryJoinInterval: number;
}
