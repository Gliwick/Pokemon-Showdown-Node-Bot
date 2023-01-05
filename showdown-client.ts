/*
 * Minimized version of Pokemon Showdown Client for Node JS
 *
 * By: Gliwick (https://github.com/Gliwick) (C) Copyright 2015-2016
 *
 * Part of this code is imported from other developments, so credits to:
 *
 * Ecuacion (https://github.com/Ecuacion) original owner
 *
 * Quinella, Morfent (https://github.com/Morfent) and TalkTakesTime (https://github.com/TalkTakesTime) developers of Pokemon-Showdown-Bot (https://github.com/TalkTakesTime/Pokemon-Showdown-Bot)
 *
 * Guangcong Luo (https://github.com/Zarel) and other contributors of Pokemon Showdown (https://github.com/Zarel/Pokemon-Showdown)
 *
 * This library is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this library.  If not, see <http://www.gnu.org/licenses/>.
 */

import { EventEmitter } from 'events';
import { IncomingMessage } from 'http';
import { request, RequestOptions } from 'https';
import { parse, UrlWithStringQuery } from 'url';
import { inspect } from 'util';
import { client as WebSocketClient, connection, Message } from 'websocket';

import { toId } from './tools';

export interface ClientOptions {
	server: string;
	serverid: string;
	port: number;
	secprotocols: string[];
	connectionTimeout: number;
	loginServer: string;
	nickName: string | null;
	pass: string | null;
	retryLogin: number;
	autoConnect: boolean;
	autoReconnect: boolean;
	autoReconnectDelay: number;
	showErrors: boolean;
	debug: boolean;
}

interface Room {
	type: string;
	title: string;
	users: Record<string, string>;
	userCount: number;
}

export class Client {
	opts: ClientOptions;
	actionUrl: UrlWithStringQuery;
	rooms: Record<string, Room>;
	roomcount: number;
	connection: connection | null;
	statusId: number;
	status: {
		connected: boolean;
		nickName?: string;
		named?: number;
		avatar?: string;
	};
	challstr: {
		id: string;
		str: string;
	};
	events: EventEmitter;
	closed = false;
	webSocket: WebSocketClient | null = null;
	lastMessage?: number;
	connectionTimeOutInterval: NodeJS.Timeout | null = null;

	constructor(server: string, port: number, opts: Partial<ClientOptions>) {
		this.opts = {
			server: server,
			serverid: 'showdown',
			port: port,
			secprotocols: [],
			connectionTimeout: 2 * 60 * 1000,
			loginServer: 'https://play.pokemonshowdown.com/~~showdown/action.php',
			nickName: null,
			pass: null,
			retryLogin: 10 * 1000,
			autoConnect: true,
			autoReconnect: true,
			autoReconnectDelay: 30 * 1000,
			showErrors: false,
			debug: false,
			...opts,
		};
		this.actionUrl = parse(this.opts.loginServer);

		this.rooms = {};
		this.roomcount = 0;

		this.connection = null;
		this.statusId = 0;
		this.status = { connected: false };
		this.challstr = {
			id: '',
			str: '',
		};
		this.events = new EventEmitter();
	}

	debug(str: string): void {
		if (this.opts.debug) console.log('DEBUG: ' + str);
	}

	error(str: string): void {
		if (this.opts.showErrors) console.log('ERROR: ' + str);
	}

	init(): void {
		if (this.opts.autoConnect) {
			this.connect();
		}
		if (this.opts.connectionTimeout) {
			this.startConnectionTimeOut();
		}
	}

	on(name: string, listener: (...args: any[]) => void): void {
		this.events.addListener(name, listener);
	}

	removeListener(name: string, listener: (...args: any[]) => void): void {
		this.events.removeListener(name, listener);
	}

	private reconnect(): void {
		this.connect(true);
	}

	private onConnect(connection: connection): void {
		const retryFn = this.reconnect.bind(this);
		this.events.emit('connect', connection);
		this.debug('connected to server ' + this.opts.server);
		this.status.connected = true;
		this.connection = connection;
		connection.on(
			'error',
			((err: Error): void => {
				this.error('connection error: ' + inspect(err));
				this.connection = null;
				this.status.connected = false;
				this.events.emit('disconnect', err);
				if (this.opts.autoReconnect) {
					this.debug('retrying in ' + this.opts.autoReconnectDelay / 1000 + ' seconds');
					setTimeout(retryFn, this.opts.autoReconnectDelay);
				}
			}).bind(this)
		);
		connection.on(
			'close',
			((code: number, desc: string): void => {
				this.debug('connection closed: ' + inspect([code, desc]));
				this.connection = null;
				this.status.connected = false;
				this.events.emit('disconnect', 0);
				if (!this.closed && this.opts.autoReconnect) {
					this.debug('retrying in ' + this.opts.autoReconnectDelay / 1000 + ' seconds');
					setTimeout(retryFn, this.opts.autoReconnectDelay);
				}
			}).bind(this)
		);
		connection.on(
			'message',
			((message: Message): void => {
				if (message.type === 'utf8') {
					this.events.emit('message', message.utf8Data);
					this.receive(message.utf8Data);
				}
			}).bind(this)
		);
	}

	connect(retry?: boolean): void {
		if (retry) {
			this.debug('retrying...');
		}
		if (this.status.connected) return this.error('Already connected');
		this.closed = false;
		const webSocket = new WebSocketClient();
		this.webSocket = webSocket;
		this.rooms = {};
		this.roomcount = 0;
		webSocket.on(
			'connectFailed',
			((err: Error): void => {
				this.error('Could not connect to server ' + this.opts.server + ': ' + inspect(err));
				this.events.emit('disconnect', err);
				if (this.opts.autoReconnect) {
					this.debug('retrying in ' + this.opts.autoReconnectDelay / 1000 + ' seconds');
					setTimeout(
						((): void => {
							this.connect(true);
						}).bind(this),
						this.opts.autoReconnectDelay
					);
				}
			}).bind(this)
		);
		webSocket.on('connect', ((connection: connection): void => this.onConnect(connection)).bind(this));
		const id = ~~(Math.random() * 900) + 100;
		const chars = 'abcdefghijklmnopqrstuvwxyz0123456789_';
		let str = '';
		for (let i = 0, l = chars.length; i < 8; i++) {
			str += chars.charAt(~~(Math.random() * l));
		}
		const conStr = 'ws://' + this.opts.server + ':' + this.opts.port + '/showdown/' + id + '/' + str + '/websocket';
		this.debug('connecting to ' + conStr + ' - secondary protocols: ' + inspect(this.opts.secprotocols));
		webSocket.connect(conStr, this.opts.secprotocols);
	}

	disconnect(): void {
		this.closed = true;
		if (this.connection) this.connection.close();
	}

	softDisconnect(): void {
		if (this.connection) this.connection.close();
	}

	private onRenameEnd(data: { data: string }, nick: string, pass?: string | null): void {
		if (data.data === ';') {
			this.error('failed to log in; nick is registered - invalid or no password given');
			this.events.emit('renamefailure', -1);
			return;
		}
		const retryFn = ((): void => this.rename(nick, pass)).bind(this);
		if (data.data.length < 50) {
			this.error('failed to log in: ' + data);
			if (this.opts.retryLogin) {
				this.debug('Retrying log in process in ' + this.opts.retryLogin / 1000 + ' seconds...');
				setTimeout(retryFn, this.opts.retryLogin);
			}
			this.events.emit('renamefailure', -2);
			return;
		}
		if (data.data.indexOf('heavy load') !== -1) {
			this.error('the login server is under heavy load');
			if (this.opts.retryLogin) {
				this.debug('Retrying log in process in ' + this.opts.retryLogin / 1000 + ' seconds...');
				setTimeout(retryFn, this.opts.retryLogin);
			}
			this.events.emit('renamefailure', -3);
			return;
		}
		try {
			const jsonData = JSON.parse(data.data.substr(1));
			if (jsonData.actionsuccess) {
				data.data = jsonData.assertion;
			} else {
				this.error('could not log in; action was not successful: ' + JSON.stringify(data));
				if (this.opts.retryLogin) {
					this.debug('Retrying log in process in ' + this.opts.retryLogin / 1000 + ' seconds...');
					setTimeout(retryFn, this.opts.retryLogin);
				}
				this.events.emit('renamefailure', -4);
				return;
			}
		} catch (e: any) {}
		this.debug('Sending log in trn...');
		this.send('|/trn ' + nick + ',0,' + data.data);
	}

	private onRename(res: IncomingMessage, nick: string, pass?: string | null): void {
		res.setEncoding('utf8');
		const data = { data: '' };
		res.on('data', (chunk: string): void => {
			data.data += chunk;
		});
		res.on('end', ((): void => this.onRenameEnd(data, nick, pass)).bind(this));
	}

	rename(nick: string, pass?: string | null): void {
		const requestOptions: RequestOptions = {
			hostname: this.actionUrl.hostname,
			port: this.actionUrl.port,
			path: this.actionUrl.pathname,
			agent: false,
		};
		let data = '';
		if (!pass) {
			requestOptions.method = 'GET';
			requestOptions.path +=
				'?act=getassertion&userid=' + toId(nick) + '&challengekeyid=' + this.challstr.id + '&challenge=' + this.challstr.str;
			this.debug('Sending log in request to: ' + requestOptions.path);
		} else {
			requestOptions.method = 'POST';
			data =
				'act=login&name=' +
				toId(nick) +
				'&pass=' +
				pass +
				'&challengekeyid=' +
				this.challstr.id +
				'&challenge=' +
				this.challstr.str;
			requestOptions.headers = {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': data.length,
			};
			this.debug('Sending log in request to: ' + requestOptions.path + ' | Data -> ' + data);
		}
		const req = request(requestOptions, ((res: IncomingMessage): void => this.onRename(res, nick, pass)).bind(this));
		req.on(
			'error',
			((err: Error): void => {
				this.error('login error: ' + inspect(err));
				if (this.opts.retryLogin) {
					this.debug('Retrying log in process in ' + this.opts.retryLogin / 1000 + ' seconds...');
					setTimeout(((): void => this.rename(nick, pass)).bind(this), this.opts.retryLogin);
				}
				this.events.emit('renamefailure', err);
				return;
			}).bind(this)
		);
		if (data) {
			req.write(data);
		}
		req.end();
	}

	logout(): void {
		this.send('|/logout');
	}

	isConnected(): boolean {
		return this.status.connected;
	}

	getBotNick(): string | undefined {
		return this.status.nickName;
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	send(data: string | string[], delay = 1000): NodeJS.Timeout | void {
		const connection = this.connection;
		if (connection && connection.connected) {
			const dataArray = Array.isArray(data) ? data : [data];
			if (dataArray.length > 3) {
				let spacer: NodeJS.Timeout | null = null;
				const nextToSend = (): void => {
					if (!dataArray.length) {
						if (spacer) clearInterval(spacer);
						return;
					}
					const toSend = JSON.stringify(dataArray.splice(0, 3));
					this.events.emit('send', toSend);
					connection.send(toSend);
				};
				spacer = setInterval(nextToSend, delay);
				nextToSend();
				return spacer;
			} else {
				const toSend = JSON.stringify(dataArray);
				this.events.emit('send', toSend);
				connection.send(toSend);
			}
		} else {
			this.error('Could not send data: ERR_NOT_CONNECTED');
			this.events.emit('sendfailure', -1);
		}
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	sendRoom(room: string, data: any, delay?: number): NodeJS.Timeout | void {
		if (!Array.isArray(data)) {
			data = [data.toString()];
		}
		for (let i = 0; i < data.length; i++) {
			data[i] = room + '|' + data[i];
		}
		return this.send(data, delay);
	}

	say(room: string, msg: string): NodeJS.Timeout | void {
		if (room.charAt(0) === ',') {
			return this.pm(room.substr(1), msg);
		}
		return this.send(room + '|' + msg);
	}

	pm(user: string, msg: string): NodeJS.Timeout | void {
		return this.send('|/pm ' + user + ',' + msg);
	}

	leaveRooms(rooms: string[]): NodeJS.Timeout | void {
		const cmds: string[] = [];
		let room;
		for (let i = 0; i < rooms.length; i++) {
			room = toId(rooms[i]);
			if (!this.rooms[room]) continue;
			cmds.push('|/leave ' + room);
		}
		if (cmds.length) return this.send(cmds);
	}

	leaveRoom(room: string): NodeJS.Timeout | void {
		return this.leaveRooms([room]);
	}

	receive(message: string): void {
		this.lastMessage = Date.now();
		const flag = message.substr(0, 1);
		let data;
		switch (flag) {
			case 'a':
				data = JSON.parse(message.substr(1));
				if (Array.isArray(data)) {
					for (let i = 0; i < data.length; i++) {
						this.receiveMsg(data[i]);
					}
				} else {
					this.receiveMsg(message);
				}
				break;
		}
	}

	receiveMsg(message?: string): void {
		if (!message) return;
		if (message.indexOf('\n') > -1) {
			const spl = message.split('\n');
			let room = 'lobby';
			if (spl[0].charAt(0) === '>') {
				room = spl[0].substr(1);
				if (room === '') room = 'lobby';
			}
			for (let i = 0, len = spl.length; i < len; i++) {
				if (spl[i].split('|')[1] && spl[i].split('|')[1] === 'init') {
					for (let j = i; j < len; j++) {
						this.receiveLine(room, spl[j], true);
					}
					break;
				} else {
					this.receiveLine(room, spl[i]);
				}
			}
		} else {
			this.receiveLine('lobby', message);
		}
	}

	receiveLine(room: string, message: string, isIntro?: boolean): void {
		const spl = message.substr(1).split('|');
		this.events.emit('line', room, message, isIntro, spl);
		if (spl[1]) {
			const thisEvent = spl[0].charAt(0) !== '-' ? 'major' : 'minor';
			this.events.emit(thisEvent, room, spl[0], message.substr(spl[0].length + 2), isIntro);
		} else {
			this.events.emit('major', room, '', message, isIntro);
		}
		let by: string;
		let timeOff: number;
		switch (spl[0]) {
			case 'formats':
				this.events.emit('formats', message.substr(spl[0].length + 2));
				break;
			case 'challstr':
				const id = spl[1];
				const str = spl[2];
				this.challstr = { id, str };
				if (this.opts.nickName !== null) this.rename(this.opts.nickName, this.opts.pass);
				this.events.emit('challstr', spl[1] + spl[2]);
				break;
			case 'updateuser':
				const name = spl[1];
				const named = parseInt(spl[2]);
				const avatar = spl[3];
				this.status.nickName = spl[1];
				this.status.named = named;
				this.status.avatar = avatar;
				this.events.emit('rename', name, named, avatar);
				break;
			case 'init':
				this.rooms[room] = {
					type: spl[1] || 'chat',
					title: '',
					users: {},
					userCount: 0,
				};
				this.roomcount = Object.keys(this.rooms).length;
				this.events.emit('joinroom', room, this.rooms[room].type);
				break;
			case 'deinit':
				if (this.rooms[room]) {
					this.events.emit('leaveroom', room);
					delete this.rooms[room];
					this.roomcount = Object.keys(this.rooms).length;
				}
				break;
			case 'noinit':
				this.events.emit('joinfailure', room, spl[1], spl[2]);
				break;
			case 'title':
				if (this.rooms[room]) this.rooms[room].title = spl[1];
				break;
			case 'users':
				if (!this.rooms[room]) break;
				const userArr = message.substr(7).split(',');
				this.rooms[room].userCount = parseInt(userArr[0]);
				for (let k = 1; k < userArr.length; k++) {
					this.rooms[room].users[toId(userArr[k])] = userArr[k];
				}
				break;
			case 'c':
				by = spl[1];
				timeOff = Date.now();
				spl.splice(0, 2);
				if (isIntro) {
					break;
				}
				if (by.substr(1) === this.status.nickName) {
					this.events.emit('chatsucess', room, timeOff, spl.join('|'));
				} else {
					this.events.emit('chat', room, timeOff, by, spl.join('|'));
				}
				break;
			case 'c:':
				by = spl[2];
				timeOff = parseInt(spl[1]) * 1000;
				spl.splice(0, 3);
				if (isIntro) {
					break;
				}
				if (by.substr(1) === this.status.nickName) {
					this.events.emit('chatsucess', room, timeOff, spl.join('|'));
				} else {
					this.events.emit('chat', room, timeOff, by, spl.join('|'));
				}
				break;
			case 'pm':
				by = spl[1];
				const dest = spl[2];
				spl.splice(0, 3);
				if (by.substr(1) === this.status.nickName) {
					this.events.emit('pmsucess', dest, spl.join('|'));
				} else {
					this.events.emit('pm', by, spl.join('|'));
				}
				break;
			case 'n':
			case 'N':
				by = spl[1];
				const old = spl[2];
				if (this.rooms[room]) {
					if (this.rooms[room].users[toId(old)]) delete this.rooms[room].users[toId(old)];
					this.rooms[room].users[toId(by)] = by;
				}
				this.events.emit('userrename', room, old, by);
				break;
			case 'J':
			case 'j':
				by = spl[1];
				if (this.rooms[room] && !this.rooms[room].users[toId(by)]) {
					this.rooms[room].users[toId(by)] = by;
					this.rooms[room].userCount++;
				}
				this.events.emit('userjoin', room, by);
				break;
			case 'l':
			case 'L':
				by = spl[1];
				if (this.rooms[room] && this.rooms[room].users[toId(by)]) {
					delete this.rooms[room].users[toId(by)];
					this.rooms[room].userCount--;
				}
				this.events.emit('userleave', room, by);
				break;
			case 'queryresponse':
				this.events.emit('queryresponse', message.substr(15));
				break;
			case 'popup':
				this.events.emit('popup', message.substr(7));
				break;
			case 'raw':
			case 'html':
				if (isIntro) {
					break;
				}
				this.events.emit('raw', room, message.substr(2 + spl[0].length));
				break;
			default:
				if (!spl[1]) {
					if (isIntro) {
						break;
					}
					this.events.emit('raw', room, message);
				}
		}
	}

	startConnectionTimeOut(): void {
		this.stopConnectionTimeOut();
		this.connectionTimeOutInterval = setInterval(
			((): void => {
				if (this.status.connected && this.lastMessage) {
					const t = Date.now();
					if (t - this.lastMessage > this.opts.connectionTimeout) {
						this.error('Connection timeout: ' + (t - this.lastMessage));
						this.softDisconnect();
					}
				}
			}).bind(this),
			this.opts.connectionTimeout
		);
	}

	stopConnectionTimeOut(): void {
		if (this.connectionTimeOutInterval) clearInterval(this.connectionTimeOutInterval);
	}

	destroy(): void {
		this.stopConnectionTimeOut();
		this.disconnect();
	}
}
