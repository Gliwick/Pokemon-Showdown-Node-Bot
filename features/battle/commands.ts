/*
	Battle commands (challenges, tours, ladder)
*/

import { get, IncomingMessage } from 'http';
import { inspect } from 'util';

import { Command, CommandModuleManager, Context } from '../../command-parser';
import { errlog } from '../../log';
import { getGroup, getTargetRoom, parseAliases, toId, uploadToHastebin } from '../../tools';
import { BattleManager } from '.';

class BattleModule implements CommandModuleManager {
	init(): void {
		Settings.addPermissions(['challenge', 'searchbattle', 'jointour']);
	}
}

export const manager = BattleModule;

function getTeamCallback(this: Context, name: string, format: string, res: IncomingMessage): void {
	const data = { data: '' };
	res.on('data', (part: string): void => {
		data.data += part;
	});
	res.on(
		'end',
		function (this: Context): void {
			if (data.data === '{"message":"Document not found."}') {
				this.reply(this.trad('err1'));
				return;
			}
			let team;
			let packed;
			const { teamBuilder } = Features.getFeature(BattleManager);
			try {
				team = teamBuilder.teamToJSON(data.data);
				packed = teamBuilder.packTeam(team);
			} catch (e: any) {
				errlog(e.stack);
				this.reply(this.trad('err2'));
				return;
			}
			if (teamBuilder.addTeam(name, format, packed)) {
				this.sclog();
				this.reply(this.trad('team') + ' __' + name + '__ ' + this.trad('added'));
			} else {
				this.reply(this.trad('err3'));
			}
		}.bind(this)
	);
	res.on(
		'error',
		function (this: Context): void {
			this.reply(this.trad('err4'));
		}.bind(this)
	);
}

export const commands: Record<string, string | Command> = {
	jsbattle: 'evalbattle',
	eb: 'evalbattle',

	evalbattle: function (arg, by, room) {
		if (!this.isExcepted) return false;
		this.sclog();
		let tarRoom = room;
		const tarObj = getTargetRoom(arg);
		if (tarObj) {
			arg = tarObj.arg;
			tarRoom = tarObj.room;
		}
		const manager = Features.getFeature(BattleManager);
		if (!manager.battleBot?.battles) return false;
		if (!manager.battleBot.battles[tarRoom]) return this.reply('Battle "' + tarRoom + '" not found');
		let result;
		try {
			result = manager.battleBot.battles[tarRoom].eval(arg);
			this.say(room, '``' + JSON.stringify(result) + '``');
		} catch (e: any) {
			this.say(room, e.name + ': ' + e.message);
		}
	},

	reloadteams: function () {
		if (!this.isExcepted) return false;
		this.sclog();
		if (Features.getFeature(BattleManager).teamBuilder.loadTeamList(true)) {
			this.reply(this.trad('s'));
		} else {
			this.reply(this.trad('e'));
		}
	},

	reloadbattle: function () {
		if (!this.isExcepted) return false;
		this.sclog();
		try {
			Features.getFeature(BattleManager).reloadBot();
			this.reply('Battle modules hotpatched');
		} catch (e: any) {
			this.reply('Error: ' + inspect(e));
		}
	},

	unblockchallenges: 'blockchallenges',
	blockchallenges: function (arg, by, room, cmd) {
		if (!this.isRanked(getGroup('admin'))) return;
		this.sclog();
		if (cmd === 'blockchallenges') {
			this.say('', '/blockchallenges');
			this.say(room, this.trad('b'));
		} else {
			this.say('', '/unblockchallenges');
			this.say(room, this.trad('nb'));
		}
	},

	move: function (arg, by, room) {
		this.sclog();
		if (this.roomType !== 'battle') return this.reply(this.trad('notbattle'));
		try {
			Features.getFeature(BattleManager).battleBot.battles[room].makeDecision(true);
		} catch (e: any) {
			this.reply('Error: ' + inspect(e));
		}
	},

	jointours: function (arg, by, room) {
		if (!this.can('jointour')) return false;
		let tarRoom = room;
		const targetObj = getTargetRoom(arg);
		let textHelper = '';
		if (targetObj && this.isExcepted) {
			arg = targetObj.arg;
			tarRoom = targetObj.room;
			textHelper = ' (' + tarRoom + ')';
		}
		if (!Bot.rooms[tarRoom] || Bot.rooms[tarRoom].type !== 'chat') return this.reply(this.trad('notchat') + textHelper);
		if (!Settings.settings['jointours']) Settings.settings['jointours'] = {};
		if (toId(arg) === 'off') {
			if (!Settings.settings['jointours'][tarRoom]) return this.reply(this.trad('ad') + ' ' + tarRoom);
			delete Settings.settings['jointours'][tarRoom];
			Settings.save();
			this.sclog();
			this.reply(this.trad('d') + ' ' + tarRoom);
		} else {
			if (Settings.settings['jointours'][tarRoom]) return this.reply(this.trad('ae') + ' ' + tarRoom);
			Settings.settings.jointours[tarRoom] = true;
			Settings.save();
			this.sclog();
			this.reply(this.trad('e') + ' ' + tarRoom);
		}
	},

	sb: 'searchbattle',
	searchbattle: function (arg, by, room) {
		if (!this.can('searchbattle')) return false;
		if (Settings.lockdown) return;
		if (!arg || !arg.length) return this.reply(this.trad('e1'));
		const format = parseAliases(arg);
		if (!Formats[format]?.ladder) return this.reply(this.trad('e21') + ' ' + format + ' ' + this.trad('e22'));

		const { ladderManager, teamBuilder } = Features.getFeature(BattleManager);
		if (Formats[format].team && !teamBuilder.hasTeam(format)) {
			return this.reply(this.trad('e31') + ' ' + format + '. ' + this.trad('e32'));
		}
		ladderManager.reportsRoom = room;
		const cmds = [];
		const team = teamBuilder.getTeam(format);
		if (team) cmds.push('|/useteam ' + team);
		cmds.push('|/search ' + arg);
		this.send(cmds);
	},

	ladderstop: 'ladderstart',
	ladderstart: function (arg, by, room, cmd) {
		if (!this.isRanked(getGroup('admin'))) return false;
		if (cmd === 'ladderstop') {
			this.sclog();
			if (Features.getFeature(BattleManager).ladderManager.stop()) this.reply(this.trad('stop'));
			return;
		}
		const format = parseAliases(arg);
		if (!Formats[format]?.ladder) return this.reply(this.trad('e21') + ' ' + format + ' ' + this.trad('e22'));

		const { ladderManager, teamBuilder } = Features.getFeature(BattleManager);
		if (Formats[format].team && !teamBuilder.hasTeam(format)) {
			return this.reply(this.trad('e31') + ' ' + format + '. ' + this.trad('e32'));
		}
		if (ladderManager.start(format)) {
			this.reply(this.trad('start') + ' ' + format);
			this.sclog();
		}
	},

	challme: 'challenge',
	challengeme: 'challenge',
	chall: 'challenge',
	challenge: function (arg, by, room, cmd) {
		if (!this.can('challenge')) return false;
		if (Settings.lockdown) return;
		const args = ['challme', 'challengeme'].includes(cmd) ? [by, arg] : arg.split(',');
		if (args.length < 2) return this.reply(this.trad('e11') + ': ' + this.cmdToken + cmd + ' ' + this.trad('e12'));
		const format = parseAliases(args[1]);
		if (!format || !Formats[format]?.chall) {
			return this.reply(this.trad('e21') + ' "' + format + '" ' + this.trad('e22'));
		}

		const { teamBuilder } = Features.getFeature(BattleManager);
		if (Formats[format].team && !teamBuilder.hasTeam(format)) {
			return this.reply(this.trad('e31') + ' ' + format + '. ' + this.trad('e32'));
		}
		const cmds = [];
		const team = teamBuilder.getTeam(format);
		if (team) cmds.push('|/useteam ' + team);
		cmds.push('|/challenge ' + toId(args[0]) + ', ' + format);
		this.send(cmds);
	},

	checktour: 'jointour',
	tourjoin: 'jointour',
	jt: 'jointour',
	jointour: function (arg, by, room, cmd) {
		if (!this.can('jointour')) return false;
		if (Settings.lockdown) return;
		if (this.roomType !== 'chat') return this.reply(this.trad('notchat'));

		const { teamBuilder, tourManager } = Features.getFeature(BattleManager);
		if (!tourManager.tourData[room]?.format) return this.reply(this.trad('e1'));
		if (cmd === 'checktour') return this.say(room, '/tour getupdate');
		if (tourManager.tourData[room].isJoined) return this.reply(this.trad('e2'));
		if (tourManager.tourData[room].isStarted) return this.reply(this.trad('e3'));
		const format = toId(tourManager.tourData[room].format);
		if (Formats[format] && Formats[format].team && !teamBuilder.hasTeam(format)) {
			return this.reply(this.trad('e41') + ' ' + format + '. ' + this.trad('e42'));
		}
		this.reply('/tour join');
	},

	leavetour: function (arg, by, room) {
		if (!this.can('jointour')) return false;
		if (this.roomType !== 'chat') return this.reply(this.trad('notchat'));
		if (
			!Features.getFeature(BattleManager).tourManager.tourData[room] ||
			!Features.getFeature(BattleManager).tourManager.tourData[room].format
		)
			return this.reply(this.trad('e1'));
		if (!Features.getFeature(BattleManager).tourManager.tourData[room].isJoined) return this.reply(this.trad('e2'));
		this.reply('/tour leave');
	},

	botteams: 'team',
	teams: 'team',
	team: function (arg, by, room, cmd) {
		if (!this.isRanked(getGroup('admin'))) return false;
		if (!arg) return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u2'));
		const argArray = arg.split(',');
		const opt = toId(argArray[0]);
		let id: string;
		let name: string;
		const { teamBuilder } = Features.getFeature(BattleManager);
		switch (opt) {
			case 'add':
			case 'new':
				if (argArray.length < 4) {
					return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u3'));
				}
				name = toId(argArray[1]);
				const format = parseAliases(argArray[2]);
				let link = argArray[3].trim();
				if (!link) return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u2'));
				if (link.endsWith('/')) link = link.substr(0, link.length - 1);
				const splitedLink = link.split('/');
				link = 'http://hastebin.com/raw/' + splitedLink[splitedLink.length - 1];
				if (!Formats[format]) return this.reply(this.trad('format') + ' __' + format + '__ ' + this.trad('notexists'));
				this.reply(this.trad('download') + '... (' + link + ')');
				const getTeamCallbackFn = getTeamCallback.bind(this);
				get(link, ((res: IncomingMessage): void => getTeamCallbackFn(name, format, res)).bind(this)).on(
					'error',
					function (this: Context): void {
						this.reply(this.trad('err4'));
					}.bind(this)
				);
				break;
			case 'get':
				if (argArray.length < 2) return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u5'));
				id = toId(argArray[1]);
				if (!teamBuilder.dynTeams[id]) {
					return this.reply(this.trad('team') + ' __' + id + '__ ' + this.trad('notexists'));
				}
				try {
					const data = teamBuilder.exportTeam(teamBuilder.dynTeams[id].packed);
					uploadToHastebin(
						data,
						function (this: Context, r: boolean, link: any): void {
							if (r) return this.pmReply(id + ': ' + link);
							else this.pmReply(this.trad('err'));
						}.bind(this)
					);
				} catch (e: any) {
					errlog(e.stack);
					this.pmReply(this.trad('err2'));
				}
				break;
			case 'check':
				if (argArray.length < 2) return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u6'));
				id = toId(argArray[1]);
				if (!teamBuilder.dynTeams[id]) {
					return this.reply(this.trad('team') + ' __' + id + '__ ' + this.trad('notexists'));
				}
				const cmds: string[] = [];
				const team = teamBuilder.dynTeams[id].packed;
				if (team) cmds.push('|/useteam ' + team);
				cmds.push('|/challenge ' + toId(argArray[2] || by) + ', ' + teamBuilder.dynTeams[id].format);
				this.sclog();
				this.send(cmds);
				break;
			case 'delete':
			case 'remove':
				if (argArray.length < 2) return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u4'));
				name = toId(argArray[1]);
				if (teamBuilder.removeTeam(name)) {
					this.sclog();
					this.reply(this.trad('team') + ' __' + name + '__ ' + this.trad('removed'));
				} else {
					this.reply(this.trad('team') + ' __' + name + '__ ' + this.trad('notexists'));
				}
				break;
			default:
				return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u2'));
		}
	},

	viewteamlist: 'teamlist',
	viewteamslist: 'teamlist',
	teamslist: 'teamlist',
	teamlist: function () {
		if (!this.isRanked(getGroup('admin'))) return false;
		const teamsStr = this.trad('list') + ':\n\n';
		const { teamBuilder } = Features.getFeature(BattleManager);
		const teams = Object.entries(teamBuilder.staticTeams)
			.flatMap(([format, formatTeams]) => formatTeams.map((team) => [format, team]))
			.map(
				([format, team]) =>
					this.trad('format') + ': ' + format + ' | ' + this.trad('pokemon') + ': ' + teamBuilder.teamOverview(team) + '\n'
			);
		const nTeams = teams.length;
		if (!nTeams) return this.pmReply(this.trad('empty'));
		uploadToHastebin(
			teamsStr,
			function (this: Context, r: boolean, link: any): void {
				if (r) return this.pmReply(this.trad('list') + ': ' + link);
				else this.pmReply(this.trad('err'));
			}.bind(this)
		);
	},

	formatlist: function () {
		if (!this.isRanked(getGroup('admin'))) return false;
		const teams = Features.getFeature(BattleManager).teamBuilder.staticTeams;
		const genToFormats = Object.keys(teams).reduce((acc, format) => {
			const gen = format.charAt(3);
			if (!acc[gen]) acc[gen] = [];
			acc[gen].push(format);
			return acc;
		}, {} as Record<string, string[]>);
		for (const gen of Object.keys(genToFormats).sort().reverse()) {
			this.pmReply('gen ' + gen + ': ' + genToFormats[gen].join(', '));
		}
	},
};
