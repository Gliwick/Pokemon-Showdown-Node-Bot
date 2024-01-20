/*
 * Decision maker
 */

import { MoveData } from '../../../data/types-moves';
import { Battle, RequestMove } from './battle';
import { TeraType, WithID } from './battle-data';

type DecisionType = 'move' | 'switch' | 'team' | 'pass' | 'shift';

export abstract class Decision {
	type: DecisionType;

	constructor(type: DecisionType) {
		this.type = type;
	}

	getDecisionStr(battle?: Battle): string {
		const argsStr = this.getArgsStr(battle);
		return this.type + (argsStr ? ' ' + argsStr : '');
	}

	protected abstract getArgsStr(battle?: Battle): string;
}

export type Transformation = { terastallize: TeraType } | string;

export class MoveDecision extends Decision {
	moveId: number;
	target: number | null;
	move: string;
	movePP: number;
	transformation: Transformation | null = null;
	moveData: WithID<MoveData> | null = null;

	constructor(moveId: number, target: number | null, transformation: Transformation | null, move: string, movePP: number) {
		super('move');
		this.moveId = moveId || 0;
		this.target = target;
		this.move = move || 'struggle';
		this.movePP = movePP || 1;
		this.transformation = transformation;
	}

	protected getArgsStr(): string {
		let str = (this.moveId + 1).toString();
		if (typeof this.transformation === 'string') {
			str += ' ' + this.transformation;
		} else if (this.transformation) {
			str += ' ' + Object.keys(this.transformation)[0];
		}
		if (this.target !== null) {
			if (this.target >= 0) str += ' ' + (this.target + 1);
			else str += ' ' + this.target;
		}
		return str;
	}
}

export class SwitchDecision extends Decision {
	poke: string;
	pokeId: number;

	constructor(pokeId: number, poke: string) {
		super('switch');
		this.poke = poke || 'pikachu';
		this.pokeId = pokeId || 0;
	}

	protected getArgsStr(): string {
		return (this.pokeId + 1).toString();
	}
}

export class TeamDecision extends Decision {
	team: number[];

	constructor(team?: number[]) {
		super('team');
		this.team = team || [0, 1, 2, 3, 4, 5];
	}

	protected getArgsStr(battle?: Battle): string {
		const team = this.team.map((n) => n + 1);
		const first = team[0] || 1;
		for (let j = first - 1; j > 0; j--) {
			if (!team.includes(j)) {
				team.push(j);
			}
		}
		if (battle?.request?.side?.pokemon) {
			for (let j = 1; j <= battle.request.side.pokemon.length; j++) {
				if (!team.includes(j)) {
					team.push(j);
				}
			}
		}
		return team.join('');
	}
}

export class PassDecision extends Decision {
	constructor() {
		super('pass');
	}

	protected getArgsStr(): string {
		return '';
	}
}

export class ShiftDecision extends Decision {
	constructor() {
		super('shift');
	}

	protected getArgsStr(): string {
		return '';
	}
}

function isTooFar(battle: Battle, a: number, b: number): boolean {
	if (battle.gametype === 'triples') {
		return (a === 0 && b === 0) || (a === 2 && b === 2);
	} else {
		return false;
	}
}

function combinateTeamPreview(array: number[], i: number, values: number[], solutions: number[][]): void {
	if (i >= array.length) {
		solutions.push([...array]);
		return;
	}
	for (let j = 0; j < values.length; j++) {
		if (array.includes(values[j])) continue; //Repeated
		array[i] = values[j];
		combinateTeamPreview(array, i + 1, values, solutions);
		array[i] = -1;
	}
}

function generateTeamCombinations(sideLength: number, requiredLength: number): number[][] {
	const comb: number[][] = [];
	const values: number[] = [];
	const array: number[] = [];
	for (let i = 0; i < sideLength; i++) {
		values.push(i);
	}
	for (let i = 0; i < requiredLength; i++) {
		array.push(-1);
	}
	combinateTeamPreview(array, 0, values, comb);
	return comb;
}

function validateDecision(des: Decision[]): boolean {
	let transformed = false;
	let shiftConsumed = false;
	let passed = true;
	const switched: number[] = [];
	for (let i = 0; i < des.length; i++) {
		if ((des[i] as MoveDecision).transformation) {
			if (transformed) return false; // 2 mega evolutions at the same time
			transformed = true;
		}
		if (des[i].type === 'switch') {
			const pokeId = (des[i] as SwitchDecision).pokeId;
			if (switched.includes(pokeId)) return false; // Switch to the same pokemon
			switched.push(pokeId);
		} else if (des[i].type === 'shift') {
			if (shiftConsumed) return false; // 2 shifts at the same time
			shiftConsumed = true;
		}
		if (des[i].type !== 'pass') passed = false;
	}
	if (passed) return false; // You can't pass the turn
	return true;
}

function cartesianProduct(tables: Decision[][]): Decision[][] {
	return tables
		.reduce((a, b) => a.flatMap((d) => b.map((e) => [...d, e])), [[]] as Decision[][])
		.filter((decisions) => validateDecision(decisions));
}

function getTargets(battle: Battle, activeIndex: number, move: RequestMove): (number | null)[] {
	if (!battle.request || !battle.self || !battle.foe) throw new Error('Request not received yet');
	const targets: (number | null)[] = [];
	if (['any', 'normal', 'adjacentAlly', 'adjacentAllyOrSelf', 'adjacentFoe'].includes(move.target)) {
		if (!move.target.startsWith('adjacentAlly')) {
			let auxHasTarget = false;
			for (let tar = 0; tar < battle.foe.active.length; tar++) {
				if (!battle.foe.active[tar] || battle.foe.active[tar]?.fainted) continue; // Target not found
				if (move.target !== 'any' && isTooFar(battle, tar, activeIndex)) continue; // Target too far
				auxHasTarget = true;
			}
			for (let tar = 0; tar < battle.foe.active.length; tar++) {
				if (auxHasTarget && (!battle.foe.active[tar] || battle.foe.active[tar]?.fainted)) continue; // Target not found
				if (move.target !== 'any' && isTooFar(battle, tar, activeIndex)) continue; // Target too far
				targets.push(tar);
			}
		}
		if (move.target !== 'adjacentFoe') {
			for (let tar = 0; tar < battle.self.active.length; tar++) {
				if (move.target !== 'adjacentAllyOrSelf' && tar === activeIndex) continue; // Not self target allowed
				if (!battle.self.active[tar] || battle.self.active[tar]?.fainted) continue; // Target not found
				if (move.target !== 'any' && isTooFar(battle, tar, activeIndex)) continue; // Target too far
				targets.push(-1 * (tar + 1));
			}
		}
	} else {
		// No need to set the target
		targets.push(null);
	}
	return targets;
}

export function getDecisions(battle: Battle): Decision[][] | null {
	const req = battle.request;
	if (!req) return null;
	if (req.wait) return null; // Nothing to do
	if (req.teamPreview) {
		const res: Decision[][] = [];
		/* Team required */
		let n = 1;
		if (battle.gametype === 'doubles') n = 2;
		else if (battle.gametype === 'triples') n = 3;
		const comb = generateTeamCombinations(req.side.pokemon.length, n);
		for (let i = 0; i < comb.length; i++) {
			res.push([new TeamDecision(comb[i])]);
		}
		return res;
	}

	if (req.forceSwitch) {
		const fw = req.forceSwitch;
		const tables: Decision[][] = [];
		let canSw;
		const toSw = fw.filter((i) => i).length;
		for (let i = 0; i < fw.length; i++) {
			tables.push([]);
			if (!fw[i]) {
				tables[i].push(new PassDecision());
			} else {
				canSw = 0;
				for (let k = 0; k < req.side.pokemon.length; k++) {
					if (battle.parseStatus(req.side.pokemon[k].condition).status === 'fnt') continue; // Fainted
					if (req.side.pokemon[k].active) continue; // Active
					canSw++;
					tables[i].push(new SwitchDecision(k, req.side.pokemon[k].ident));
				}
				if (canSw < toSw) {
					tables[i].push(new PassDecision());
				}
			}
		}
		return cartesianProduct(tables);
	}

	if (req.active) {
		const tables: Decision[][] = [];
		for (let i = 0; i < req.active.length; i++) {
			tables.push([]);
			if (req.side.pokemon[i].condition === '0 fnt') {
				//fainted, pass
				tables[i].push(new PassDecision());
				continue;
			}
			const active = req.active[i];

			// moves
			const dynamaxActive = battle.self && !!battle.self.active[0]?.volatiles?.dynamax;
			if (!dynamaxActive) {
				for (let j = 0; j < active.moves.length; j++) {
					const move = active.moves[j];
					if (move.disabled || move.pp === 0) continue; // No more moves

					let mega = false;
					if (active.canMegaEvo) mega = true;

					const targets = getTargets(battle, i, move);
					for (const target of targets) {
						tables[i].push(new MoveDecision(j, target, null, move.move, move.pp));
						if (mega) tables[i].push(new MoveDecision(j, target, 'mega', move.move, move.pp));
						if (active.canTerastallize)
							tables[i].push(
								new MoveDecision(j, target, { terastallize: active.canTerastallize as TeraType }, move.move, move.pp)
							);
					}

					if (active.canZMove && active.canZMove[j]) {
						const zMove = active.canZMove[j];
						const zTargets = getTargets(battle, i, zMove);
						for (const target of zTargets) {
							tables[i].push(new MoveDecision(j, target, 'zmove', zMove.move, move.pp));
						}
					}
				}
			}

			// dynamax
			if ((active.canDynamax || dynamaxActive) && active.maxMoves) {
				for (let j = 0; j < active.maxMoves.maxMoves.length; j++) {
					const baseMove = active.moves[j];
					const maxMove = active.maxMoves.maxMoves[j];
					if (baseMove.disabled || baseMove.pp === 0) continue; // No more moves

					const targets = getTargets(battle, i, maxMove);
					for (const target of targets) {
						tables[i].push(new MoveDecision(j, target, active.canDynamax ? 'dynamax' : null, maxMove.move, baseMove.pp));
					}
				}
			}

			// switches
			if (!active.trapped) {
				for (let k = 0; k < req.side.pokemon.length; k++) {
					if (req.side.pokemon[k].condition === '0 fnt') continue; // Fainted
					if (req.side.pokemon[k].active) continue; // Active
					tables[i].push(new SwitchDecision(k, req.side.pokemon[k].ident));
				}
			}

			// shifts
			if (req.active.length === 3) {
				if (i === 0 || i === 2) tables[i].push(new ShiftDecision());
			}
		}
		return cartesianProduct(tables);
	}

	return [];
}
