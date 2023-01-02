/*
	Smogon related commads
*/

import { Command, CommandModuleManager, Context } from '../command-parser';
import { debug } from '../log';
import { getTargetRoom, httpGet, joinWithLengthLimit, pad, parseAliases, toId, toName } from '../tools';

class Downloader implements CommandModuleManager {
	downloadingFlag: Record<string, boolean> = {};

	init(): void {
		Settings.addPermissions(['pick', 'randomanswer']);
	}

	getDownload(link: string): boolean {
		return this.downloadingFlag[link] || false;
	}

	markDownload(link: string, value: boolean): void {
		if (value === false) {
			if (this.downloadingFlag[link]) delete this.downloadingFlag[link];
		} else if (value === true) {
			this.downloadingFlag[link] = true;
		}
	}
}

export const manager = Downloader;

/* Default tier */

function getDefaultTier(room: string): string {
	return Settings.settings.deftier?.[room] || 'ou';
}

/* Usage utils */

function generateUsageLink(monthmod: number): string {
	const now = new Date();
	let year = now.getFullYear();
	let month = now.getMonth();
	if (monthmod) month += monthmod;
	while (month < 0) {
		month += 12;
		year--;
	}
	while (month > 11) {
		month -= 12;
		year++;
	}
	return 'http://www.smogon.com/stats/' + pad(year, 4) + '-' + pad(month + 1, 2) + '/';
}

function getUsageLink(callback: (link?: string) => void): void {
	const realLink = generateUsageLink(-1);
	const currLink = Settings.settings.usagelink;
	if (currLink !== realLink) {
		httpGet(realLink, (data: string | null, err: Error | null): void => {
			if (!err && data && data.indexOf('<title>404 Not Found</title>') < 0) {
				Settings.settings.usagelink = realLink;
				Settings.save();
				if (currLink) Settings.unCacheUrl(new RegExp(currLink));
				debug('Usage link updated: ' + Settings.settings.usagelink);
				callback(realLink);
			} else {
				callback(currLink);
			}
		});
	} else {
		callback(currLink);
	}
}

function tierName(tier?: string): string {
	if (!tier) return '';
	return Formats[tier]?.name || tier.toUpperCase();
}

function isTopTier(tier: string): boolean {
	return ['ou', 'oususpecttest', 'doublesou'].some((t) => tier.endsWith(t));
}

function getUsage(this: Context, arg: string, link?: string): void {
	if (!link) link = generateUsageLink(-2);
	if (this.cmd === 'usagelink' || this.cmd === 'usagedatalink') {
		const tFormat = parseAliases(arg);
		return this.restrictReply(
			this.trad('stats') +
				': ' +
				link +
				(this.cmd === 'usagedatalink' ? 'moveset/' : '') +
				(tFormat && tFormat + '-' + (isTopTier(tFormat) ? '1695' : '1630') + '.txt'),
			'usage'
		);
	}
	let searchIndex = -1;
	let tier = getDefaultTier(this.room);
	let dataType = '';
	let ladderType = 1630;
	const args = arg.split(',');
	for (let i = 0; i < args.length; i++) {
		args[i] = toId(args[i]);
	}
	let poke = toId(args[0]);
	try {
		const aliases = DataDownloader.getAliases();
		if (aliases[poke]) poke = toId(aliases[poke]);
	} catch (e) {
		debug('Could not fetch aliases. Cmd: ' + this.cmd + ' ' + arg + ' | Room: ' + this.room + ' | By: ' + this.by);
	}
	if (parseInt(poke)) searchIndex = parseInt(poke);
	if (this.cmd === 'usagedata') {
		if (args.length < 2)
			return this.restrictReply(
				this.trad('usage') +
					': ' +
					this.cmdToken +
					this.cmd +
					' [pokemon], [moves / items / abilities / spreads / teammates], (tier)',
				'usage'
			);
		dataType = toId(args[1]);
		if (!(dataType in { moves: 1, items: 1, abilities: 1, teammates: 1, spreads: 1 }))
			return this.restrictReply(
				this.trad('usage') +
					': ' +
					this.cmdToken +
					this.cmd +
					' [pokemon], [moves / items / abilities / spreads / teammates], (tier)',
				'usage'
			);
		if (args[2]) {
			tier = parseAliases(args[2]);
			if (!Formats[tier] && !Formats[tier + 'suspecttest'])
				return this.restrictReply(this.trad('tiererr1') + ' "' + tier + '" ' + this.trad('tiererr2'), 'usage');
		}
		if (isTopTier(tier)) ladderType = 1695; //OU representative usage stats
		if (this.getModule(Downloader).getDownload(link + 'moveset/' + tier + '-' + ladderType + '.txt')) {
			return this.restrictReply(this.trad('busy'), 'usage');
		}
		Settings.httpGetAndCache(
			link + 'moveset/' + tier + '-' + ladderType + '.txt',
			function (this: Context, data: string | null, err: NodeJS.ErrnoException | null): void {
				this.getModule(Downloader).markDownload(link + 'moveset/' + tier + '-' + ladderType + '.txt', false);
				if (err || !data) {
					return this.restrictReply(
						this.trad('err') + ' ' + link + 'moveset/' + tier + '-' + ladderType + '.txt',
						'usage'
					);
				}
				if (data.indexOf('+----------------------------------------+') === -1)
					return this.restrictReply(
						this.trad('tiererr1') + ' "' + tierName(tier) + '" ' + this.trad('tiererr3'),
						'usage'
					);
				const pokes = data.split(
					' +----------------------------------------+ \n +----------------------------------------+ '
				);
				const pokeData = pokes.map((p) => p.split('\n')).filter((p) => toId(p[1]) === poke)[0];
				const chosen = !!pokeData;
				if (!chosen)
					return this.restrictReply(
						this.trad('pokeerr1') +
							' "' +
							poke +
							'" ' +
							this.trad('pokeerr2') +
							' ' +
							tierName(tier) +
							' ' +
							this.trad('pokeerr3'),
						'usage'
					);
				const result: string[] = [];
				let resultName = '';
				const pokeName = toName(pokeData[1].split('|')[1]);
				for (let i = 0; i < pokeData.length; i++) {
					if (pokeData[i + 1] && pokeData[i].trim() === '+----------------------------------------+') {
						switch (toId(pokeData[i + 1])) {
							case 'abilities':
								if (dataType !== 'abilities') continue;
								break;
							case 'items':
								if (dataType !== 'items') continue;
								break;
							case 'moves':
								if (dataType !== 'moves') continue;
								break;
							case 'spreads':
								if (dataType !== 'spreads') continue;
								break;
							case 'teammates':
								if (dataType !== 'teammates') continue;
								break;
							default:
								continue;
						}
						resultName = this.trad(dataType);
						i = i + 2;
						while (i < pokeData.length) {
							if (pokeData[i].trim() === '+----------------------------------------+') break;
							const auxResString = pokeData[i].split('|')[1];
							if (auxResString) {
								const auxRes = auxResString.trim().split(' ');
								const percent = auxRes.pop();
								result.push(auxRes.join(' ') + ' (' + percent + ')');
							}
							i++;
						}
						break;
					}
				}
				if (!result.length)
					return this.restrictReply(
						this.trad('notfound') +
							' ' +
							this.trad('usagedata1').replace('#NAME', resultName) +
							pokeName +
							this.trad('usagedata2').replace('#NAME', resultName) +
							' ' +
							this.trad('in') +
							' ' +
							tierName(tier),
						'usage'
					);
				const cmds = joinWithLengthLimit(
					result,
					'**' +
						this.trad('usagedata1').replace('#NAME', resultName) +
						pokeName +
						this.trad('usagedata2').replace('#NAME', resultName) +
						' ' +
						this.trad('in') +
						' ' +
						tierName(tier) +
						'**: '
				);
				this.restrictReply(cmds, 'usage');
			}.bind(this),
			function (this: Context): void {
				this.getModule(Downloader).markDownload(link + 'moveset/' + tier + '-' + ladderType + '.txt', true);
			}.bind(this)
		);
	} else {
		if (args.length < 1)
			return this.restrictReply(
				this.trad('usage') + ': ' + this.cmdToken + this.cmd + ' [pokemon], (tier)',
				'usage'
			);
		if (args[1]) {
			tier = parseAliases(args[1]);
			if (!Formats[tier] && !Formats[tier + 'suspecttest'])
				return this.restrictReply(this.trad('tiererr1') + ' "' + tier + '" ' + this.trad('tiererr2'), 'usage');
		}
		if (isTopTier(tier)) ladderType = 1695; //OU representative usage stats
		const url = link + tier + '-' + ladderType + '.txt';
		if (this.getModule(Downloader).getDownload(url)) {
			return this.restrictReply(this.trad('busy'), 'usage');
		}
		Settings.httpGetAndCache(
			url,
			function (this: Context, data: string | null, err: NodeJS.ErrnoException | null): void {
				this.getModule(Downloader).markDownload(url, false);
				if (err || !data) {
					return this.restrictReply(
						this.trad('err') + ' ' + link + tier + '-' + ladderType + '.txt',
						'usage'
					);
				}
				const lines = data.split('\n');
				if (lines[0].indexOf('Total battles:') === -1)
					return this.restrictReply(
						this.trad('tiererr1') + ' "' + tierName(tier) + '" ' + this.trad('tiererr3'),
						'usage'
					);
				const dataRes = { name: poke, pos: -1, usage: '', raw: '' };
				let line;
				for (let i = 5; i < lines.length; i++) {
					line = lines[i].split('|');
					if (line.length < 7) continue;
					if (toId(line[2]) === poke || searchIndex === parseInt(line[1].trim())) {
						dataRes.name = toName(line[2]);
						dataRes.pos = parseInt(line[1].trim());
						dataRes.usage = line[3].trim();
						dataRes.raw = line[4].trim();
						break;
					}
				}
				if (!dataRes.pos || dataRes.pos < 1)
					return this.restrictReply(
						this.trad('pokeerr1') +
							' "' +
							poke +
							'" ' +
							this.trad('pokeerr2') +
							' ' +
							tierName(tier) +
							' ' +
							this.trad('pokeerr4'),
						'usage'
					);
				this.restrictReply(
					'**' +
						dataRes.name +
						'**, #' +
						dataRes.pos +
						' ' +
						this.trad('in') +
						' **' +
						tierName(tier) +
						'**. ' +
						this.trad('pokeusage') +
						': ' +
						dataRes.usage +
						', ' +
						this.trad('pokeraw') +
						': ' +
						dataRes.raw,
					'usage'
				);
			}.bind(this),
			function (this: Context): void {
				this.getModule(Downloader).markDownload(link + tier + '-' + ladderType + '.txt', true);
			}.bind(this)
		);
	}
}

/* Commands */

export const commands: Record<string, string | Command> = {
	defaulttier: 'deftier',
	deftier: function (arg, by, room) {
		if (!this.isRanked('roomowner')) return false;
		let tarRoom = room;
		const targetObj = getTargetRoom(arg);
		let textHelper = '';
		if (targetObj && this.isExcepted) {
			arg = targetObj.arg;
			tarRoom = targetObj.room;
			textHelper = ' (' + tarRoom + ')';
		}
		if (!Bot.rooms[tarRoom] || Bot.rooms[tarRoom].type !== 'chat')
			return this.reply(this.trad('notchat') + textHelper);
		const tier = toId(arg);
		if (!tier) return this.reply(this.trad('usage') + ': ' + this.cmdToken + this.cmd + ' [tier]');
		if (!Formats[tier] && !Formats[tier + 'suspecttest'])
			return this.restrictReply(this.trad('tiererr1') + ' "' + tier + '" ' + this.trad('tiererr2'), 'info');
		if (!Settings.settings.deftier) Settings.settings.deftier = {};
		Settings.settings.deftier[tarRoom] = tier;
		Settings.save();
		this.reply(this.trad('set') + ' **' + tierName(tier) + '**' + textHelper);
		this.sclog();
	},

	delsuspect: 'setsuspect',
	setsuspect: function (arg) {
		if (!this.isRanked('admin')) return false;
		if (!Settings.settings.suspect) Settings.settings.suspect = {};
		if (this.cmd === 'delsuspect') {
			if (!arg) return this.reply(this.trad('usage') + ': ' + this.cmdToken + this.cmd + ' [tier]');
			arg = parseAliases(arg);
			if (!Settings.settings.suspect[arg]) {
				return this.reply(this.trad('d1') + ' "' + arg + '" ' + this.trad('notfound'));
			}
			delete Settings.settings.suspect[arg];
			Settings.save();
			this.sclog();
			this.reply(this.trad('d1') + ' "' + arg + ' ' + this.trad('d2'));
		} else {
			const args = arg.split(',');
			if (args.length < 3) {
				return this.reply(this.trad('usage') + ': ' + this.cmdToken + this.cmd + ' [tier], [pokemon], [link]');
			}
			const tier = parseAliases(args.shift());
			if (!Formats[tier] && !Formats[tier + 'suspecttest']) {
				return this.reply(this.trad('tier') + ' "' + tier + '" ' + this.trad('notfound'));
			}
			let link = args.pop();
			if (link) link = link.trim();
			const poke = args.join(',');
			Settings.settings.suspect[tier] = { poke, link };
			Settings.save();
			this.sclog();
			this.parse(this.cmdToken + 'suspect ' + tier);
		}
	},

	suspecttest: 'suspect',
	suspect: function (arg) {
		let tier = getDefaultTier(this.room);
		if (arg) {
			tier = parseAliases(arg);
		}
		if (Settings.settings.suspect && Settings.settings.suspect[tier]) {
			//Suspect
			this.restrictReply(
				'Suspect test ' +
					this.trad('in') +
					' **' +
					tierName(tier) +
					'**: **' +
					toName(Settings.settings.suspect[tier].poke) +
					'**. ' +
					Settings.settings.suspect[tier].link,
				'info'
			);
		} else if (Formats[tier] || Formats[tier + 'suspecttest']) {
			//No suspect
			this.restrictReply(
				this.trad('nosuspect') +
					' ' +
					tierName(tier) +
					(this.isRanked('admin')
						? '. ' + this.trad('aux1') + ' ``' + this.cmdToken + 'setsuspect`` ' + this.trad('aux2')
						: ''),
				'info'
			);
		} else {
			this.restrictReply(this.trad('tiererr1') + ' "' + tier + '" ' + this.trad('tiererr2'), 'info');
		}
	},

	usagedata: 'usage',
	usagestats: 'usage',
	usagedatalink: 'usage',
	usagelink: 'usage',
	usage: function (arg) {
		if (!arg) {
			this.restrictReply(
				this.trad(this.cmd.substring('usage'.length) || 'stats') +
					': ' +
					(this.cmd === 'usagedata' ? 'moveset/' : ''),
				'usage'
			);
		}
		const getUsageFn = getUsage.bind(this);
		getUsageLink(((link?: string): void => getUsageFn(arg, link)).bind(this));
	},
};
