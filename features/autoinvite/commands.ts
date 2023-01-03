/*
	Commands for autoinvite feature
*/

import { Command, Context } from '../../command-parser';
import { monitor } from '../../log';
import { equalOrHigherRank, toRoomid, uploadToHastebin } from '../../tools';
import { AutoInviteManager } from '.';

export const commands: Record<string, string | Command> = {
	reloadroomauth: 'getroomauth',
	useroomauth: 'getroomauth',
	getroomauth: function (arg, user, room, cmd) {
		if (!this.isExcepted) return false;
		const tarRoom = toRoomid(arg) || room;
		const autoInvite = Features.getFeature(AutoInviteManager);
		if (!autoInvite) return false;
		if (!Bot.rooms || !Bot.rooms[tarRoom]) return false;
		this.sclog();
		switch (cmd) {
			case 'reloadroomauth':
				autoInvite.roomAuthChanges[tarRoom] = 1;
				autoInvite.checkAuth();
				this.reply('Room auth from room __' + tarRoom + '__ has been reloaded');
				break;
			case 'getroomauth':
				if (!autoInvite.roomAuth[tarRoom])
					return this.reply(
						'Room auth for room __' + tarRoom + '__ is empty. Try ' + this.cmdToken + 'reloadroomauth'
					);
				uploadToHastebin(
					'Room auth (' + tarRoom + ')\n\n' + JSON.stringify(autoInvite.roomAuth[tarRoom]),
					function (this: Context, r: boolean, link: any): void {
						if (r) return this.reply('Room auth of __' + tarRoom + '__: ' + link);
						else this.reply('Error connecting to hastebin');
					}.bind(this)
				);
				break;
			case 'useroomauth':
				if (!autoInvite.roomAuth[tarRoom])
					return this.reply(
						'Room auth for room __' + tarRoom + '__ is empty. Try ' + this.cmdToken + 'reloadroomauth'
					);
				Object.entries(autoInvite.roomAuth[tarRoom])
					.filter(([i]) => !equalOrHigherRank(i, '&')) //Global auth and excepted users
					.forEach(([i, auth]) => (Config.exceptions[i] = auth));
				monitor('Auth exceptions changed temporarily\n' + JSON.stringify(Config.exceptions));
				this.reply(
					'Using room auth of room __' +
						tarRoom +
						'__ as global auth. Use ' +
						this.cmdToken +
						'reload config to revert it.'
				);
				break;
		}
	},
};
