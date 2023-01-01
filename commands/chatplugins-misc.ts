/*
	Miscellaneous commands
*/

import { inspect } from 'util';

import { Command, CommandModuleManager, Context } from '../command-parser';
import { debug, error } from '../log';
import { toId } from '../tools';

class UserRepo implements CommandModuleManager {
	downloadingFlag: Record<string, boolean> = {};
	regdateCache: User[] = [];

	init(): void {
		Settings.addPermissions(['pick', 'randomanswer']);
	}

	getDownload(user: string): boolean {
		return this.downloadingFlag[user] || false;
	}

	markDownload(user: string, value: boolean): void {
		if (value === false) {
			if (this.downloadingFlag[user]) delete this.downloadingFlag[user];
		} else if (value === true) {
			this.downloadingFlag[user] = true;
		}
	}
}

export const manager = UserRepo;

interface User {
	registertime: number;
	username: string;
}

export const commands: Record<string, string | Command> = {
	choose: 'pick',
	pick: function (arg) {
		let choices = arg.split(',');
		choices = choices.filter(function (i) {
			return toId(i) !== '';
		});
		if (choices.length < 2) return this.pmReply(this.trad('err'));
		const choice = choices[Math.floor(Math.random() * choices.length)];
		this.restrictReply('**' + this.trad('pick') + ':** ' + Tools.stripCommands(choice), 'pick');
	},

	'8ball': 'randomanswer',
	helix: 'randomanswer',
	randomanswer: function () {
		const answers = this.trad('answers');
		if (!answers || !answers.length) return;
		this.restrictReply(answers[Math.floor(Math.random() * answers.length)], 'randomanswer');
	},

	regtime: 'regdate',
	regdate: function (arg) {
		const target = toId(arg) || toId(this.by);
		if (!target || target.length > 18) return this.pmReply(this.trad('inv'));
		const url = 'http://pokemonshowdown.com/users/' + target + '.json';
		if (this.getModule<UserRepo>(UserRepo).getDownload(toId(this.by))) {
			return this.pmReply(this.trad('busy'));
		}
		const callback = function (this: Context, dataString: string, err?: Error, nocache?: boolean): void {
			this.getModule<UserRepo>(UserRepo).markDownload(toId(this.by), false);
			if (err) return this.pmReply(this.trad('err') + ' ' + url);
			let data: User;
			try {
				data = JSON.parse(dataString);
			} catch (e: any) {
				debug(inspect(e));
				return this.pmReply(this.trad('err') + ' ' + url);
			}
			if (typeof data.registertime !== 'number') {
				error('Regdate | Corrupted data: ' + JSON.stringify(data));
				return this.pmReply(this.trad('err') + ' ' + url);
			}
			if (data.registertime <= 0)
				return this.pmReply(this.trad('user') + ' ' + (data.username || target) + ' ' + this.trad('not'));
			if (!nocache) {
				const regdateCache = this.getModule<UserRepo>(UserRepo).regdateCache;
				regdateCache.push(data);
				if (regdateCache.length > 10) regdateCache.shift();
			}
			let regTimestamp = data.registertime * 1000;
			if (this.cmd === 'regtime') {
				regTimestamp -= 364000;
				this.pmReply(
					this.trad('user') +
						' ' +
						(data.username || target) +
						' ' +
						this.trad('regtime1') +
						' __' +
						Tools.getTimeAgo(regTimestamp, this.language).trim() +
						'__ ' +
						this.trad('regtime2')
				);
			} else {
				regTimestamp +=
					1000 * 60 * 60 * Tools.getESTDiff(regTimestamp) +
					new Date().getTimezoneOffset() * 60 * 1000 -
					364000;
				this.pmReply(
					this.trad('user') +
						' ' +
						(data.username || target) +
						' ' +
						this.trad('regdate') +
						' __' +
						new Date(regTimestamp).toString().substr(4, 20).trim() +
						'__ (EST)'
				);
			}
		}.bind(this);
		const regdateCache = this.getModule<UserRepo>(UserRepo).regdateCache;
		for (let i = 0; i < regdateCache.length; i++) {
			if (regdateCache[i].username && toId(regdateCache[i].username) === target) {
				callback(JSON.stringify(regdateCache[i]), null, true);
				return;
			}
		}
		this.getModule<UserRepo>(UserRepo).markDownload(toId(this.by), true);
		Tools.httpGet(url, callback);
	},
};
