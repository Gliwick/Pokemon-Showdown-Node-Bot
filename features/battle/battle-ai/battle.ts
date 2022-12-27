/*
 * Battle data parsing system
 * Battle Bot 2.0
 */

import { createWriteStream, PathLike, writeFileSync, WriteStream } from 'fs';
import { inspect } from 'util';

import { debug, errlog, error } from '../../../log';
import { toId } from '../../../tools';

const MAX_RECURSIVE = 5;
const MIN_TIME_LOCK = 3 * 1000; // 3 secods to avoid send spam

import {
	CurrentGen,
	getAbility,
	getItem,
	getPokemon,
	Player,
	Pokemon,
	PokemonDetails,
	StatsTable,
	Type,
} from './battle-data';
import { majors } from './battle-majors';
import { Minor, minors } from './battle-minors';
import { Pokemon as CalcPokemon } from './calc';
import { Decision, getDecisions, MoveDecision } from './decision';
import { choose } from './modules';

export type PlayerId = 'p1' | 'p2';
export type BattleType = 'singles' | 'doubles' | 'triples' | 'rotation';
export const BattleTypeActiveSlots: Record<BattleType, number> = {
	singles: 1,
	doubles: 2,
	triples: 3,
	rotation: 3,
};

export interface RequestMove {
	move: string;
	target: string;
}

export interface RequestActiveMove extends RequestMove {
	id: string;
	pp: number;
	maxpp: number;
	disabled: boolean;
}

interface RequestActivePokemon {
	moves: RequestActiveMove[];
	trapped?: boolean;
	canMegaEvo?: boolean;
	canZMove?: RequestMove[];
	canDynamax?: boolean;
	maxMoves?: {
		maxMoves: RequestMove[];
	};
	canTerastallize?: Type;
}

interface RequestPokemon {
	ident: `${PlayerId}: ${string}`;
	details: string;
	condition: string;
	active: boolean;
	stats: Omit<Required<StatsTable>, 'hp'>;
	moves: string[];
	baseAbility: string;
	item: string;
	commanding: boolean;
	reviving: boolean;
	pokeball: string;
	ability: string;
}

interface RequestSide {
	name: string;
	id: string;
	pokemon: RequestPokemon[];
}

export interface Request {
	teamPreview?: boolean;
	active?: RequestActivePokemon[];
	forceSwitch?: boolean[];
	side: RequestSide;
	rqid: number;
}

interface Status {
	hp: number;
	status: string | null;
}

interface Ident {
	side: string;
	slot: number;
	name: string;
}

export class Battle {
	id: string;
	title: number | null = null;
	players: Record<PlayerId, Player> = {
		p1: new Player('p1'),
		p2: new Player('p2'),
	};
	users: Record<string, any> = {};

	self: Player | null = null;
	foe: Player | null = null;

	gametype: BattleType = 'singles';
	gen: number = CurrentGen;
	tier = 'gen9ou';
	rules: string[] = [];
	variations: string[] = [];

	started = false;
	timer = false;
	sentTimerReq = 0;
	turn = 0;
	request: Request | null = null;
	rqid = 0;
	teamPreview = 1;

	conditions: Record<string, any> = {};

	file: PathLike | null = null;
	stream: WriteStream | null = null;
	lastSent: { rqid: number; time: number; decision: Decision[] | null } = {
		rqid: -1,
		time: 0,
		decision: null,
	};
	lock = false;
	leaveInterval: NodeJS.Timeout | null = null;

	helpers: { self: Record<string, any>; foe: Record<string, any> } = {
		self: {},
		foe: {},
	};

	rated = false;
	ended = false;

	constructor(id: string) {
		this.id = id;
	}

	createLogStream(file: PathLike) {
		writeFileSync(file, ''); // Clear File
		this.stream = createWriteStream(file, { flags: 'a+' });
		this.file = file;
	}

	send(data: string | string[]) {
		Bot.sendRoom(this.id, data, 2000);
	}

	eval(str: string) {
		return eval(str);
	}

	sendDecision(decision: Decision[]) {
		if (!decision?.length) return;

		const { moveData, ...toLog } = decision[0] as MoveDecision;
		debug('Send Decision: '.cyan + JSON.stringify(toLog));
		let str = '/choose ';
		for (let i = 0; i < decision.length; i++) {
			str += decision[i].getDecisionStr();
			if (i < decision.length - 1) str += ', ';
		}
		this.lastSent = {
			rqid: this.rqid,
			time: Date.now(),
			decision: decision,
		};
		this.send(str + '|' + this.rqid);
	}

	checkTimer() {
		if (!this.self || !this.request) return; // Not playing
		if (!this.timer) {
			if (this.sentTimerReq && Date.now() - this.sentTimerReq < MIN_TIME_LOCK) return; // Do not spam timer commands
			this.sentTimerReq = Date.now();
			if (!this.tier.endsWith('survival')) this.send('/timer on');
		}
	}

	leave() {
		if (!this.leaveInterval) {
			this.leaveInterval = setInterval(
				(() => {
					this.send('/leave');
				}).bind(this),
				5000
			);
		}
		this.send('/leave');
	}

	start() {
		if (!this.self || !this.request) return; // Not playing
		const wmsg = Config.initBattleMsg;
		if (wmsg?.length) {
			let msg = wmsg[Math.floor(Math.random() * wmsg.length)];
			msg = msg.replace(/#date/g, new Date().toString().split(' GMT')[0]);
			msg = msg.replace(/#battleid/g, 'battle-' + this.id.split('-')[2]);
			this.send(msg);
		}
	}

	win(winner: string) {
		if (!this.self) return; // Not playing
		const win = toId(winner) === toId(Bot.status.nickName);
		if (win) {
			const winmsg = Config.winmsg;
			if (winmsg?.length) {
				let msg = winmsg[Math.floor(Math.random() * winmsg.length)];
				msg = msg.replace(/#date/g, new Date().toString().split(' GMT')[0]);
				msg = msg.replace(/#battleid/g, 'battle-' + this.id.split('-')[2]);
				this.send(msg);
			}
		} else {
			const losemsg = Config.losemsg;
			if (losemsg?.length) {
				let msg = losemsg[Math.floor(Math.random() * losemsg.length)];
				msg = msg.replace(/#date/g, new Date().toString().split(' GMT')[0]);
				msg = msg.replace(/#battleid/g, 'battle-' + this.id.split('-')[2]);
				this.send(msg);
			}
		}
	}

	message(type: string, player?: string, poke?: string) {
		if (!this.self) return; // Not playing
		if (!Config.battleMessages || !Config.battleMessages[type]) return;
		const messages = Config.battleMessages[type];

		if (!player) {
			const messagesArray = Array.isArray(messages) ? messages : messages?.self;
			if (messagesArray) {
				this.send(messagesArray[Math.floor(Math.random() * messagesArray.length)]);
			}
			return;
		}

		const side = player === this.self.id ? 'self' : 'foe';
		const sideMessages = !Array.isArray(messages) && messages[side];
		if (sideMessages) {
			if (type === 'faint') {
				const lost = this.self.pokemon.every((p) => p.fainted);
				if (lost) return;
			}
			let msg = sideMessages[Math.floor(Math.random() * sideMessages.length)];
			if (poke) msg = msg.replace(/#poke/g, poke);
			this.send(msg);
		}
	}

	makeDecision(forced?: boolean) {
		if (!this.self) return; // Not playing
		debug(this.id + '->MakeDecision');
		if (!forced && this.lastSent.rqid >= 0 && this.lastSent.rqid === this.rqid) {
			if (Date.now() - this.lastSent.time < MIN_TIME_LOCK) return;
			if (this.lastSent.decision) {
				this.sendDecision(this.lastSent.decision);
				return;
			}
		}
		if (this.lock) return;
		this.lock = true;
		debug('Making decisions - ' + this.id);
		let decisions, mod;
		try {
			decisions = getDecisions(this);
		} catch (e: any) {
			debug(e.stack);
			debug('Decision maker crashed: ' + inspect(e));
			SecurityLog.log('BATTLE D.M. CRASH: ' + e.message + '\n' + e.stack);
			this.lock = false;
			return;
		}
		if (!decisions || !decisions.length) {
			debug('Nothing to do: ' + this.id);
			this.lock = false;
			return;
		}
		try {
			mod = choose(this);
			if (mod) {
				const decision = mod.decide(this, decisions);
				if (decision instanceof Array) {
					this.lock = false;
					this.sendDecision(decision);
					return;
				}
			}
		} catch (e2: any) {
			errlog(e2.message);
			errlog(e2.stack);
			error('Module failed: ' + mod?.id + ' | ' + inspect(e2));
			SecurityLog.log('BATTLE MODULE FAILED: ' + e2.message + '\nmodule: ' + mod?.id + '\n' + e2.stack);
		}
		this.lock = false;
		this.sendDecision(decisions[Math.floor(Math.random() * decisions.length)]);
	}

	log(line?: string) {
		if (this.stream) {
			this.stream.write(line + '\n');
		}
	}

	add(line?: string, isIntro?: boolean) {
		this.run(line, isIntro);
		this.log(line);
	}

	run(str?: string, isIntro?: boolean) {
		if (!str) return;
		if (str.charAt(0) !== '|' || str.substr(0, 2) === '||') {
			return;
		} else {
			let args = ['done'];
			const kwargs: Record<string, string> = {};
			if (str !== '|') {
				args = str.substr(1).split('|');
			}
			while (args.length > 0 && args[args.length - 1].startsWith('[')) {
				const bracketPos = args[args.length - 1].indexOf(']');
				if (bracketPos <= 0) break;
				const argstr = args.pop() as string;
				// default to '.' so it evaluates to boolean true
				kwargs[argstr.substr(1, bracketPos - 1)] = argstr.substr(bracketPos + 1).trim() || '.';
			}
			const event = args[0];
			if (event.startsWith('-')) {
				this.runMinor(event as Minor, args, kwargs, isIntro);
			} else {
				this.runMajor(args, kwargs, isIntro);
			}
		}
	}

	runMinor(event: Minor, args: string[], kwargs: Record<string, string>, isIntro?: boolean) {
		if (args) {
			if (args[2] === 'Sturdy' && args[0] === '-activate') args[2] = 'ability: Sturdy';
		}
		if (minors[event]) {
			let minor = minors[event];
			const r = 0;
			while (typeof minor === 'string' && r <= MAX_RECURSIVE) {
				minor = minors[minor];
			}
			if (typeof minor !== 'function') {
				error('Unknown minor type: ' + args[0] + ' - ' + inspect(minor) + '');
			} else {
				debug('running minor ' + args[0] + '([' + args + '], ' + JSON.stringify(kwargs) + ')');
				try {
					minor.call(this, args, kwargs, isIntro);
				} catch (e: any) {
					errlog(e.message);
					errlog(e.stack);
					error('Minor failed | Battle id: ' + this.id + ' | Minor: ' + args[0]);
					SecurityLog.log(
						'MINOR FAILED: ' +
							e.message +
							'\nargs: ' +
							args.join('|') +
							'\nkwargs: ' +
							JSON.stringify(kwargs) +
							'\nroom: ' +
							this.id +
							'\n' +
							e.stack
					);
				}
			}
		}
	}

	runMajor(args: string[], kwargs: Record<string, string>, isIntro?: boolean) {
		if (majors[args[0]]) {
			let major = majors[args[0]];
			const r = 0;
			while (typeof major === 'string' && r <= MAX_RECURSIVE) {
				major = majors[major];
			}
			if (typeof major !== 'function') {
				error('Unknown major type: ' + args[0] + ' - ' + inspect(major) + '');
			} else {
				debug('running major ' + args[0] + '([' + args + '], ' + JSON.stringify(kwargs) + ')');
				try {
					major.call(this, args, kwargs, isIntro);
				} catch (e: any) {
					errlog(e.message);
					errlog(e.stack);
					error('Major failed | Battle id: ' + this.id + ' | Major: ' + args[0]);
					SecurityLog.log(
						'MAJOR FAILED: ' +
							e.message +
							'\nargs: ' +
							args.join('|') +
							'\nkwargs: ' +
							JSON.stringify(kwargs) +
							'\nroom: ' +
							this.id +
							'\n' +
							e.stack
					);
				}
			}
		}
	}

	parseDetails(str?: string): PokemonDetails | null {
		if (!str) return null;
		const details = str.split(',');
		for (let d = 0; d < details.length; d++) {
			details[d] = details[d].trim();
		}
		const poke: PokemonDetails = {
			species: '',
			level: 100,
			shiny: false,
			gender: null,
		};
		if (details[details.length - 1] === 'shiny') {
			poke.shiny = true;
			details.pop();
		}
		const gender = details[details.length - 1];
		if (gender === 'M' || gender === 'F') {
			poke.gender = gender;
			details.pop();
		}
		if (details[1]) {
			poke.level = parseInt(details[1].substr(1), 10) || 100;
		}
		if (details[0]) {
			poke.species = details[0];
		}
		return poke;
	}

	parseSlot(id: string): number {
		const slots: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5 };
		return slots[id] || 0;
	}

	parseStatus(str: string): Status {
		const status: Status = {
			hp: 100,
			status: null,
		};
		let sp = str.split(' ');
		if (sp[1]) status.status = toId(sp[1]);
		sp = sp[0].split('/');
		if (sp.length === 2) {
			const d = parseInt(sp[1]);
			if (d) {
				status.hp = (parseInt(sp[0]) * 100) / d;
			}
		} else {
			status.hp = parseInt(sp[0]) || 0;
		}
		return status;
	}

	parseHealth(str: string) {
		let hp = 100;
		let sp = str.split(' ');
		sp = sp[0].split('/');
		if (sp.length === 2) {
			const d = parseInt(sp[1]);
			if (d) {
				hp = (parseInt(sp[0]) * 100) / d;
			}
		} else {
			hp = parseInt(sp[0]) || 0;
		}
		return hp;
	}

	getSide(str?: string) {
		if (!str) return null;
		str = str.split(':')[0];
		if (!(str in this.players)) {
			error('Unknown side: ' + str);
			return;
		}
		return this.players[str as PlayerId];
	}

	getActive(str?: string): Pokemon | null {
		if (!str) return null;
		const side = str.substr(0, 2);
		str = str.substr(2);
		const pokeId = str.substr(0, 1);
		const slot = this.parseSlot(pokeId);
		str = str.substr(1);
		const name = Tools.toName(str.substr(1));
		if (!(side in this.players)) {
			error('Unknown side: ' + side);
			return null;
		}
		const player = this.players[side as PlayerId];
		const active = player.active?.[slot];
		if (active) {
			active.name = name;
			return active;
		}
		return null;
	}

	parsePokemonIdent(str?: string): Ident | null {
		if (!str) return null;
		const side = str.substr(0, 2);
		str = str.substr(2);
		const pokeId = str.substr(0, 1);
		const slot = this.parseSlot(pokeId);
		str = str.substr(1);
		const name = Tools.toName(str.substr(1));
		return {
			side: side,
			slot: slot,
			name: name,
		};
	}

	parseRequestPokemon(sideId: number, forceMega?: boolean): CalcPokemon {
		if (!this.request) throw new Error('Request not received yet');

		const p = this.request.side.pokemon[sideId];
		const details = this.parseDetails(p.details);
		const condition = this.parseStatus(p.condition);
		const ident = this.parsePokemonIdent(p.ident);

		if (!details || !ident) throw new Error('Request pokemon has no details or ident: ' + JSON.stringify(p));

		const side: keyof Battle['helpers'] =
			toId(this.request.side.name) === toId(Bot.status.nickName) ? 'self' : 'foe';
		const pokeId = p.ident.split(': ')[1] + '|' + details.species;

		const poke = new CalcPokemon(
			getPokemon(details.species, this.gen, this.id),
			{
				level: details.level,
				shiny: details.shiny,
				gender: details.gender,
				helpers: this.helpers[side][pokeId] || {},
			},
			this
		);
		poke.item = getItem(p.item, this.gen);
		poke.ability = getAbility(p.baseAbility, this.gen);
		poke.status = condition.status;
		poke.hp = condition.hp;
		poke.stats = p.stats;
		const battlePokemon = this[side]?.pokemon?.filter?.((playerPokemon) => playerPokemon.name === ident.name);
		if (battlePokemon?.length) {
			poke.terastallize = battlePokemon[0].terastallize;
		}
		if (forceMega && this.request.active?.[0]?.canMegaEvo) {
			if (poke.item.megaStone) {
				poke.template = getPokemon(poke.item.megaStone, this.gen, this.id);
				poke.species = poke.template.species;
				poke.ability = getAbility(poke.template.abilities[0]);
			}
		}
		return poke;
	}

	destroy() {
		if (this.stream) {
			this.stream.close();
			this.stream = null;
		}
		if (this.leaveInterval) {
			clearInterval(this.leaveInterval);
			this.leaveInterval = null;
		}
	}
}
