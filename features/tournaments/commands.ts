/*
	Tournaments Commands
*/

import { Command, CommandModuleManager, Context } from '../../command-parser';
import { ConfigType, validateConfigObject } from '../../config-tools';
import { parseAliases, toId, toName, uploadToHastebin } from '../../tools';
import { TournamentsManager } from '.';

class TournamentsModule implements CommandModuleManager {
	init(): void {
		Settings.addPermissions(['tournament', 'rank', 'official']);
	}
}

export const manager = TournamentsModule;

function tryGetRoomName(room: string): string {
	return Bot.rooms[room]?.title || room;
}

export const commands: Record<string, string | Command> = {
	tourhelp: function () {
		this.restrictReply('Usage: ' + this.cmdToken + this.trad('h'), 'tournament');
	},

	tourstart: 'tourend',
	tourend: function (arg, by, room, cmd) {
		if (this.roomType !== 'chat' || !this.can('tournament')) return;
		const tourData = Features.getFeature(TournamentsManager).tourData[room];
		if (!tourData) return this.reply(this.trad('err'));
		if (cmd === 'tourstart' && tourData.isStarted) return this.reply(this.trad('err2'));
		this.reply('/tournament ' + (cmd === 'tourend' ? 'end' : 'start'));
	},

	maketour: 'tournament',
	newtour: 'tournament',
	tour: 'tournament',
	tournament: function (arg, by, room) {
		if (this.roomType !== 'chat' || !this.can('tournament')) return;
		const manager = Features.getFeature(TournamentsManager);
		if (manager.tourData[room]) {
			if (toId(arg) === 'end') return this.parse(this.cmdToken + 'tourend');
			if (toId(arg) === 'start') return this.parse(this.cmdToken + 'tourstart');
			return this.reply(this.trad('e2'));
		}
		validateConfigObject('tourDefault', {
			format: 'ou',
			type: 'elimination',
			maxUsers: null,
			timeToStart: 30 * 1000,
			autodq: 1.5,
			scoutProtect: false,
		});
		const details = { ...Config.tourDefault };
		if (arg && arg.length) {
			const args = arg.split(',');
			const params: Partial<Record<keyof ConfigType['tourDefault'], string>> = {};
			let splArg;
			for (let i = 0; i < args.length; i++) {
				args[i] = args[i].trim();
				if (!args[i]) continue;
				splArg = args[i].split('=');
				if (splArg.length < 2) {
					switch (i) {
						case 0:
							params.format = args[i];
							break;
						case 1:
							params.timeToStart = args[i];
							break;
						case 2:
							params.autodq = args[i];
							break;
						case 3:
							params.maxUsers = args[i];
							break;
						case 4:
							params.type = args[i];
							break;
					}
				} else {
					const idArg = toId(splArg[0]);
					const valueArg = splArg[1].trim();
					switch (idArg) {
						case 'format':
						case 'tier':
							params.format = valueArg;
							break;
						case 'time':
						case 'singups':
						case 'timer':
							params.timeToStart = valueArg;
							break;
						case 'autodq':
						case 'dq':
							params.autodq = valueArg;
							break;
						case 'maxusers':
						case 'users':
							params.maxUsers = valueArg;
							break;
						case 'generator':
						case 'type':
							params.type = valueArg;
							break;
						case 'scouting':
						case 'scout':
						case 'setscout':
						case 'setscouting':
							params.scoutProtect = valueArg;
							break;
						default:
							return this.reply(
								`${this.trad('param')} ${idArg} ${this.trad('paramhelp')}: tier, timer, dq, users, type, scout`
							);
					}
				}
			}
			if (params.format) {
				const format = parseAliases(params.format);
				if (!Formats[format]?.chall) return this.reply(this.trad('e31') + ' ' + format + ' ' + this.trad('e32'));
				details.format = format;
			}
			if (params.timeToStart) {
				if (toId(params.timeToStart) === 'off') {
					details.timeToStart = null;
				} else {
					const time = parseInt(params.timeToStart);
					if (!time || time < 10) return this.reply(this.trad('e4'));
					details.timeToStart = time * 1000;
				}
			}
			if (params.autodq) {
				if (toId(params.autodq) === 'off') {
					details.autodq = null;
				} else {
					const dq = parseFloat(params.autodq);
					if (!dq || dq < 0) return this.reply(this.trad('e5'));
					details.autodq = dq;
				}
			}
			if (params.maxUsers) {
				if (toId(params.maxUsers) === 'off') {
					details.maxUsers = null;
				} else {
					const musers = parseInt(params.maxUsers);
					if (!musers || musers < 4) return this.reply(this.trad('e6'));
					details.maxUsers = musers;
				}
			}
			if (params.type) {
				const type: string = toId(params.type);
				if (type !== 'elimination' && type !== 'roundrobin') return this.reply(this.trad('e7'));
				details.type = type;
			}
			if (params.scoutProtect) {
				const scout = toId(params.scoutProtect);
				details.scoutProtect = ['yes', 'on', 'true', 'allow', 'allowed'].includes(scout);
			}
		}
		manager.newTour(room, details);
		setTimeout(
			function (this: Context): void {
				if (manager.tournaments[room] && !manager.tourData[room]) {
					Bot.say(room, this.trad('notstarted'));
					delete manager.tournaments[room];
				}
			}.bind(this),
			2500
		);
	},

	unofficial: 'official',
	official: function (arg, by, room, cmd) {
		if (!this.can('official')) return;
		const manager = Features.getFeature(TournamentsManager);
		if (!manager.leaderboards.isConfigured(room)) return this.reply(this.trad('not') + ' ' + room);
		if (!manager.tourData[room]) return this.reply(this.trad('notour'));
		if (cmd === 'unofficial') {
			if (!manager.tourData[room].isOfficialTour) return this.reply(this.trad('already-not'));
			manager.tourData[room].isOfficialTour = false;
			this.reply(this.trad('unofficial'));
		} else {
			if (manager.tourData[room].isOfficialTour) return this.reply(this.trad('already'));
			manager.tourData[room].isOfficialTour = true;
			this.reply(this.trad('official'));
		}
	},

	rank: 'leaderboard',
	ranking: 'leaderboard',
	top: 'leaderboard',
	leaderboards: 'leaderboard',
	leaderboard: function (arg, by, room, cmd) {
		const args = arg.split(',');
		let opt = cmd;
		let tarRoom = '';
		if (cmd.startsWith('leaderboard')) {
			opt = toId(args.shift());
			cmd += ' ' + opt + ',';
		}
		const manager = Features.getFeature(TournamentsManager);
		switch (opt) {
			case 'rank':
			case 'ranking':
				tarRoom = room;
				if (this.roomType !== 'chat') tarRoom = toId(args.shift() || '');
				if (args.length > 1) tarRoom = toId(args.shift() || '');
				if (!tarRoom) return this.restrictReply(`${this.trad('usage')}: ${this.cmdToken + cmd} [room], [user]`, 'rank');
				if (!manager.leaderboards.isConfigured(tarRoom)) return this.restrictReply(`${this.trad('not')} ${tarRoom}`, 'rank');
				const target = toId(args[0] || by);
				if (target.length > 18) return this.restrictReply(this.trad('invuser'));

				const { name, points, wins, finals, semis, tours, battles } = manager.leaderboards.getPoints(tarRoom, target);
				const txt =
					`${this.trad('rank')} **${toName(name)}** ${this.trad('in')} __${toName(tryGetRoomName(tarRoom))}__ | ` +
					`${this.trad('points')}: ${points} | ` +
					Object.entries({ wins, finals, semis })
						.map(([k, v]) => `${this.trad(k)}: ${v} ${this.trad('times')}`)
						.join(', ') +
					`. ${this.trad('total')}: ${tours} ${this.trad('tours')}, ${battles} ${this.trad('bwon')}.`;
				this.restrictReply(txt, 'rank');
				break;
			case 'top':
				if (args.length > 0) tarRoom = toId(args[0]);
				if (!tarRoom && this.roomType === 'chat') tarRoom = room;
				if (!tarRoom) return this.restrictReply(`${this.trad('usage')}: ${this.cmdToken + cmd} [room], [user]`, 'rank');
				if (!manager.leaderboards.isConfigured(tarRoom)) return this.restrictReply(`${this.trad('not')} ${tarRoom}`, 'rank');
				const top = manager.leaderboards.getTop(tarRoom);
				if (!top?.length) return this.restrictReply(this.trad('empty') + ' ' + tarRoom, 'rank');

				const topResults = top.slice(0, 5).map((r, i) => `__#${i + 1}__ **${toName(r[0])}** (${r[6]})`);
				this.restrictReply(`**${toName(tryGetRoomName(tarRoom))}** | ${topResults.join(', ')}`, 'rank');
				break;
			case 'table':
				if (!this.isRanked('roomowner')) return false;
				if (args.length > 0) tarRoom = toId(args[0]);
				if (!tarRoom && this.roomType === 'chat') tarRoom = room;
				if (!tarRoom) return this.reply(this.trad('usage') + ': ' + this.cmdToken + cmd + ' [room]');
				if (!manager.leaderboards.isConfigured(tarRoom)) return this.reply(this.trad('not') + ' ' + tarRoom);
				const size = args[1] ? parseInt(args[1]) : 100;
				if (!size || size < 0) return this.reply(`${this.trad('usage')}: ${this.cmdToken + cmd} [room], [size]`);
				const table = manager.leaderboards.getTable(tarRoom, size);
				if (!table) return this.reply(this.trad('empty') + ' ' + tarRoom);

				uploadToHastebin(
					table,
					function (this: Context, r: boolean, link: any): void {
						if (r) return this.pmReply(this.trad('table') + ' (' + tarRoom + '): ' + link);
						else this.pmReply(this.trad('err'));
					}.bind(this)
				);
				break;
			case 'reset':
				if (!this.isExcepted) return false;
				if (args.length < 1 || !toId(args[0])) return this.reply(`${this.trad('usage')}: ${this.cmdToken + cmd} [room]`);

				tarRoom = toId(args[0]);
				const code = manager.leaderboards.getResetHashCode(tarRoom);
				if (!code) return this.reply(this.trad('empty') + ' ' + tarRoom);
				this.reply(
					`${this.trad('use')} \`\`${this.cmdToken + this.handler} confirmreset, ${code}\`\` ${this.trad('confirm')} ${room}`
				);
				break;
			case 'confirmreset':
				if (!this.isExcepted) return false;
				if (args.length < 1 || !toId(args[0])) return this.reply(`${this.trad('usage')}: ${this.cmdToken + cmd} [hashcode]`);
				const _code = args[0].trim();
				const resetCode = manager.leaderboards.execResetHashCode(_code);
				if (!resetCode) return this.reply(this.trad('invhash'));

				this.sclog();
				this.reply(this.trad('data') + ' __' + resetCode + '__ ' + this.trad('del'));
				break;
			case 'viewconfig':
				if (!this.isExcepted) return false;
				if (args.length < 1 || !toId(args[0])) return this.reply(`${this.trad('usage')}: ${this.cmdToken + cmd} [room]`);

				tarRoom = toId(args[0]);
				const { winnerPoints, finalistPoints, semiFinalistPoints, battlePoints, onlyOfficial } =
					manager.leaderboards.getConfig(tarRoom);
				if (Config.leaderboards[tarRoom]) {
					this.reply(
						`Room: ${tarRoom} | \`\`config.js\`\` - static | W: ${winnerPoints}, F: ${finalistPoints}, SF: ${semiFinalistPoints}, B: ${
							battlePoints + (onlyOfficial ? ' | Only official tours' : '')
						}`
					);
				} else if (Settings.settings.leaderboards?.[tarRoom]) {
					this.reply(
						`Room: ${tarRoom} | W: ${winnerPoints}, F: ${finalistPoints}, SF: ${semiFinalistPoints}, B: ${
							battlePoints + (onlyOfficial ? ' | Only official tours' : '')
						}`
					);
				} else {
					this.reply(this.trad('not') + ' ' + tarRoom);
				}
				break;
			case 'setconfig':
				if (!this.isExcepted) return false;
				if (!Settings.settings.leaderboards) Settings.settings.leaderboards = {};
				if (args.length < 2 || !toId(args[0]) || (args[6] && toId(args[6]) !== 'official' && toId(args[6]) !== 'all')) {
					return this.reply(
						`${this.trad('usage')}: ${this.cmdToken + cmd} [room], [on/off], [W], [F], [SF], [B], [official/all]`
					);
				}

				tarRoom = toId(args[0]);
				const enabled = toId(args[1]);
				const rConfAux = manager.leaderboards.getConfig(tarRoom);
				if (['on', 'enabled'].includes(enabled)) {
					if (args[2]) rConfAux.winnerPoints = parseInt(args[2]);
					if (args[3]) rConfAux.finalistPoints = parseInt(args[3]);
					if (args[4]) rConfAux.semiFinalistPoints = parseInt(args[4]);
					if (args[5]) rConfAux.battlePoints = parseInt(args[5]);
					if (args[6]) rConfAux.onlyOfficial = toId(args[6]) === 'official';
					this.sclog();
					Settings.settings.leaderboards[tarRoom] = rConfAux;
					Settings.save();
					this.reply(this.trad('wasset') + ' ' + tarRoom);
				} else if (['enabled', 'disabled'].includes(enabled)) {
					if (!Settings.settings.leaderboards[tarRoom]) return this.reply(this.trad('alrdisabled') + ' ' + tarRoom);

					this.sclog();
					delete Settings.settings.leaderboards[tarRoom];
					Settings.save();
					this.reply(this.trad('wasdisabled') + ' ' + tarRoom);
				} else {
					return this.reply(
						`${this.trad('usage')}: ${this.cmdToken + cmd} [room], [on/off], [W], [F], [SF], [B], [official/all]`
					);
				}
				break;
			default:
				this.restrictReply(
					`${this.trad('unknown')}. ${this.trad('usage')}: ${
						this.cmdToken + this.handler
					} [rank/top/table/reset/setconfig/viewconfig]`,
					'rank'
				);
		}
	},
};
