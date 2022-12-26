/*
	Groupchats Tools
*/

import { toId } from '../../tools';
import { Feature } from '../index';

export class GroupChatsManager implements Feature {
	id = 'groupchats';
	desc = 'Tools for groupchats (temporal rooms)';
	groupChatTryJoinInterval = 60000;
	ignored = {};
	timer: number | null = null;

	constructor() {
		this.groupChatTryJoinInterval = Config.groupChatTryJoinInterval || 60000;
	};

	isConfigured(room) {
		if (!Config.groupchats || !Config.groupchats[room]) return false;
		return true;
	}

	parseInit(room) {
		if (!Config.groupchats[room].onJoin || !Config.groupchats[room].onJoin.length) return;
		Bot.sendRoom(room, Config.groupchats[room].onJoin.slice(0), 2000);
	}

	parseDeinit(room) {
		if (!Config.groupchats[room].onLeave || !Config.groupchats[room].onLeave.length) return;
		setTimeout(() => {
			Bot.sendRoom('', Config.groupchats[room].onLeave.slice(0), 2000);
		}, 1000);
	}

	runAutopromote(room, by) {
		if (!Settings.settings.autopromote) return;
		if (!Settings.settings.autopromote[room]) return;
		var autoPromotion = Settings.settings.autopromote[room];
		if (!autoPromotion.enabled) return;
		var userid = toId(by);
		if (autoPromotion.users && autoPromotion.users[userid] && !Tools.equalOrHigherRank(by.charAt(0), autoPromotion.users[userid])) return Bot.say(room, '/roompromote ' + userid + "," + autoPromotion.users[userid]);
		if (autoPromotion.all && !Tools.equalOrHigherRank(by.charAt(0), autoPromotion.all)) return Bot.say(room, '/roompromote ' + userid + "," + autoPromotion.all);
	}

	runWelcomeMessage(room, by) {
		if (!Settings.settings.pmwmsg) return;
		if (!Settings.settings.pmwmsg[room]) return;
		if (!Settings.settings.pmwmsg[room].enabled || !Settings.settings.pmwmsg[room].msg) return;
		Bot.say(room, "/pm " + by + "," + Tools.stripCommands(Settings.settings.pmwmsg[room].msg));
	}

	intervalJoin() {
		if (!Config.groupchats) return;
		if (!Bot.status.connected) return;
		var cmds = [];
		for (var id in Config.groupchats) {
			if (!Config.groupchats[id].toJoin) continue;
			if (this.ignored[id]) return;
			if (!Bot.rooms[id]) cmds = cmdthis.concat(Config.groupchats[id].toJoin);
		}
		if (cmds.length) Bot.sendRoom('', cmds, 2000);
	};

	init() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
		this.timer = setInterval(this.intervalJoin, this.groupChatTryJoinInterval);
	};

	parse(room: string, message: string, isIntro: boolean, spl: string[]) {
		if (this.ignored[room]) return;
		if (!isIntro && spl[0] === 'J' || spl[0] === 'j') {
			this.runAutopromote(room, spl[1]);
			this.runWelcomeMessage(room, spl[1]);
			return;
		}
		if (!this.isConfigured(room)) return;
		if (spl[0] === 'init') return this.parseInit(room);
		if (spl[0] === 'deinit') return this.parseDeinit(room);
	};

	destroy() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
		if (Features[this.id]) delete Features[this.id];
	};
};