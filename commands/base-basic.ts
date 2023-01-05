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
			`${this.trad('about')}. ${this.trad('author')}: ${Settings.package.author.name}. (${Settings.package.homepage})`,
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
			`${this.trad('guide')}: ${Config.botguide || Settings.package.homepage + '/blob/master/commands/README.md'}`,
			'info'
		);
	},

	bottime: 'time',
	time: function () {
		this.restrictReply(`**${this.trad('time')}:** __${new Date().toString()}__`, 'info');
	},

	uptime: function () {
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

		this.restrictReply(
			'**Uptime:** ' + [buffer.slice(1, 5).reverse().join(', '), buffer[0]].filter((t) => !!t).join(` ${this.trad('and')} `),
			'info'
		);
	},

	seen: function (arg, by) {
		arg = toId(arg);
		if (!arg || arg.length > 18) return this.pmReply(this.trad('inv'));
		if (arg === toId(Bot.status.nickName)) return this.pmReply(this.trad('bot'));
		if (arg === toId(by)) return this.pmReply(this.trad('self'));
		const dSeen = Settings.userManager.getSeen(arg);
		if (!dSeen) return this.pmReply(`${this.trad('n1')} ${arg} ${this.trad('n2')}`);

		let text = `**${(dSeen.name || arg).trim()}** ${this.trad('s1')} __${getTimeAgo(dSeen.time, this.language).trim()}__ ${this.trad(
			's2'
		)}`;
		if (dSeen.room && dSeen.action && dSeen.args) {
			const action = dSeen.action;
			text = `${text.trimEnd()}, ${this.trad(action)} <<${action === 'n' ? dSeen.args[0] : dSeen.room}>>`;
		}
		this.pmReply(text);
	},

	publicalts: 'alts',
	alts: function (arg) {
		arg = toId(arg);
		if (!arg || arg.length > 18) return this.pmReply(this.trad('inv'));
		const alts = Settings.userManager.getAlts(arg);
		if (!alts.length) return this.pmReply(`${this.trad('n')} ${Settings.userManager.getName(arg)}`);
		if (this.can('alts')) {
			return this.pmReply(joinWithLengthLimit(alts, `${this.trad('alts')} ${Settings.userManager.getName(arg)}: `));
		}

		if (alts.length <= 10) {
			this.pmReply(`${this.trad('alts')} ${Settings.userManager.getName(arg)}: ${alts.join(', ')}`);
		} else {
			const fAlts = alts.reverse().slice(0, 10);
			this.pmReply(
				`${this.trad('alts')} ${Settings.userManager.getName(arg)}: ${fAlts.join(', ')}, (${alts.length - 10} ${this.trad('more')})`
			);
		}
	},

	say: function (arg) {
		if (!arg) return;
		if (!this.can('say')) return;
		this.reply(stripCommands(arg));
	},
};
