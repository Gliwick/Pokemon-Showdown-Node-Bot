/*
 * Battle data parsing system
 * Battle Bot 2.0
 */

import { createWriteStream, PathLike, writeFileSync, WriteStream } from 'fs';
import { inspect } from 'util';

import { StatsExceptHPTable } from '../../../data/types-dex';
import { colors } from '../../../index';
import { errlog, error } from '../../../log';
import { toId, toName } from '../../../tools';
import { BattleBot } from '.';
import { CurrentGen, getAbility, getItem, getPokemon, Player, Pokemon, PokemonDetails, Type } from './battle-data';
import { majors } from './battle-majors';
import { Minor, minors } from './battle-minors';
import { Pokemon as CalcPokemon } from './calc';
import { Decision, getDecisions, MoveDecision } from './decision';
import { ActiveBattle } from './modules';

const MAX_RECURSIVE = 5;
const MIN_TIME_LOCK = 3 * 1000; // 3 secods to avoid send spam

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
	ident: `${keyof Battle['players']}: ${string}`;
	details: string;
	condition: string;
	active: boolean;
	stats: StatsExceptHPTable;
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
	wait?: boolean;
	forceSwitch?: boolean[];
	side: RequestSide;
	rqid: number;
}

interface Status {
	hp: number;
	status?: string;
}

interface Ident {
	side: string;
	slot: number;
	name: string;
}

const SLOTS: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5 };

export class Battle {
	bot: BattleBot;

	id: string;
	title: number | null = null;
	players = {
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

	constructor(bot: BattleBot, id: string) {
		this.bot = bot;
		this.id = id;
	}

	createLogStream(file: PathLike): void {
		writeFileSync(file, ''); // Clear File
		this.stream = createWriteStream(file, { flags: 'a+' });
		this.file = file;
	}

	send(data: string | string[]): void {
		Bot.sendRoom(this.id, data, 2000);
	}

	sendDecision(decision: Decision[]): void {
		if (!decision?.length) return;

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { moveData, ...toLog } = decision[0] as MoveDecision;
		this.debug(colors.cyan('Send Decision: ') + JSON.stringify(toLog));
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

	checkTimer(): void {
		if (!this.self || !this.request) return; // Not playing
		if (!this.timer) {
			if (this.sentTimerReq && Date.now() - this.sentTimerReq < MIN_TIME_LOCK) return; // Do not spam timer commands
			this.sentTimerReq = Date.now();
			if (!this.tier.endsWith('survival')) this.send('/timer on');
		}
	}

	leave(): void {
		if (!this.leaveInterval) {
			this.leaveInterval = setInterval(((): void => this.send('/leave')).bind(this), 5000);
		}
		this.send('/leave');
	}

	start(): void {
		if (!this.self || !this.request) return; // Not playing
		const wmsg = Config.initBattleMsg;
		if (wmsg?.length) {
			let msg = wmsg[Math.floor(Math.random() * wmsg.length)];
			msg = msg.replace(/#date/g, new Date().toString().split(' GMT')[0]);
			msg = msg.replace(/#battleid/g, 'battle-' + this.id.split('-')[2]);
			this.send(msg);
		}
	}

	win(winner: string): void {
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

	message(type: string, player?: string, poke?: string): void {
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

	makeDecision(forced?: boolean): void {
		if (!this.self) return; // Not playing
		this.debug(this.id + '->MakeDecision');
		if (!forced && this.lastSent.rqid >= 0 && this.lastSent.rqid === this.rqid) {
			if (Date.now() - this.lastSent.time < MIN_TIME_LOCK) return;
			if (this.lastSent.decision) {
				this.sendDecision(this.lastSent.decision);
				return;
			}
		}
		if (this.lock) return;
		this.lock = true;
		this.debug('Making decisions - ' + this.id);
		let decisions;
		try {
			decisions = getDecisions(this);
		} catch (e: any) {
			errlog(e.stack);
			error('Decision maker crashed: ' + inspect(e));
			SecurityLog.log('BATTLE D.M. CRASH: ' + e.message + '\n' + e.stack);
			this.lock = false;
			return;
		}
		if (!decisions || !decisions.length) {
			this.debug('Nothing to do: ' + this.id);
			this.lock = false;
			return;
		}
		let mod;
		try {
			mod = this.bot.moduleManager.choose(this);
			if (mod) {
				const decision = mod.decide(this as ActiveBattle, decisions);
				if (decision) {
					this.lock = false;
					this.sendDecision(decision);
					return;
				}
			}
		} catch (e2: any) {
			errlog(e2.message);
			errlog(e2.stack);
			error('Module failed: ' + mod?.name + ' | ' + inspect(e2));
			SecurityLog.log('BATTLE MODULE FAILED: ' + e2.message + '\nmodule: ' + mod?.name + '\n' + e2.stack);
		}
		this.lock = false;
		this.sendDecision(decisions[Math.floor(Math.random() * decisions.length)]);
	}

	log(line: string): void {
		try {
			if (this.stream) this.stream.write(line + '\n');
		} catch (e: any) {
			errlog(e.message);
			errlog(e.stack);
		}
	}

	debug(line: string): void {
		if (Config.debug.battle) this.log(line);
	}

	add(line: string, isIntro?: boolean): void {
		this.log(line);
		this.run(line, isIntro);
	}

	run(str?: string, isIntro?: boolean): void {
		if (!str) return;
		if (!str.startsWith('|') || str.startsWith('||')) {
			return;
		} else {
			let args = ['done'];
			const kwargs: Record<string, string> = {};
			if (str !== '|') {
				args = str.substring(1).split('|');
			}
			while (args.length > 0 && args[args.length - 1].startsWith('[')) {
				const argstr = args.pop() as string;
				const [key, value] = argstr.substring(1).split(']', 2);
				if (!value) break;
				// default to '.' so it evaluates to boolean true
				kwargs[key] = value.trim() || '.';
			}
			const event = args[0];
			if (event.startsWith('-')) {
				this.runMinor(event as Minor, args, kwargs, isIntro);
			} else {
				this.runMajor(args, kwargs, isIntro);
			}
		}
	}

	runMinor(event: Minor, args: string[], kwargs: Record<string, string>, isIntro?: boolean): void {
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

	runMajor(args: string[], kwargs: Record<string, string>, isIntro?: boolean): void {
		if (majors[args[0]]) {
			let major = majors[args[0]];
			const r = 0;
			while (typeof major === 'string' && r <= MAX_RECURSIVE) {
				major = majors[major];
			}
			if (typeof major !== 'function') {
				error('Unknown major type: ' + args[0] + ' - ' + inspect(major) + '');
			} else {
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
		const details = str.split(',').map((d) => d.trim());
		const poke: PokemonDetails = {
			species: '',
			level: 100,
			shiny: false,
			gender: '',
			terastallize: null,
		};
		if (details[0]) {
			poke.species = details[0];
		}
		if (details[1]) {
			poke.level = parseInt(details[1].substring(1), 10) || 100;
		}
		details.slice(2).forEach((d) => {
			if (d === 'shiny') {
				poke.shiny = true;
			}
			if (d === 'M' || d === 'F' || d === 'N') {
				poke.gender = d;
			}
			if (d.startsWith('tera:')) {
				poke.terastallize = d.substring('tera:'.length) as Type;
			}
		});
		return poke;
	}

	parseSlot(id: string): number {
		return SLOTS[id] || 0;
	}

	parseStatus(str: string): Status {
		const status: Status = { hp: 100 };
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

	parseHealth(str: string): number {
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

	getSide(str?: string): Player | null {
		if (!str) return null;
		str = str.split(':')[0];
		if (!(str in this.players)) {
			error('Unknown side: ' + str);
			return null;
		}
		return this.players[str as keyof Battle['players']];
	}

	getActive(str?: string): Pokemon | null {
		if (!str) return null;
		const side = str.substring(0, 2);
		str = str.substring(side.length);
		const pokeId = str.substring(0, 1);
		const slot = this.parseSlot(pokeId);
		str = str.substring(pokeId.length);
		const name = toName(str.substring(1));
		if (!(side in this.players)) {
			error('Unknown side: ' + side);
			return null;
		}
		const player = this.players[side as keyof Battle['players']];
		const active = player.active?.[slot];
		if (active) {
			active.name = name;
			return active;
		}
		return null;
	}

	parsePokemonIdent(str?: string): Ident | null {
		if (!str) return null;
		const side = str.substring(0, 2);
		str = str.substring(side.length);
		const pokeId = str.substring(0, 1);
		const slot = this.parseSlot(pokeId);
		str = str.substring(pokeId.length);
		const name = toName(str.substring(1));
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

		const side: keyof Battle['helpers'] = toId(this.request.side.name) === toId(Bot.status.nickName) ? 'self' : 'foe';
		const pokeId = p.ident.split(': ')[1] + '|' + details.species;

		const item = p.item ? getItem(p.item, this.gen) : null;
		const species = (forceMega && this.request.active?.[0]?.canMegaEvo && item?.megaStone) || details.species;
		const template = getPokemon(species, this.gen, this.id);
		const poke = new CalcPokemon(
			template,
			{
				helpers: this.helpers[side][pokeId],
				...details,
				item,
				ability: getAbility(p.baseAbility || template.abilities[0], this.gen),
				...condition,
				stats: p.stats,
			},
			this as ActiveBattle
		);
		return poke;
	}

	destroy(): void {
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
