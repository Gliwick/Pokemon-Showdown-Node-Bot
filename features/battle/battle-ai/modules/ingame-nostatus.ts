/*
 * Ingame (No Status)
 *
 * Simple algorithm, just choose the move that causes more damage
 * No switchs, No status moves
 *
 * Recommended: 1v1, Challenge Cup 1v1
 *
 * System:
 *
 *  - Priority 100000 - Moves that causes > 0
 *	- Priority 1000 - Status moves
 *  - Priority 0 - Team
 *  - Priority -1000 - Switch / Shift / Pass
 *	- Priority -100000 - Moves 0 damage
 */

import { toId } from '../../../../tools';
import { Battle } from '../battle';
import { Decision, MoveDecision, SwitchDecision, TeamDecision } from '../decision';
import { BattleModule } from '../modules';
import { getAbility, getMove, getPokemon } from './../battle-data';
import { calculate, Conditions, Pokemon } from './../calc';

/*
 * Bad moves for 1v1
 */
const BadMoves = ['dreameater', 'focuspunch', 'explosion', 'lastresort', 'mistyexplosion', 'selfdestruct', 'shelltrap', 'snore'];

/*
 * Moves which require 2 turs without any protection
 */
const DoubleTurnMoves = ['iceburn', 'freezeshock', 'meteorbeam', 'razorwind', 'skullbash', 'skyattack', 'solarbeam', 'solarblade'];

/*
 * Team and Switch Decisions
 */

export class IngameNoStatus implements BattleModule {
	static readonly ID = 'ingame-nostatus';
	readonly name = 'ingame-nostatus';

	getPokemonAverage(battle: Battle, s: number): number {
		if (!battle.foe.teamPv.length) return 0;

		const p = battle.request.side.pokemon[s];
		const pokeA = battle.parseRequestPokemon(s, true);
		if (toId(battle.tier).includes('challengecup')) pokeA.happiness = 100;

		let final = 0;
		const conditions = new Conditions({});
		for (let i = 0; i < battle.foe.teamPv.length; i++) {
			const pokeView = battle.foe.teamPv[i];
			const template = getPokemon(pokeView.species, battle.gen);
			const poke = new Pokemon(
				template,
				{
					level: pokeView.level,
					gender: pokeView.gender,
					evs: { hp: 192, def: 124, spd: 124 },
				},
				battle
			);
			if (toId(battle.tier).includes('challengecup')) poke.happiness = 100;
			if (template.abilities) poke.ability = getAbility(template.abilities[0], battle.gen);
			let calcVal = 0;
			for (let j = 0; j < p.moves.length; j++) {
				const move = getMove(p.moves[j], battle.gen);
				if (move.category === 'Status') continue;
				if (BadMoves.includes(move.id)) continue;
				const dmg = calculate(
					{ poke: pokeA, conditions: conditions },
					{ poke: poke, conditions: conditions },
					move,
					battle.conditions,
					battle
				);
				battle.debug('DMG [' + pokeA.species + ', ' + poke.species + ', ' + move.name + '] = ' + dmg.getMax());
				if (DoubleTurnMoves.includes(move.id)) calcVal += dmg.getMax() * 0.5;
				else calcVal += dmg.getMax();
			}
			final += calcVal / 4;
		}
		return 0 + final;
	}

	evaluateTeamDecision(battle: Battle, des: TeamDecision): number {
		let final = 0;
		for (let i = 0; i < des.team.length; i++) {
			final += this.getPokemonAverage(battle, des.team[i]);
		}
		return final;
	}

	/*
	 * Switch Decisions
	 */

	getSwitchAverage(battle: Battle, pokeId: number): number {
		let final = 0;
		const p = battle.request.side.pokemon[pokeId];
		const pokeA = battle.parseRequestPokemon(pokeId, true);
		if (toId(battle.tier).includes('challengecup')) pokeA.happiness = 100;
		const conditionsA = new Conditions({
			side: battle.self.side,
			pokemon: battle.self.pokemon,
			volatiles: {},
			boosts: {},
		});
		for (let i = 0; i < p.moves.length; i++) {
			const move = getMove(p.moves[i], battle.gen);
			const targets = battle.foe.active;
			for (let j = 0; j < targets.length; j++) {
				if (!targets[j]) continue;
				const conditionsB = new Conditions({
					side: battle.foe.side,
					pokemon: battle.foe.pokemon,
					volatiles: targets[j].volatiles,
					boosts: targets[j].boosts,
				});
				const pokeB = new Pokemon(
					targets[j].template,
					{
						level: targets[j].level,
						gender: targets[j].gender,
						shiny: targets[j].shiny,
						evs: { hp: 192, def: 124, spd: 124 },
					},
					battle
				);
				pokeB.hp = targets[j].hp;
				pokeB.status = targets[j].status;
				if (targets[j].item === '&unknown') {
					pokeB.item = null;
				} else {
					pokeB.item = targets[j].item;
				}
				if (!targets[j].supressedAbility) {
					if (targets[j].ability === '&unknown') {
						pokeB.ability = pokeB.template.abilities ? pokeB.template.abilities[0] : null;
					} else {
						pokeB.ability = targets[j].ability;
					}
				}
				const dmg = calculate(
					{ poke: pokeA, conditions: conditionsA },
					{ poke: pokeB, conditions: conditionsB },
					move,
					battle.conditions,
					battle
				);
				battle.debug('DMG [' + pokeA.species + ', ' + pokeB.species + ', ' + move.name + '] = ' + dmg.getMax());
				if (DoubleTurnMoves.includes(move.id)) final += dmg.getMax() * 0.5;
				else final += dmg.getMax();
			}
		}
		if (!p.moves.length) return 0;
		return final / p.moves.length;
	}

	evaluateSwitchDecision(battle: Battle, des: SwitchDecision): number {
		let final = -1000;
		final += this.getSwitchAverage(battle, des.pokeId);
		return final;
	}

	/*
	 * Move Decisions
	 */

	evaluateMoveDecision(battle: Battle, desEnv: Decision[], des: MoveDecision, act: number): number {
		let final = 0;
		const p = battle.request.side.pokemon[act];
		const a = battle.request.active[act];
		const move = getMove(p.moves[des.moveId]);

		if (move.category === 'Status') return 0;
		if (BadMoves.includes(move.id)) return 0;
		if (des.target < 0) return 0; // Do not kill your own allies

		if (a.canMegaEvo) {
			if (!des.transformation) return 0; // Mega evolve by default
		}

		const pokeA = battle.parseRequestPokemon(act, true);
		if (toId(battle.tier).includes('challengecup')) pokeA.happiness = 100; // Random
		const conditionsA = new Conditions({
			side: battle.self.side,
			pokemon: battle.self.pokemon,
			volatiles: battle.self.active[act].volatiles,
			boosts: battle.self.active[act].boosts,
		});

		let targets = [];
		if (typeof des.target === 'number') {
			targets = [battle.foe.active[des.target]];
		} else {
			targets = battle.foe.active;
		}

		for (let i = 0; i < targets.length; i++) {
			if (!targets[i]) continue;
			const conditionsB = new Conditions({
				side: battle.foe.side,
				pokemon: battle.foe.pokemon,
				volatiles: targets[i].volatiles,
				boosts: targets[i].boosts,
			});
			const pokeB = new Pokemon(
				targets[i].template,
				{
					level: targets[i].level,
					gender: targets[i].gender,
					shiny: targets[i].shiny,
					evs: { hp: 192, def: 124, spd: 124 },
				},
				battle
			);
			pokeB.hp = targets[i].hp;
			pokeB.status = targets[i].status;
			if (targets[i].item === '&unknown') {
				pokeB.item = null;
			} else {
				pokeB.item = targets[i].item;
			}
			if (!targets[i].supressedAbility) {
				if (targets[i].ability === '&unknown') {
					pokeB.ability = pokeB.template.abilities ? pokeB.template.abilities[0] : null;
				} else {
					pokeB.ability = targets[i].ability;
				}
			}
			const dmg = calculate(
				{ poke: pokeA, conditions: conditionsA },
				{ poke: pokeB, conditions: conditionsB },
				move,
				battle.conditions,
				battle
			);
			battle.debug('DMG [' + pokeA.species + ', ' + pokeB.species + ', ' + move.name + '] = ' + dmg.getMax());
			if (DoubleTurnMoves.includes(move.id)) final += dmg.getMax() * 0.5;
			else final += dmg.getMax();
		}
		if (!final) return -100000; // Inmmune
		return 100000 + final;
	}

	/*
	 * Swapper
	 */

	getDecisionValue(battle: Battle, decisions: Decision[][], desEnv: Decision[], des: Decision, act: number): number {
		if (des.type === 'team') {
			return this.evaluateTeamDecision(battle, des as TeamDecision);
		} else if (des.type === 'move') {
			return this.evaluateMoveDecision(battle, desEnv, des as MoveDecision, act);
		} else if (des.type === 'switch') {
			return this.evaluateSwitchDecision(battle, des as SwitchDecision);
		} else {
			return -1000; // Pass, Shift
		}
	}

	decide(battle: Battle, decisions: Decision[][]): Decision[] {
		const dTable: { des: number; val: number }[] = [];
		let p = 0,
			maxP: number | null = null;
		for (let d = 0; d < decisions.length; d++) {
			p = 0;
			for (let i = 0; i < decisions[d].length; i++) {
				p += this.getDecisionValue(battle, decisions, decisions[d], decisions[d][i], i);
			}
			dTable.push({ des: d, val: p });
			if (maxP === null || maxP < p) maxP = p;
		}
		const chosen: Decision[][] = [];
		for (let j = 0; j < dTable.length; j++) {
			if (dTable[j].val === maxP && decisions[dTable[j].des]) chosen.push(decisions[dTable[j].des]);
		}
		return chosen[Math.floor(Math.random() * chosen.length)];
	}
}
