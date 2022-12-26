/*
 * Minimized version of Pokemon Showdown Client for Node JS
 *
 * By: Ecuacion (https://github.com/Ecuacion) (C) Copyright 2015-2016
 *
 * Part of this code is imported from other developments, so credits to:
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

import * as https from 'https';
import * as url from 'url';
import { EventEmitter } from 'events';
import { client as WebSocketClient, connection } from 'websocket';
import * as util from 'util';
import { IncomingMessage } from 'http';
import { toId } from './tools';

interface ClientOptions {
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
};

export class Client {
	opts: ClientOptions;
	actionUrl: url.UrlWithStringQuery;
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
	closed: boolean = false;
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
			...opts
		};
		this.actionUrl = url.parse(this.opts.loginServer);

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
		if (this.opts.debug) console.log("DEBUG: " + str);
	}

	error(str: string): void {
		if (this.opts.showErrors) console.log("ERROR: " + str);
	}

	init() {
		if (this.opts.autoConnect) {
			this.connect();
		}
		if (this.opts.connectionTimeout) {
			this.startConnectionTimeOut();
		}
	};

	on(name: string, listener: (...args: any[]) => void) {
		this.events.addListener(name, listener);
	};

	removeListener(name: string, listener: (...args: any[]) => void) {
		this.events.removeListener(name, listener);
	};

	connect(retry?: boolean) {
		if (retry) {
			this.debug('retrying...');
		}
		if (this.status.connected) return this.error("Already connected");
		this.closed = false;
		var webSocket = new WebSocketClient();
		this.webSocket = webSocket;
		var self = this;
		self.rooms = {};
		self.roomcount = 0;
		webSocket.on('connectFailed', function (err) {
			self.error("Could not connect to server " + self.opts.server + ": " + util.inspect(err));
			self.events.emit('disconnect', err);
			if (self.opts.autoReconnect) {
				self.debug("retrying in " + (self.opts.autoReconnectDelay / 1000) + " seconds");
				setTimeout(function () {
					self.connect(true);
				}, self.opts.autoReconnectDelay);
			}
		});
		webSocket.on('connect', function (connection) {
			self.events.emit('connect', connection);
			self.debug('connected to server ' + self.opts.server);
			self.status.connected = true;
			self.connection = connection;
			connection.on('error', function (err) {
				self.error('connection error: ' + util.inspect(err));
				self.connection = null;
				self.status.connected = false;
				self.events.emit('disconnect', err);
				if (self.opts.autoReconnect) {
					self.debug("retrying in " + (self.opts.autoReconnectDelay / 1000) + " seconds");
					setTimeout(function () {
						self.connect(true);
					}, self.opts.autoReconnectDelay);
				}
			});
			connection.on('close', function () {
				self.debug('connection closed: ' + util.inspect(arguments));
				self.connection = null;
				self.status.connected = false;
				self.events.emit('disconnect', 0);
				if (!self.closed && self.opts.autoReconnect) {
					self.debug("retrying in " + (self.opts.autoReconnectDelay / 1000) + " seconds");
					setTimeout(function () {
						self.connect(true);
					}, self.opts.autoReconnectDelay);
				}
			});
			connection.on('message', function (message) {
				if (message.type === 'utf8') {
					self.events.emit('message', message.utf8Data);
					self.receive(message.utf8Data);
				}
			});
		});
		var id = ~~(Math.random() * 900) + 100;
		var chars = 'abcdefghijklmnopqrstuvwxyz0123456789_';
		var str = '';
		for (var i = 0, l = chars.length; i < 8; i++) {
			str += chars.charAt(~~(Math.random() * l));
		}
		var conStr = 'ws://' + self.opts.server + ':' + self.opts.port + '/showdown/' + id + '/' + str + '/websocket';
		self.debug('connecting to ' + conStr + ' - secondary protocols: ' + util.inspect(self.opts.secprotocols));
		webSocket.connect(conStr, self.opts.secprotocols);
	};

	disconnect() {
		this.closed = true;
		if (this.connection) this.connection.close();
	};

	softDisconnect() {
		if (this.connection) this.connection.close();
	};

	rename(nick: string, pass?: string | null) {
		const requestOptions: https.RequestOptions = {
			hostname: this.actionUrl.hostname,
			port: this.actionUrl.port,
			path: this.actionUrl.pathname,
			agent: false
		};
		var data = '';
		if (!pass) {
			requestOptions.method = 'GET';
			requestOptions.path += '?act=getassertion&userid=' + toId(nick) + '&challengekeyid=' + this.challstr.id + '&challenge=' + this.challstr.str;
			this.debug("Sending log in request to: " + requestOptions.path);
		} else {
			requestOptions.method = 'POST';
			data = 'act=login&name=' + toId(nick) + '&pass=' + pass + '&challengekeyid=' + this.challstr.id + '&challenge=' + this.challstr.str;
			requestOptions.headers = {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': data.length
			};
			this.debug("Sending log in request to: " + requestOptions.path + " | Data -> " + data);
		}
		var req = https.request(requestOptions, ((res: IncomingMessage): void => {
			res.setEncoding('utf8');
			var data = '';
			res.on('data', (chunk: string): void => {
				data += chunk;
			});
			res.on('end', (function (this: Client): void {
				if (data === ';') {
					this.error('failed to log in; nick is registered - invalid or no password given');
					this.events.emit('renamefailure', -1);
					return;
				}
				if (data.length < 50) {
					this.error('failed to log in: ' + data);
					if (this.opts.retryLogin) {
						this.debug("Retrying log in process in " + (this.opts.retryLogin / 1000) + " seconds...");
						setTimeout(function (this: Client) { this.rename(nick, pass); }.bind(this), this.opts.retryLogin);
					}
					this.events.emit('renamefailure', -2);
					return;
				}
				if (data.indexOf('heavy load') !== -1) {
					this.error('the login server is under heavy load');
					if (this.opts.retryLogin) {
						this.debug("Retrying log in process in " + (this.opts.retryLogin / 1000) + " seconds...");
						setTimeout(function (this: Client) { this.rename(nick, pass); }.bind(this), this.opts.retryLogin);
					}
					this.events.emit('renamefailure', -3);
					return;
				}
				try {
					const jsonData = JSON.parse(data.substr(1));
					if (jsonData.actionsuccess) {
						data = jsonData.assertion;
					} else {
						this.error('could not log in; action was not successful: ' + JSON.stringify(data));
						if (this.opts.retryLogin) {
							this.debug("Retrying log in process in " + (this.opts.retryLogin / 1000) + " seconds...");
							setTimeout(function (this: Client) { this.rename(nick, pass); }.bind(this), this.opts.retryLogin);
						}
						this.events.emit('renamefailure', -4);
						return;
					}
				} catch (e) { }
				this.debug('Sending log in trn...');
				this.send('|/trn ' + nick + ',0,' + data);
			}).bind(this));
		}).bind(this));
		req.on('error', (function (this: Client, err: Error) {
			this.error('login error: ' + util.inspect(err));
			if (this.opts.retryLogin) {
				this.debug("Retrying log in process in " + (this.opts.retryLogin / 1000) + " seconds...");
				setTimeout(function (this: Client) { this.rename(nick, pass); }.bind(this), this.opts.retryLogin);
			}
			this.events.emit('renamefailure', err);
			return;
		}).bind(this));
		if (data) {
			req.write(data);
		}
		req.end();
	};

	logout() {
		this.send('|/logout');
	};

	isConnected() {
		return !!this.status.connected;
	};

	getBotNick() {
		return this.status.nickName;
	};

	send(data: any, delay: number = 1000) {
		const connection = this.connection;
		var self = this;
		if (connection && connection.connected) {
			if (!Array.isArray(data)) {
				data = [data.toString()];
			}
			if (data.length > 3) {
				var spacer: NodeJS.Timeout;
				const nextToSend = () => {
					if (!data.length) {
						clearInterval(spacer);
						return;
					}
					var toSend = data.splice(0, 3);
					toSend = JSON.stringify(toSend);
					self.events.emit('send', toSend);
					connection.send(toSend);
				};
				spacer = setInterval(nextToSend, delay);
				nextToSend();
				return spacer;
			} else {
				data = JSON.stringify(data);
				self.events.emit('send', data);
				connection.send(data);
			}
		} else {
			this.error("Could not send data: ERR_NOT_CONNECTED");
			self.events.emit('sendfailure', -1);
		}
	};

	sendRoom(room: String, data: any, delay?: number) {
		if (!Array.isArray(data)) {
			data = [data.toString()];
		}
		for (var i = 0; i < data.length; i++) {
			data[i] = room + '|' + data[i];
		}
		return this.send(data, delay);
	};

	say(room: string, msg: string) {
		if (room.charAt(0) === ',') {
			return this.pm(room.substr(1), msg);
		}
		return this.send(room + '|' + msg);
	};

	pm(user: string, msg: string) {
		return this.send('|/pm ' + user + ',' + msg);
	};

	leaveRooms(rooms: string[]) {
		var cmds: string[] = [];
		var room;
		for (var i = 0; i < rooms.length; i++) {
			room = toId(rooms[i]);
			if (!this.rooms[room]) continue;
			cmds.push('|/leave ' + room);
		}
		if (cmds.length) return this.send(cmds);
	};

	leaveRoom(room: string) {
		return this.leaveRooms([room]);
	};

	receive(message: string) {
		this.lastMessage = Date.now();
		var flag = message.substr(0, 1);
		var data;
		switch (flag) {
			case 'a':
				data = JSON.parse(message.substr(1));
				if (Array.isArray(data)) {
					for (var i = 0; i < data.length; i++) {
						this.receiveMsg(data[i]);
					}
				} else {
					this.receiveMsg(message);
				}
				break;
		}
	};

	receiveMsg(message?: string) {
		if (!message) return;
		if (message.indexOf('\n') > -1) {
			var spl = message.split('\n');
			var room = 'lobby';
			if (spl[0].charAt(0) === '>') {
				room = spl[0].substr(1);
				if (room === '') room = 'lobby';
			}
			for (var i = 0, len = spl.length; i < len; i++) {
				if (spl[i].split('|')[1] && (spl[i].split('|')[1] === 'init')) {
					for (var j = i; j < len; j++) {
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
	};

	receiveLine(room: string, message: string, isIntro?: boolean) {
		var spl = message.substr(1).split('|');
		this.events.emit('line', room, message, isIntro, spl);
		if (spl[1]) {
			var thisEvent = (spl[0].charAt(0) !== '-') ? 'major' : 'minor';
			this.events.emit(thisEvent, room, spl[0], message.substr(spl[0].length + 2), isIntro);
		} else {
			this.events.emit('major', room, '', message, isIntro);
		}
		var by, timeOff;
		switch (spl[0]) {
			case 'formats':
				this.events.emit('formats', message.substr(spl[0].length + 2));
				break;
			case 'challstr':
				var id = spl[1];
				var str = spl[2];
				this.challstr = {
					id: id,
					str: str
				};
				if (this.opts.nickName !== null) this.rename(this.opts.nickName, this.opts.pass);
				this.events.emit('challstr', spl[1] + spl[2]);
				break;
			case 'updateuser':
				var name = spl[1];
				var named = parseInt(spl[2]);
				var avatar = spl[3];
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
					userCount: 0
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
				var userArr = message.substr(7).split(",");
				this.rooms[room].userCount = parseInt(userArr[0]);
				for (var k = 1; k < userArr.length; k++) {
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
				var dest = spl[2];
				spl.splice(0, 3);
				if (by.substr(1) === this.status.nickName) {
					this.events.emit('pmsucess', dest, spl.join('|'));
				} else {
					this.events.emit('pm', by, spl.join('|'));
				}
				break;
			case 'n': case 'N':
				by = spl[1];
				var old = spl[2];
				if (this.rooms[room]) {
					if (this.rooms[room].users[toId(old)]) delete this.rooms[room].users[toId(old)];
					this.rooms[room].users[toId(by)] = by;
				}
				this.events.emit('userrename', room, old, by);
				break;
			case 'J': case 'j':
				by = spl[1];
				if (this.rooms[room] && !this.rooms[room].users[toId(by)]) {
					this.rooms[room].users[toId(by)] = by;
					this.rooms[room].userCount++;
				}
				this.events.emit('userjoin', room, by);
				break;
			case 'l': case 'L':
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
			case 'raw': case 'html':
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
	};

	startConnectionTimeOut() {
		var self = this;
		this.stopConnectionTimeOut();
		this.connectionTimeOutInterval = setInterval(function () {
			if (self.status.connected && self.lastMessage) {
				var t = Date.now();
				if (t - self.lastMessage > self.opts.connectionTimeout) {
					self.error("Connection timeout: " + (t - self.lastMessage));
					self.softDisconnect();
				}
			}
		}, self.opts.connectionTimeout);
	};

	stopConnectionTimeOut() {
		if (this.connectionTimeOutInterval) clearInterval(this.connectionTimeOutInterval);
	};

	destroy() {
		this.stopConnectionTimeOut();
		this.disconnect();
	};
};