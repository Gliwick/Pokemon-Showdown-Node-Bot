/*
 * Tournaments points system
 */

import { LeaderboardConfig } from '../../config-tools';
import { debug } from '../../log';
import { FlatFileManager } from '../../settings';
import { generateRandomNick, getDateString, toId } from '../../tools';
import { BracketNode, TourData } from '.';

const toursDataFile = AppOptions.data + 'leaderboards.json';

interface TournamentResult {
	players: string[];
	general: Record<string, number>;
	winner: string;
	finalist: string;
	semiFinalists: string[];
}

interface Points {
	name: string;
	room: string;
	wins: number;
	finals: number;
	semis: number;
	battles: number;
	tours: number;
	points: number;
}

export class LeaderboardsManager {
	toursFFM;
	ladder: Record<string, Record<string, [string, number, number, number, number, number]>>;

	resetCodes: Record<string, string> = {};

	constructor() {
		this.toursFFM = new FlatFileManager(toursDataFile);
		this.ladder = this.toursFFM.readObjSafe();
	}

	save(): void {
		this.toursFFM.writeObj(this.ladder);
	}

	isConfigured(room: string): boolean {
		if (!Config.leaderboards?.[room] && !Settings.settings.leaderboards?.[room]) return false;
		return true;
	}

	filterTier(tier: string, filter: string | string[] | RegExp | Record<string, boolean>): boolean {
		tier = toId(tier || '');
		if (typeof filter === 'string') {
			return tier === toId(filter);
		} else if (filter !== null && typeof filter === 'object') {
			if (Array.isArray(filter)) {
				if (filter.indexOf(tier) >= 0) return true;
				return false;
			} else if (filter instanceof RegExp) {
				return filter.test(tier);
			} else {
				if (tier in filter) return true;
				return false;
			}
		} else {
			return true;
		}
	}

	getConfig(room: string): LeaderboardConfig {
		const res = {
			onlyOfficial: false,
			winnerPoints: 5,
			finalistPoints: 3,
			semiFinalistPoints: 1,
			battlePoints: 0,
		};
		Object.assign(res, Config.leaderboards[room] || Settings.settings.leaderboards?.[room] || {});
		return res;
	}

	parseTourTree(tree: BracketNode): Record<string, number> {
		const auxobj: Record<string, number> = {};
		const team = tree.team;
		const state = tree.state;
		let children = tree.children;
		if (!children) children = [];
		if (!auxobj[team]) auxobj[team] = 0;
		if (state && state === 'finished') {
			auxobj[team] += 1;
		}
		let aux;
		for (let i = 0; i < children.length; i++) {
			aux = this.parseTourTree(children[i]);
			for (const j in aux) {
				if (!auxobj[j]) auxobj[j] = 0;
				auxobj[j] += aux[j];
			}
		}
		return auxobj;
	}

	parseTournamentResults(data: TourData): TournamentResult | null {
		const generator = toId(data.generator || '');
		if (generator === 'singleelimination') {
			const parsedTree = this.parseTourTree(data.bracketData.rootNode);
			const players = Object.keys(parsedTree);
			const general = { ...parsedTree };
			//winners
			const winner = toId(data.results[0][0]);
			let finalist = '';
			const semiFinalists: string[] = [];
			let aux, aux2;
			if (data.bracketData.rootNode.children) {
				for (let f = 0; f < data.bracketData.rootNode.children.length; f++) {
					aux = toId(data.bracketData.rootNode.children[f].team || '');
					if (aux && aux !== winner) {
						finalist = aux;
					}
					const children = data.bracketData.rootNode.children[f].children;
					if (children) {
						for (let j = 0; j < children.length; j++) {
							aux2 = toId(children[j].team || '');
							if (aux2 && aux2 !== winner && aux2 !== finalist && semiFinalists.indexOf(aux2) < 0) {
								semiFinalists.push(aux2);
							}
						}
					}
				}
			}
			return { players, general, winner, finalist, semiFinalists };
		} else {
			debug('Incompatible generator: ' + data.generator);
			return null; //Not compatible generator
		}
	}

	getPoints(room: string, user: string): Points {
		const userid = toId(user);
		const roomConfig = this.getConfig(room);
		const pWin = roomConfig.winnerPoints;
		const pFinal = roomConfig.finalistPoints;
		const pSemiFinal = roomConfig.semiFinalistPoints;
		const pBattle = roomConfig.battlePoints;
		let name = user;
		let wins = 0;
		let finals = 0;
		let semis = 0;
		let battles = 0;
		let tours = 0;
		const ladder = this.ladder[room] && this.ladder[room][userid];
		if (ladder) {
			name = ladder[0];
			wins = ladder[1];
			finals = ladder[2];
			semis = ladder[3];
			battles = ladder[4];
			tours = ladder[5];
		}
		return {
			name,
			room,
			wins,
			finals,
			semis,
			battles,
			tours,
			points: pWin * wins + finals * pFinal + semis * pSemiFinal + battles * pBattle,
		};
	}

	getTop(room: string): [string, number, number, number, number, number, number][] | null {
		if (!this.isConfigured(room)) return null;
		const roomConfig = this.getConfig(room);
		const pWin = roomConfig.winnerPoints;
		const pFinal = roomConfig.finalistPoints;
		const pSemiFinal = roomConfig.semiFinalistPoints;
		const pBattle = roomConfig.battlePoints;
		if (!this.ladder[room]) return [];
		const top: [string, number, number, number, number, number, number][] = [];
		let points = 0;
		for (const u in this.ladder[room]) {
			points =
				pWin * this.ladder[room][u][1] +
				pFinal * this.ladder[room][u][2] +
				pSemiFinal * this.ladder[room][u][3] +
				pBattle * this.ladder[room][u][4];
			top.push([...this.ladder[room][u], points]);
		}
		return top.sort(function (a, b) {
			if (a[6] !== b[6]) return b[6] - a[6]; //Points
			if (a[1] !== b[1]) return b[1] - a[1]; //Wins
			if (a[2] !== b[2]) return b[2] - a[2]; //Finals
			if (a[3] !== b[3]) return b[3] - a[3]; //Semis
			if (a[4] !== b[4]) return b[4] - a[4]; //Battles
			if (a[5] !== b[5]) return b[5] - a[5]; //Tours played
			return 0;
		});
	}

	getTable(room: string, n: number): string | null {
		if (!this.isConfigured(room)) return null;
		const top = this.getTop(room);
		if (!top) return null;
		let table = 'Room: ' + room + '\n\n';
		table += ' N\u00BA | Name | Ranking | W | F | SF | Tours Played | Battles won\n';
		table += '----|------|---------|---|---|----|-------------|-------------\n';
		for (let i = 0; i < n && i < top.length; i++) {
			table +=
				i +
				1 +
				' | ' +
				top[i][0] +
				' | ' +
				top[i][6] +
				' | ' +
				top[i][1] +
				' | ' +
				top[i][2] +
				' | ' +
				top[i][3] +
				' | ' +
				top[i][5] +
				' | ' +
				top[i][4];
			table += '\n';
		}
		return table;
	}

	addUser(room: string, user: string, type: 'A' | 'W' | 'F' | 'S' | 'B', auxData?: number): void {
		if (!this.ladder[room]) this.ladder[room] = {};
		const userid = toId(user);
		if (!this.ladder[room][userid]) this.ladder[room][userid] = [user, 0, 0, 0, 0, 0];
		switch (type) {
			case 'A':
				this.ladder[room][userid][0] = user; //update user name
				this.ladder[room][userid][5]++;
				break;
			case 'W':
				this.ladder[room][userid][1]++;
				break;
			case 'F':
				this.ladder[room][userid][2]++;
				break;
			case 'S':
				this.ladder[room][userid][3]++;
				break;
			case 'B':
				if (!auxData) return;
				this.ladder[room][userid][4] += auxData;
				break;
		}
	}

	writeResults(room: string, results: TournamentResult): void {
		if (!results) return;
		results.players.forEach((player) => this.addUser(room, player, 'A'));
		if (results.winner) this.addUser(room, results.winner, 'W');
		if (results.finalist) this.addUser(room, results.finalist, 'F');
		results.semiFinalists.forEach((semiFinalist) => this.addUser(room, semiFinalist, 'S'));
		Object.entries(results.general).forEach(([user, auxData]) => this.addUser(room, user, 'S', auxData));
	}

	onTournamentEnd(room: string, data: TourData): void {
		if (!this.isConfigured(room)) return;
		if (!data.isOfficialTour) {
			//debug(JSON.stringify(getConfig(room)));
			if (this.getConfig(room).onlyOfficial) {
				debug('Discarded tour because it is not official. Tier: ' + data.format + ' | Room: ' + room);
				return;
			}
			const filter = this.getConfig(room).tierFilter;
			if (filter && !this.filterTier(data.format, filter)) {
				debug('Discarded tour because of tier filter. Tier: ' + data.format + ' | Room: ' + room);
				return;
			}
		}
		const results = this.parseTournamentResults(data);
		//console.log(JSON.stringify(results));
		if (!results) return;
		debug('Updating leaderboard...');
		this.writeResults(room, results);
		this.save();
		debug('Leaderboard updated. ' + getDateString());
	}

	getResetHashCode(room: string): string | null {
		if (!this.ladder[room]) return null;
		for (const i in this.resetCodes) {
			if (this.resetCodes[i] === room) delete this.resetCodes[i];
		}
		const code = generateRandomNick(10);
		this.resetCodes[code] = room;
		return code;
	}

	execResetHashCode(code: string): string | false {
		const room = this.resetCodes[code];
		if (room) {
			if (this.ladder[room]) {
				delete this.ladder[room];
				this.save();
			}
			delete this.resetCodes[code];
			return room;
		}
		return false;
	}
}
