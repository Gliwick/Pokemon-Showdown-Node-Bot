/*
	Auto-Invite
*/

import { ConfigType, validateConfigArray } from '../../config-tools';
import { debug } from '../../log';
import { equalOrHigherRank, toId } from '../../tools';
import { Feature } from '..';

export class AutoInviteManager implements Feature {
	id = 'autoinvite';
	desc = 'Automated /invite for private rooms';

	parserIndex = -1;
	parserArray: string[] = [];

	privateRooms: string[] = [];
	linkedRooms: ConfigType['autoInvite'] = [];
	roomAuth: Record<string, Record<string, string>> = {};
	roomAuthChanges: Record<string, number> = {};

	checkAuthTimer: NodeJS.Timeout | null = null;

	checkAuth(): void {
		if (!Bot.status.connected) return;
		this.parserArray = Object.keys(this.roomAuthChanges);
		this.roomAuthChanges = {};
		if (!this.parserArray.length) return;
		this.parserIndex = -1;
		this.getNextRoom();
	}

	getRoomLinked(room: string): string[] {
		return Array.from(
			new Set(this.linkedRooms.filter((linkedRoom) => room === linkedRoom.linked).map((linkedRoom) => linkedRoom.private))
		);
	}

	isInRoom(room: string, user: string): boolean {
		return !!Bot.rooms[room]?.users?.[user];
	}

	getRank(room: string, from: string): string {
		return this.linkedRooms.filter((linkedRoom) => from === linkedRoom.linked && room === linkedRoom.private)[0]?.rank || '+';
	}

	hasAuth(room: string, user: string, from: string): boolean {
		if (!this.roomAuth[room][user]) return false;
		const userIdent = this.roomAuth[room][user] + user;
		const rank = this.getRank(room, from);
		return equalOrHigherRank(userIdent, rank);
	}

	parseJoin(room: string, user: string): void {
		user = toId(user);
		const rooms = this.getRoomLinked(room);
		for (let i = 0; i < rooms.length; i++) {
			if (this.isInRoom(rooms[i], user)) continue;
			if (!this.hasAuth(rooms[i], user, room)) continue;
			Bot.say('', '/invite ' + user + ',' + rooms[i]);
		}
	}

	parseRename(room: string, user: string, old: string): void {
		user = toId(user);
		old = toId(old || '');
		const rooms = this.getRoomLinked(room);
		for (let i = 0; i < rooms.length; i++) {
			if (this.isInRoom(rooms[i], user)) continue;
			if (this.isInRoom(rooms[i], old)) continue;
			if (!this.hasAuth(rooms[i], user, room)) continue;
			Bot.say('', '/invite ' + user + ',' + rooms[i]);
		}
	}

	parseRaw(room: string, raw: string): void {
		if (!this.privateRooms.includes(room)) return;
		if (raw.includes(' was promoted ') || raw.includes(' was demoted ')) {
			if (!this.roomAuthChanges[room]) this.roomAuthChanges[room] = 0;
			this.roomAuthChanges[room]++;
			debug('Auth change detected [' + room + ']: ' + raw);
		}
	}

	/* Auth parser */
	getNextRoom(): void {
		this.parserIndex++;
		if (this.parserIndex >= this.parserArray.length) {
			if (this.parserArray.length) debug('Room auth received and parsed from: ' + this.parserArray.join(', '));
			return;
		}
		const popupParser = function (this: AutoInviteManager, popup: string): void {
			if (toId(popup).startsWith('room')) {
				const auth: Record<string, string> = {};
				const _message = popup.replace('Moderators', ':').replace('Drivers', ':').replace('Voices', ':');
				const parts = _message.split(':');
				let rank = ' ';
				for (let i = 0; i < parts.length; i += 2) {
					const usersList = parts[i + 1].split(',');
					if (parts[i].includes('(')) rank = parts[i].split('(', 2)[1].charAt(0);
					for (let f = 0; f < usersList.length; f++) {
						auth[toId(usersList[f])] = rank;
					}
				}
				this.roomAuth[this.parserArray[this.parserIndex]] = auth;
				if (Config.debug?.debug) debug('Roomauth from ' + this.parserArray[this.parserIndex] + ' = ' + JSON.stringify(auth));
				Bot.removeListener('popup', popupParser);
				setTimeout(this.getNextRoom, 1500);
			}
		}.bind(this);
		Bot.on('popup', popupParser);
		Bot.say(this.parserArray[this.parserIndex], '/roomauth');
	}

	init(): void {
		validateConfigArray('autoInvite');
		this.privateRooms = Array.from(new Set(Object.values(Config.autoInvite).map((room) => room.private)));
		this.roomAuthChanges = this.privateRooms.reduce((acc, v) => {
			acc[v] = 1;
			return acc;
		}, {} as Record<string, number>);
		this.linkedRooms = Config.autoInvite.map((room) => {
			return { ...room };
		});
		if (this.checkAuthTimer) clearInterval(this.checkAuthTimer);
		this.checkAuthTimer = this.privateRooms.length ? setInterval(this.checkAuth, 10 * 1000) : null;
	}

	parse(room: string, message: string, isIntro: boolean, spl: string[]): void {
		if (isIntro) return;
		if (!Bot.rooms[room] || Bot.rooms[room].type !== 'chat') return;
		switch (spl[0]) {
			case 'J':
			case 'j':
				this.parseJoin(room, spl[1]);
				break;
			case 'n':
			case 'N':
				this.parseRename(room, spl[1], spl[2]);
				break;
		}
		if (message.substr(0) !== '|') this.parseRaw(room, message);
	}

	destroy(): void {
		this.roomAuth = {};
		if (this.checkAuthTimer) clearInterval(this.checkAuthTimer);
		this.checkAuthTimer = null;
		if (Features.features[this.id]) delete Features.features[this.id];
	}
}

export const feature = AutoInviteManager;
