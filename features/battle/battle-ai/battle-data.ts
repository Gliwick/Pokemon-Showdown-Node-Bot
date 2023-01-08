/*
	Battle data
*/

import { String as Sugar } from 'sugar';

import { AbilityData } from '../../../data/types-abilities';
import { ConditionData } from '../../../data/types-conditions';
import { BasicEffect, BoostID, EffectType, GenderName, SparseBoostsTable } from '../../../data/types-dex';
import { ItemData } from '../../../data/types-items';
import { MoveData } from '../../../data/types-moves';
import { SpeciesData, SpeciesFormatsData } from '../../../data/types-species';
import { ID, toId } from '../../../tools';
import {
	getAbility as getModdedAbility,
	getFormatsData as getModdedFormatsData,
	getItem as getModdedItem,
	getMove as getModdedMove,
	getPokemon as getModdedPokemon,
} from '../data';
import { Conditions } from '../data/conditions';

export const BATTLE_DATA_DIR = './../data/';
export const MODS_DATA_DIR = BATTLE_DATA_DIR + 'mods/';

export const CurrentGen = 9;

export type Type =
	| 'Bug'
	| 'Dark'
	| 'Dragon'
	| 'Electric'
	| 'Fairy'
	| 'Fighting'
	| 'Fire'
	| 'Flying'
	| 'Ghost'
	| 'Grass'
	| 'Ground'
	| 'Ice'
	| 'Normal'
	| 'Poison'
	| 'Psychic'
	| 'Rock'
	| 'Steel'
	| 'Water'
	| '???';

function getMods(gen: number, battleId?: string): string[] {
	const mods = [...Array(CurrentGen - 1).keys()]
		.filter((i) => i >= gen)
		.map((i) => 'gen' + i)
		.reverse();
	const formatId = battleId && battleId.split('-')[1];
	const formatMod = formatId && Config.battleFormatMods[formatId];
	if (formatMod) mods.push(formatMod);
	return mods;
}

export type WithID<T> = T & { id: ID };

export function getPokemon(poke: string, gen: number = CurrentGen, battleId?: string): WithID<SpeciesData> {
	if (gen > CurrentGen || gen < 1) gen = CurrentGen;
	const pokeId = toId(poke);
	let pokemon = getModdedPokemon(pokeId);

	for (const mod of getMods(gen, battleId)) {
		const temp = getModdedPokemon(pokeId, mod);
		if (!temp) continue;
		if (!pokemon || !temp.inherit) {
			pokemon = { ...temp };
		} else {
			Object.assign(pokemon, temp);
		}
	}

	if (!pokemon) {
		return {
			id: pokeId,
			num: 0,
			name: poke,
			types: ['???'],
			baseStats: { hp: 90, atk: 90, def: 90, spa: 90, spd: 90, spe: 90 },
			abilities: { 0: 'No Ability' },
			heightm: 0,
			weightkg: 0,
			eggGroups: [],
		};
	}

	return { id: pokeId, ...pokemon };
}

const TypeAliases: Record<Type, string[]> = {
	Bug: [],
	Dark: [],
	Dragon: ['draco'],
	Electric: ['electro', 'thunder'],
	Fairy: [],
	Fighting: ['fight'],
	Fire: ['flame', 'flare', 'heat'],
	Flying: ['fly', 'sky', 'wing'],
	Ghost: ['shadow'],
	Grass: ['leaf', 'petal', 'seed'],
	Ground: ['earth', 'mud'],
	Ice: ['freez'],
	Normal: [],
	Poison: ['sludge', 'toxic', 'veno'],
	Psychic: ['psy'],
	Rock: ['stone'],
	Steel: ['iron', 'metal'],
	Water: ['aqua', 'bubble', 'hydro'],
	'???': [],
};

function evaluateMoveType(name: string): Type {
	for (const moveType in TypeAliases) {
		if (name.includes(toId(moveType))) {
			return moveType as Type;
		}
	}

	for (const key in TypeAliases) {
		const moveType = key as Type;
		for (const typeAlias of TypeAliases[moveType]) {
			if (name.includes(typeAlias)) {
				return moveType;
			}
		}
	}

	return 'Normal';
}

export function getMove(move: string, gen: number = CurrentGen, battleId?: string): WithID<MoveData> {
	if (gen > CurrentGen || gen < 1) gen = CurrentGen;
	const moveId = toId(move);
	let moveData = getModdedMove(moveId);

	for (const mod of getMods(gen, battleId)) {
		const temp = getModdedMove(moveId, mod);
		if (!temp) continue;
		if (!moveData || !temp.inherit) {
			moveData = { ...temp };
		} else {
			Object.assign(moveData, temp);
		}
	}

	if (!moveData) {
		const type = evaluateMoveType(move);
		const category = ['Dragon', 'Electric', 'Fairy', 'Fire', 'Ghost', 'Grass', 'Ice', 'Psychic', 'Water'].includes(type)
			? 'Special'
			: 'Physical';
		return {
			id: moveId,
			num: 0,
			accuracy: 100,
			basePower: 90,
			category,
			name: move,
			pp: 10,
			priority: 0,
			flags: { protect: 1, ...(category === 'Physical' && !['Ground', 'Rock'].includes(type) ? { contact: 1 } : {}) },
			effectType: 'Move',
			type,
			target: 'adjacentFoe',
		};
	}

	return { id: moveId, effectType: 'Move', ...moveData };
}

export function getItem(item: string, gen: number = CurrentGen, battleId?: string): WithID<ItemData> {
	if (gen > CurrentGen || gen < 1) gen = CurrentGen;
	const itemId = toId(item);
	let itemData = getModdedItem(itemId);

	for (const mod of getMods(gen, battleId)) {
		const temp = getModdedItem(itemId, mod);
		if (!temp) continue;
		if (!itemData || !temp.inherit) {
			itemData = { ...temp };
		} else {
			Object.assign(itemData, temp);
		}
	}

	if (!itemData) {
		return {
			id: itemId,
			name: item,
			spritenum: 0,
			num: 0,
			gen: CurrentGen,
			effectType: 'Item',
		};
	}

	return { id: itemId, effectType: 'Item', ...itemData };
}

export function getAbility(ability: string, gen: number = CurrentGen, battleId?: string): WithID<AbilityData> {
	if (gen > CurrentGen || gen < 1) gen = CurrentGen;
	const abilityId = toId(ability);
	let abilityData = getModdedAbility(abilityId);

	for (const mod of getMods(gen, battleId)) {
		const temp = getModdedAbility(abilityId, mod);
		if (!temp) continue;
		if (!abilityData || !temp.inherit) {
			abilityData = { ...temp };
		} else {
			Object.assign(abilityData, temp);
		}
	}

	if (!abilityData) {
		return {
			id: abilityId,
			name: ability,
			rating: 0,
			num: 0,
			effectType: 'Ability',
		};
	}

	return { id: abilityId, effectType: 'Ability', ...abilityData };
}

type BasicEffectData = Omit<Partial<BasicEffect>, 'effectType'>;

type EffectData = WithID<ItemData | AbilityData | MoveData | ConditionData | BasicEffectData> & {
	effectType: EffectType | 'Recoil' | 'Drain';
};

export function getEffect(effect: string | EffectData, gen: number = CurrentGen): EffectData {
	if (effect && typeof effect !== 'string') {
		return effect;
	}

	effect = (effect || '').trim();
	const [type, name] = effect.includes(':') ? effect.split(':') : ['', effect];
	const id = toId(name);

	if (!id) return { id, name: Sugar.escapeHTML(name || ''), effectType: 'Condition' };

	if (type === 'item') {
		return { ...getItem(id, gen), effectType: 'Item' };
	} else if (type === 'ability') {
		return { ...getAbility(id, gen), effectType: 'Ability' };
	} else if (type === 'move') {
		return { ...getMove(id, gen), effectType: 'Move' };
	}

	const pMove = getMove(id, gen);
	const pAbility = getAbility(id, gen);
	const pItem = getItem(id, gen);

	if (Conditions[id]) return { id, effectType: 'Condition', ...Conditions[id] };
	if (pMove.condition) return { id, effectType: 'Condition', ...pMove.condition };
	if (pAbility.condition) return { id, effectType: 'Condition', ...pAbility.condition };
	if (pItem.condition) return { id, effectType: 'Condition', ...pItem.condition };

	const effectData: EffectData = { id, name: Sugar.escapeHTML(name || ''), effectType: 'Condition' };

	if (id === 'recoil') {
		effectData.effectType = 'Recoil';
	} else if (id === 'drain') {
		effectData.effectType = 'Drain';
	}

	return effectData;
}

export function getFormatsData(poke: string, gen: number = CurrentGen, battleId?: string): SpeciesFormatsData {
	if (gen > CurrentGen || gen < 1) gen = CurrentGen;
	const pokeId = toId(poke);
	let formatsData = getModdedFormatsData(pokeId);
	if (!formatsData) {
		return { randomBattleMoves: [] };
	}

	for (const mod of getMods(gen, battleId)) {
		const temp = getModdedFormatsData(pokeId, mod);
		if (!temp) continue;
		if (!formatsData || !temp.inherit) {
			formatsData = { ...temp };
		} else {
			Object.assign(formatsData, temp);
		}
	}

	return formatsData;
}

export class Move {
	template: MoveData;
	name: string;
	id: ID;
	pp: number;
	disabled = false;
	helpers = {};

	constructor(template: MoveData, move?: Partial<Move>) {
		if (!template || typeof template !== 'object') throw new Error('Invalid move template');
		this.template = template;
		this.name = this.template.name;
		this.id = toId(template.name);
		this.pp = Math.floor(this.template.pp * 1.6);
		if (move) Object.assign(this, move);
	}

	restorePP(pp?: number): void {
		if (pp) {
			this.pp += pp;
		} else {
			this.pp = Math.floor(this.template.pp * 1.6);
		}
	}
}

export type Unknown = '&unknown';

export interface PokemonDetails {
	species: string;
	level: number;
	shiny: boolean;
	gender: GenderName;
	terastallize: Type | null;
}

export class Pokemon implements PokemonDetails {
	template: SpeciesData;
	name: string;

	// PokemonDetails properties
	species;
	gender: GenderName = '';
	level = 100;
	shiny = false;
	terastallize: Type | null = null;

	transformed = false;
	transformPrev: Pick<Pokemon, 'template' | 'species' | 'shiny' | 'moves' | 'ability' | 'baseAbility' | 'abilityStack'> | null = null;

	item: WithID<ItemData> | Unknown | null = '&unknown';
	itemEffect = '';
	prevItem: WithID<ItemData> | null = null;
	prevItemEffect = '';

	ability: WithID<AbilityData> | Unknown = '&unknown';
	supressedAbility = false;
	baseAbility: WithID<AbilityData> | Unknown = '&unknown';
	abilityStack: string[] = [];

	moves: Move[] = [];

	active = false;
	slot = -1;

	hp = 100;
	fainted = false;
	status?: string;
	volatiles: Record<string, any> = {};
	boosts: SparseBoostsTable = {};

	passing: number | null = null;
	prepared: {
		move: string;
		target: number;
	} | null = null;

	helpers: Record<string, any> = {};

	constructor(template: SpeciesData, properties: Partial<Pokemon>) {
		if (!template || typeof template !== 'object') throw new Error('Invalid pokemon template');

		this.template = template;
		this.species = this.template.name;
		this.name = this.template.name;

		Object.assign(this, properties);
	}

	addVolatile(volatile: string): void {
		volatile = toId(volatile);
		this.volatiles[volatile] = true;
	}

	removeVolatile(volatile: string): void {
		volatile = toId(volatile);
		if (this.volatiles[volatile]) delete this.volatiles[volatile];
	}

	removeAllVolatiles(): void {
		for (const i in this.volatiles) delete this.volatiles[i];
	}

	addBoost(stat: BoostID, n: number): void {
		this.boosts[stat] = (this.boosts[stat] || 0) + n;
	}

	setBoost(stat: BoostID, n: number): void {
		this.boosts[stat] = n;
	}

	invertAllBoosts(): void {
		for (const i in this.boosts) {
			const stat = i as BoostID;
			this.boosts[stat] = -1 * (this.boosts[stat] || 0);
		}
	}

	removeAllBoosts(): void {
		this.boosts = {};
	}

	markAbility(id: string, isNotBase = false): void {
		this.ability = getAbility(id);
		if ((!this.baseAbility || this.baseAbility === '&unknown') && !isNotBase) {
			this.baseAbility = this.ability;
			this.abilityStack.push(toId(this.ability.name));
		} else if (isNotBase && this.baseAbility && this.baseAbility !== '&unknown') {
			if (this.ability.id === this.baseAbility.id) {
				if (this.abilityStack[this.abilityStack.length - 1] === this.ability.id) {
					this.abilityStack.pop();
				}
				if (this.abilityStack[this.abilityStack.length - 1]) {
					this.baseAbility = getAbility(this.abilityStack[this.abilityStack.length - 1]);
				} else {
					this.baseAbility = '&unknown';
				}
			}
		}
	}

	prepareMove(move: string, target: number): void {
		this.prepared = { move, target };
	}

	markMove(id: string, deduct?: number): Move | null {
		id = toId(id);
		const move = this.moves.filter((m) => m.id === id)[0] || null;
		if (move && deduct) {
			move.pp += deduct;
		}
		return move;
	}

	transformInto(pokemon: Pokemon): void {
		const { template, species, shiny, moves, ability, baseAbility, abilityStack } = this;
		this.transformPrev = { template, species, shiny, moves, ability, baseAbility, abilityStack };
		this.species = pokemon.species;
		this.template = { ...pokemon.template };
		this.shiny = pokemon.shiny;
		this.ability = pokemon.ability;
		this.baseAbility = pokemon.baseAbility;
		this.abilityStack = [...pokemon.abilityStack];
		this.moves = pokemon.moves.map((mv) => new Move(mv.template, { pp: 5 }));
		this.transformed = true;
		this.removeAllBoosts();
		this.boosts = { ...pokemon.boosts };
		this.addVolatile('transform');
		this.addVolatile('formechange');
		this.volatiles.formechange = pokemon.volatiles.formechange || pokemon.species;
	}

	unTransform(): void {
		this.transformed = false;
		if (this.transformPrev) {
			Object.assign(this.transformPrev);
		}
		this.transformPrev = null;
	}
}

export class Player {
	id: string;
	name: string;
	userid: string;
	active: (Pokemon | null)[] = [];
	side: Record<string, any> = {};
	pokemon: Pokemon[] = [];
	teamPv: (PokemonDetails | null)[] = [];

	constructor(id: string, name?: string) {
		this.id = id || 'p0';
		this.name = name || '';
		this.userid = toId(name);
	}

	setName(name: string): void {
		this.name = name;
		this.userid = toId(name);
	}

	removeSideCondition(condition: string): void {
		condition = toId(condition);
		if (this.side[condition]) delete this.side[condition];
	}

	addSideCondition(condition: string): void {
		condition = toId(condition);
		if (!this.side[condition]) this.side[condition] = 0;
		this.side[condition]++;
	}
}
