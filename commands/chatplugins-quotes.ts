import { inspect } from 'util';

import { Command, CommandModuleManager, Context } from '../command-parser';
import { errlog, error } from '../log';
import { FlatFileManager } from '../settings';
import { stripCommands, toId, uploadToHastebin } from '../tools';

class QuotesRepo implements CommandModuleManager {
	quotesDataFile = AppOptions.data + 'quotes.json';
	jokesDataFile = AppOptions.data + 'jokes.json';

	quotesFFM = new FlatFileManager(this.quotesDataFile);
	jokesFFM = new FlatFileManager(this.jokesDataFile);

	quotes: Record<string, string> = {};
	jokes: Record<string, string> = {};

	init(): void {
		try {
			this.quotes = this.quotesFFM.readObj();
		} catch (e: any) {
			errlog(e.stack);
			error('Could not import quotes: ' + inspect(e));
		}

		try {
			this.jokes = this.jokesFFM.readObj();
		} catch (e: any) {
			errlog(e.stack);
			error('Could not import jokes: ' + inspect(e));
		}

		Settings.addPermissions(['quote', 'joke']);
	}

	saveQuotes(): void {
		this.quotesFFM.writeObj(this.quotes);
	}

	saveJokes(): void {
		this.jokesFFM.writeObj(this.jokes);
	}

	private rand(obj: Record<string, string>): string | null {
		const keys = Object.keys(obj);
		if (!keys.length) return null;
		return obj[keys[Math.floor(Math.random() * keys.length)]];
	}

	randQuote(): string | null {
		return this.rand(this.quotes);
	}

	randJoke(): string | null {
		return this.rand(this.jokes);
	}
}

export const manager = QuotesRepo;

export const commands: Record<string, string | Command> = {
	/*
	 * Quotes
	 */
	addquote: 'quote',
	setquote: 'quote',
	delquote: 'quote',
	getquote: 'quote',
	quote: function (arg, by, room, cmd) {
		const repo = this.getModule(QuotesRepo);
		if (cmd === 'addquote' || cmd === 'setquote') {
			if (!this.isRanked('admin')) return false;
			const args = arg.split(',');
			if (args.length < 2) return this.reply(`${this.trad('u1')}: ${this.cmdToken + cmd} ${this.trad('u2')}`);
			const id = toId(args[0]);
			if (!id) return this.reply(this.trad('noid'));
			args.splice(0, 1);
			const content = stripCommands(args.join(',').trim());
			if (!content) return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u2'));
			if (repo.quotes[id] && cmd !== 'setquote') return this.reply(`${this.trad('quote')} "${id}" ${this.trad('already')}`);

			const created = !repo.quotes[id];
			repo.quotes[id] = content;
			repo.saveQuotes();
			this.sclog();
			this.reply(this.trad('quote') + ' "' + id + '" ' + this.trad(created ? 'created' : 'modified'));
		} else if (cmd === 'delquote') {
			if (!this.isRanked('admin')) return false;
			const id = toId(arg);
			if (!id) return this.reply(this.trad('noid'));
			if (!repo.quotes[id]) return this.reply(this.trad('quote') + ' "' + id + '" ' + this.trad('n'));
			delete repo.quotes[id];
			repo.saveQuotes();
			this.sclog();
			this.reply(this.trad('quote') + ' "' + id + '" ' + this.trad('d'));
		} else if (cmd === 'getquote') {
			const id = toId(arg);
			if (!id) return this.reply(this.trad('noid'));
			if (!repo.quotes[id]) return this.restrictReply(this.trad('quote') + ' "' + id + '" ' + this.trad('n'), 'quote');
			this.restrictReply(stripCommands(repo.quotes[id]), 'quote');
		} else {
			const quote = repo.randQuote();
			if (quote === null) return this.restrictReply(this.trad('empty'), 'quote');
			this.restrictReply(stripCommands(quote), 'quote');
		}
	},
	listquotes: function () {
		if (!this.isRanked('admin')) return false;
		const data = Object.entries(this.getModule(QuotesRepo).quotes)
			.map(([i, quote]) => i + ' -> ' + quote)
			.join('\n');
		if (!data) return this.reply(this.trad('empty'));
		uploadToHastebin(
			this.trad('list') + ':\n\n' + data,
			function (this: Context, r: boolean, link: any): void {
				if (r) return this.pmReply(this.trad('list') + ': ' + link);
				else this.pmReply(this.trad('err'));
			}.bind(this)
		);
	},
	/*
	 * Jokes
	 */
	addjoke: 'joke',
	setjoke: 'joke',
	deljoke: 'joke',
	getjoke: 'joke',
	joke: function (arg, by, room, cmd) {
		const repo = this.getModule(QuotesRepo);
		if (cmd === 'addjoke' || cmd === 'setjoke') {
			if (!this.isRanked('admin')) return false;
			const args = arg.split(',');
			if (args.length < 2) return this.reply(`${this.trad('u1')}: ${this.cmdToken + cmd} ${this.trad('u2')}`);
			const id = toId(args[0]);
			if (!id) return this.reply(this.trad('noid'));
			args.splice(0, 1);
			const content = stripCommands(args.join(',').trim());
			if (!content) return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u2'));
			if (repo.jokes[id] && cmd !== 'setjoke') return this.reply(`${this.trad('joke')} "${id}" ${this.trad('already')}`);

			const created = !repo.jokes[id];
			repo.jokes[id] = content;
			repo.saveJokes();
			this.sclog();
			this.reply(this.trad('joke') + ' "' + id + '" ' + this.trad(created ? 'created' : 'modified'));
		} else if (cmd === 'deljoke') {
			if (!this.isRanked('admin')) return false;
			const id = toId(arg);
			if (!id) return this.reply(this.trad('noid'));
			if (!repo.jokes[id]) return this.reply(this.trad('joke') + ' "' + id + '" ' + this.trad('n'));
			delete repo.jokes[id];
			repo.saveJokes();
			this.sclog();
			this.reply(this.trad('joke') + ' "' + id + '" ' + this.trad('d'));
		} else if (cmd === 'getjoke') {
			const id = toId(arg);
			if (!id) return this.reply(this.trad('noid'));
			if (!repo.jokes[id]) return this.restrictReply(this.trad('joke') + ' "' + id + '" ' + this.trad('n'), 'joke');
			return this.restrictReply(stripCommands(repo.jokes[id]), 'joke');
		} else {
			const joke = repo.randJoke();
			if (joke === null) return this.restrictReply(this.trad('empty'), 'joke');
			return this.restrictReply(stripCommands(joke), 'joke');
		}
	},
	listjokes: function () {
		if (!this.isRanked('admin')) return false;
		const data = Object.entries(this.getModule(QuotesRepo).jokes)
			.map(([i, joke]) => i + ' -> ' + joke)
			.join('\n');
		if (!data) return this.reply(this.trad('empty'));
		uploadToHastebin(
			this.trad('list') + ':\n\n' + data,
			function (this: Context, r: boolean, link: any): void {
				if (r) return this.pmReply(this.trad('list') + ': ' + link);
				else this.pmReply(this.trad('err'));
			}.bind(this)
		);
	},
};
