/*
	Dynamic Commands
*/

import { Command, CommandModule, Context } from '../bll/command-parser';
import { error } from '../log';
import { toId } from '../tools';

class DynamicModule implements CommandModule {
	init(): void {
		Settings.addPermissions(['info', 'wall']);
	}
}

export const module = DynamicModule;

function getCmdList(head: string): string[] | null {
	const cmdArr = Object.keys(CommandParser.dynCommands).sort();
	const newCmdArr = cmdArr.filter(
		(cmd) => !(CommandParser.dynCommands[cmd] && CommandParser.dynCommands[cmd].substr(0, 4) === '/ref')
	);
	if (!newCmdArr.length) return null;
	return Tools.joinWithLengthLimit(newCmdArr, head);
}

export const commands: Record<string, string | Command> = {
	infowall: 'dyn',
	dynwall: 'dyn',
	wall: 'dyn',
	info: 'dyn',
	dyn: function (arg, by, room, cmd) {
		const dcmd = toId(arg);
		if (dcmd && CommandParser.dynCommands[dcmd] && CommandParser.dynCommands[dcmd].substr(0, 4) === '/ref') {
			const basicCmd = toId(CommandParser.dynCommands[dcmd].substr(5));
			if (CommandParser.dynCommands[basicCmd] && CommandParser.dynCommands[basicCmd].substr(0, 4) !== '/ref') {
				this.parse(this.cmdToken + cmd + ' ' + basicCmd);
			} else {
				if (CommandParser.dynCommands[basicCmd]) error('Recursive dynamic command "' + dcmd + '"');
				else error('Invalid reference for dynamic command "' + dcmd + '" -> "' + basicCmd + '"');
			}
			return;
		}
		const perm = cmd in { wall: 1, dynwall: 1, infowall: 1 } ? 'wall' : 'info';
		if (!this.can(perm) || this.roomType === 'pm') {
			if (!arg) {
				const list = getCmdList(this.trad('list') + ': ');
				return this.pmReply(list || this.trad('nocmds'));
			}
			if (CommandParser.dynCommands[dcmd]) {
				return this.pmReply(CommandParser.dynCommands[dcmd]);
			} else {
				return this.pmReply(this.trad('c') + ' "' + dcmd + '" ' + this.trad('notexist'));
			}
		} else {
			if (!arg) {
				const list = getCmdList(this.trad('list') + ': ');
				if (!list) return this.reply(this.trad('nocmds'));
				return this.reply(list);
			}
			if (CommandParser.dynCommands[dcmd]) {
				if (perm === 'wall') return this.reply('/announce ' + CommandParser.dynCommands[dcmd]);
				return this.reply(CommandParser.dynCommands[dcmd]);
			} else {
				return this.reply(this.trad('c') + ' "' + dcmd + '" ' + this.trad('notexist'));
			}
		}
	},

	deletecommand: 'delcmd',
	delcmd: function (arg) {
		if (!this.isRanked(Tools.getGroup('admin'))) return false;
		const dcmd = toId(arg);
		if (CommandParser.dynCommands[dcmd]) {
			delete CommandParser.dynCommands[dcmd];
			CommandParser.saveDynCmds();
			this.sclog();
			this.reply(this.trad('c') + ' "' + dcmd + '" ' + this.trad('d'));
		} else {
			this.reply(this.trad('c') + ' "' + dcmd + '" ' + this.trad('n'));
		}
	},

	setcommand: 'setcmd',
	setcmd: function (arg) {
		if (!this.isRanked(Tools.getGroup('admin'))) return false;
		if (!CommandParser.tempVar) {
			return this.reply(this.trad('notemp'));
		}
		const dcmd = toId(arg);
		let text = '';
		if (CommandParser.dynCommands[dcmd]) {
			text = this.trad('c') + ' "' + dcmd + '" ' + this.trad('modified');
		} else {
			text = this.trad('c') + ' "' + dcmd + '" ' + this.trad('created');
		}
		CommandParser.dynCommands[dcmd] = CommandParser.tempVar;
		CommandParser.saveDynCmds();
		this.sclog();
		this.reply(text);
	},

	setalias: 'setcmdalias',
	setcmdalias: function (arg, by, room, cmd) {
		if (!this.isRanked(Tools.getGroup('admin'))) return false;
		const args = arg.split(',');
		if (args.length !== 2) return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u2'));
		const alias = toId(args[0]);
		const dcmd = toId(args[1]);
		if (!alias || !dcmd || alias === dcmd)
			return this.reply(this.trad('u1') + ': ' + this.cmdToken + cmd + ' ' + this.trad('u2'));
		if (!CommandParser.dynCommands[dcmd]) return this.reply(this.trad('c') + ' "' + dcmd + '" ' + this.trad('n'));
		if (CommandParser.dynCommands[dcmd].substr(0, 4) === '/ref')
			return this.reply(this.trad('c') + ' "' + dcmd + '" ' + this.trad('already'));
		CommandParser.dynCommands[alias] = '/ref ' + dcmd;
		CommandParser.saveDynCmds();
		this.sclog();
		this.reply(this.trad('c') + ' "' + alias + '" ' + this.trad('alias') + ' "' + dcmd + '"');
	},

	dyncmdlist: 'getdyncmdlist',
	getdyncmdlist: function () {
		if (!this.isRanked(Tools.getGroup('admin'))) return false;
		const list = Object.keys(CommandParser.dynCommands).sort();
		if (!list.length) return this.pmReply(this.trad('nocmds'));
		let text = this.trad('list') + ':\n\n';
		for (const i in CommandParser.dynCommands) {
			if (CommandParser.dynCommands[i].substr(0, 4) === '/ref') {
				text += i + ' ~ ' + toId(CommandParser.dynCommands[i].substr(5)) + '\n';
				continue;
			}
			text += i + ' -> "' + CommandParser.dynCommands[i] + '"' + '\n';
		}
		Tools.uploadToHastebin(
			text,
			function (this: Context, r: boolean, link: any): void {
				if (r) return this.pmReply(this.trad('list') + ': ' + link);
				else this.pmReply(this.trad('err'));
			}.bind(this)
		);
	},

	stemp: 'temp',
	temp: function (arg) {
		if (!this.isRanked(Tools.getGroup('admin'))) return false;
		if (arg) CommandParser.tempVar = Tools.stripCommands(arg);
		this.sclog('Temp command-parser var changed');
		this.reply('Temp: ' + CommandParser.tempVar);
	},
};
