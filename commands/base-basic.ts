/*
	Basic Commands
*/

import { Command, CommandModuleManager } from '../command-parser';
import { getTimeAgo, joinWithLengthLimit, stripCommands, toId } from '../tools';

class BasicModule implements CommandModuleManager {
	init(): void {
		Settings.addPermissions(['say']);
	}
}

export const manager = BasicModule;

export const commands: Record<string, string | Command> = {
	credits: 'about',
	bot: 'about',
	about: function () {
		this.restrictReply(
			this.trad('about') + '. ' + this.trad('author') + ': ' + Settings.package.author.name + '. (' + Settings.package.homepage + ')',
			'info'
		);
	},

	git: 'github',
	github: function () {
		if (Settings.package.repository) this.restrictReply(stripCommands(Settings.package.repository.url), 'info');
	},

	botversion: 'version',
	version: function () {
		this.restrictReply(stripCommands(Settings.package.version), 'info');
	},

	guide: 'help',
	botguide: 'help',
	help: function () {
		this.restrictReply(
			this.trad('guide') + ': ' + (Config.botguide || Settings.package.homepage + '/blob/master/commands/README.md'),
			'info'
		);
	},

	bottime: 'time',
	time: function () {
		const f = new Date();
		this.restrictReply('**' + this.trad('time') + ':** __' + f.toString() + '__', 'info');
	},

	uptime: function () {
		let text = '';
		text += '**Uptime:** ';
		const divisors = [52, 7, 24, 60, 60];
		const unitNames = ['week', 'day', 'hour', 'minute', 'second'].map(this.trad);
		const buffer: string[] = [];
		let uptime = ~~process.uptime();
		do {
			const divisor = divisors.pop();
			if (!divisor) break;
			const unit = uptime % divisor;
			const unitName = unitNames.pop();
			if (!unit) {
				uptime = ~~(uptime / divisor);
				continue;
			}
			buffer.push(unit + ' ' + unitName + (unit > 1 ? 's' : ''));
			uptime = ~~(uptime / divisor);
		} while (uptime);

		switch (buffer.length) {
			case 5:
				text += buffer[4] + ', ';
				text += buffer[3] + ', ';
				text += buffer[2] + ', ' + buffer[1] + ', ' + this.trad('and') + ' ' + buffer[0];
				break;
			case 4:
				text += buffer[3] + ', ';
				text += buffer[2] + ', ' + buffer[1] + ', ' + this.trad('and') + ' ' + buffer[0];
				break;
			case 3:
				text += buffer[2] + ', ' + buffer[1] + ', ' + this.trad('and') + ' ' + buffer[0];
				break;
			case 2:
				text += buffer[1] + ' ' + this.trad('and') + ' ' + buffer[0];
				break;
			case 1:
				text += buffer[0];
				break;
		}
		this.restrictReply(text, 'info');
	},

	seen: function (arg, by) {
		let text = '';
		arg = toId(arg);
		if (!arg || arg.length > 18) return this.pmReply(this.trad('inv'));
		if (arg === toId(Bot.status.nickName)) return this.pmReply(this.trad('bot'));
		if (arg === toId(by)) return this.pmReply(this.trad('self'));
		const dSeen = Settings.userManager.getSeen(arg);
		if (dSeen) {
			text +=
				'**' +
				(dSeen.name || arg).trim() +
				'** ' +
				this.trad('s1') +
				' __' +
				getTimeAgo(dSeen.time, this.language).trim() +
				(this.trad('s2') ? '__ ' + this.trad('s2') : '__');
			if (dSeen.room && dSeen.action && dSeen.args) {
				switch (dSeen.action) {
					case 'j':
						text += ', ' + this.trad('j') + ' <<' + dSeen.room + '>>';
						break;
					case 'l':
						text += ', ' + this.trad('l') + ' <<' + dSeen.room + '>>';
						break;
					case 'c':
						text += ', ' + this.trad('c') + ' <<' + dSeen.room + '>>';
						break;
					case 'n':
						text += ', ' + this.trad('n') + ' **' + dSeen.args[0] + '**';
						break;
				}
			}
		} else {
			text += this.trad('n1') + ' ' + arg + ' ' + this.trad('n2');
		}
		this.pmReply(text);
	},

	publicalts: 'alts',
	alts: function (arg) {
		arg = toId(arg);
		if (!arg || arg.length > 18) return this.pmReply(this.trad('inv'));
		const alts = Settings.userManager.getAlts(arg);
		if (alts.length) {
			if (this.can('alts')) {
				const cmds = joinWithLengthLimit(alts, this.trad('alts') + ' ' + Settings.userManager.getName(arg) + ': ');
				this.pmReply(cmds);
				return;
			}

			let text = '';
			if (alts.length <= 10) {
				text += this.trad('alts') + ' ' + Settings.userManager.getName(arg) + ': ' + alts.join(', ');
			} else {
				const fAlts = alts.reverse().slice(0, 10);
				text += this.trad('alts') + ' ' + Settings.userManager.getName(arg) + ': ' + fAlts.join(', ');
				if (alts.length > 10) text += ', (' + (alts.length - 10) + this.trad('more') + ')';
				this.pmReply(text);
			}
		} else {
			const text = this.trad('n') + ' ' + Settings.userManager.getName(arg);
			this.pmReply(text);
		}
	},

	say: function (arg) {
		if (!arg) return;
		if (!this.can('say')) return;
		this.reply(stripCommands(arg));
	},
};
