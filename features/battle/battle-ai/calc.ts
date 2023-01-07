/*
 * Pokemon Showdown Bot - Damage calculator
 */

import { GenderName, SparseBoostsTable, SparseStatsTable, StatID, StatIDExceptHP, StatsTable } from '../../../data/dex-types';
import { deepcopy, toId } from '../../../tools';
import { Battle } from './battle';
import { CurrentGen, Pokemon as BattlePokemon, PokemonDetails, Type } from './battle-data';
import { getMultipleEff } from './typechart';

const BaseStats: StatID[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const BoostedStats: StatIDExceptHP[] = ['atk', 'def', 'spa', 'spd', 'spe'];

export class Pokemon implements PokemonDetails {
	template;
	gen: number;

	// PokemonDetails properties
	species: string;
	level = 100;
	shiny = false;
	gender: GenderName | null = null;
	terastallize: Type | null = null;

	name: string;
	item: Record<string, any> | null = null;
	stats: SparseStatsTable = {};
	evs: SparseStatsTable = {};
	ivs: SparseStatsTable = {};
	dvs: SparseStatsTable = {};
	nature: SparseStatsTable = {};
	ability: Record<string, any> | null = null;
	supressedAbility = false;
	happiness: number | null = null;
	status: string | null = null;
	hp = 100;

	category: Category | 'Status' | 'Mixed' = 'Mixed';

	constructor(template, properties: Partial<Pokemon> & { helpers?: Record<string, any> }, battle?: Battle) {
		if (!template || typeof template !== 'object') throw new Error('Invalid pokemon template');
		this.template = { ...template };
		if (properties.helpers?.template) {
			for (const attr in properties.helpers.template) {
				this.template[attr] = deepcopy(properties.helpers.template[attr]);
			}
		}

		this.gen = battle?.gen || CurrentGen;

		this.name = this.template.species;
		this.species = this.template.species;

		for (const attr in properties) {
			if (typeof this[attr] === 'undefined' || typeof this[attr] === 'function') continue;
			if (['helpers', 'template'].includes(attr)) continue;
			this[attr] = deepcopy(properties[attr]);
		}
	}

	getEV(ev: StatID, gen: number = CurrentGen): number {
		return this.evs[ev] || (gen <= 2 ? 252 : 84);
	}

	getIV(iv: StatID): number {
		return this.ivs[iv] || 31;
	}

	getDV(dv: StatID): number {
		return this.dvs[dv] || 15;
	}

	getBaseStat(stat: StatID): number {
		if (this.template && this.template.baseStats) {
			if (this.template.species === 'Aegislash' && this.hasAbility('stancechange') && ['atk', 'spa'].includes(stat)) return 140;
			else return this.template.baseStats[stat] || 0;
		} else {
			return 90;
		}
	}

	getStat(stat: StatID): number {
		const knownStat = this.stats[stat];
		if (knownStat) return knownStat;
		if (stat === 'hp' && this.getBaseStat(stat) === 1) return 1;

		if (this.gen <= 2) {
			if (stat === 'hp') {
				return (
					Math.floor(
						(((this.getBaseStat(stat) + this.getDV(stat)) * 2 + Math.floor((Math.sqrt(65024) + 1) / 4)) * this.level) / 100
					) +
					10 +
					this.level
				);
			} else {
				return (
					Math.floor(
						(((this.getBaseStat(stat) + this.getDV(stat)) * 2 + Math.floor((Math.sqrt(65024) + 1) / 4)) * this.level) / 100
					) + 5
				);
			}
		} else {
			if (stat === 'hp') {
				return Math.floor(
					((2 * this.getBaseStat(stat) + this.getIV(stat) + this.getEV(stat, this.gen) / 4) * this.level) / 100 + this.level + 10
				);
			} else {
				return Math.floor(
					Math.floor(((2 * this.getBaseStat(stat) + this.getIV(stat) + this.getEV(stat, this.gen) / 4) * this.level) / 100 + 5) *
						(this.nature[stat] || 1)
				);
			}
		}
	}

	getStats(): StatsTable {
		return BaseStats.reduce((acc: SparseStatsTable, stat) => {
			acc[stat] = this.getStat(stat);
			return acc;
		}, {}) as StatsTable;
	}

	getBoostedStat(stat: StatIDExceptHP, statValue: number, boosts: SparseBoostsTable): number {
		if (boosts[stat]) {
			let muxOff = 1 + 0.5 * Math.abs(boosts[stat] || 0);
			if ((boosts[stat] || 0) < 0) muxOff = 1 / muxOff;
			return Math.floor(statValue * muxOff);
		}
		return statValue;
	}

	getTypes(conditions: Conditions, preterastallized = false): Type[] {
		if (!preterastallized && this.terastallize) return [this.terastallize];

		let types = [...(this.template.types || [])];
		if (conditions && conditions.volatiles) {
			if (conditions.volatiles.typechange?.length) types = [...conditions.volatiles.typechange];
			if (conditions.volatiles.typeadd) {
				types.push(conditions.volatiles.typeadd);
			}
		}
		return types;
	}

	hasType(type_s: Type | Type[], conditions: Conditions): boolean {
		const pokemonTypes = this.getTypes(conditions);
		if (typeof type_s === 'string') return pokemonTypes.includes(type_s);

		for (const type of type_s) {
			if (pokemonTypes.includes(type)) return true;
		}
		return false;
	}

	hasAbility(ability: string | Record<string, any>): boolean {
		if (this.gen < 3) return false;
		return !!(
			this.ability &&
			!this.supressedAbility &&
			(this.ability.id === ability || (typeof ability !== 'string' && this.ability.id in ability))
		);
	}

	hasItem(item: string | Record<string, any>): boolean {
		return !!(this.item && (this.item.id === item || (typeof item !== 'string' && this.item.id in item)) && !this.hasAbility('klutz'));
	}

	isGrounded(conditions: Conditions): boolean {
		return !(this.hasType('Flying', conditions) || this.hasAbility('levitate') || this.hasItem('airballoon'));
	}

	getFullSpe(battle: Pick<Battle, 'gen' | 'conditions'>, conditions: Conditions, ignoreBoost?: boolean): number {
		const gen = battle.gen || CurrentGen;

		let spe = Math.floor(this.getStat('spe'));
		if (!ignoreBoost) spe = this.getBoostedStat('spe', spe, conditions.boosts);

		if (this.status && this.hasAbility('quickfeet')) {
			spe = Math.floor(spe * 1.5);
		} else if (this.status === 'par') {
			spe = Math.floor(spe * (gen < 7 ? 0.25 : 0.5));
		}
		if (this.hasAbility('slowstart')) spe = Math.floor(spe * 0.5);
		if (this.hasItem({ ironball: 1, machobrace: 1 })) spe = Math.floor(spe * 0.5);
		if (this.hasItem('choicescarf')) spe = Math.floor(spe * 1.5);
		if (this.hasItem('quickpowder') && this.item && this.item.itemUser.includes(this.template.species)) {
			spe = Math.floor(spe * 2);
		}
		if (conditions.volatiles.unburden) spe *= 2;
		if (conditions.volatiles.protosynthesis === 'spe' || conditions.volatiles.quarkdrive === 'spe') {
			spe = Math.floor(spe * 1.5);
		}

		const globalConditions = battle.conditions;
		if (globalConditions.tailwind) spe *= 2;
		if (globalConditions.weather && !globalConditions.supressedWeather) {
			const weather = toId(globalConditions.weather);
			if (
				(['desolateland', 'sunnyday'].includes(weather) && this.hasAbility('chlorophyll')) ||
				(['primordealsea', 'raindance'].includes(weather) && this.hasAbility('swiftswim')) ||
				(weather === 'sandstorm' && this.hasAbility('sandrush')) ||
				(['hail', 'snow'].includes(weather) && this.hasAbility('slushrush'))
			) {
				spe *= 2;
			}
		}
		if (globalConditions.electricterrain && this.hasAbility('surgesurfer')) spe = Math.floor(spe * 2);

		return spe;
	}
}

export class Conditions {
	volatiles: Record<string, any> = {};
	boosts: SparseBoostsTable = {};
	side: Record<string, any> = {};
	pokemon: BattlePokemon[] = [];
	immediate: Record<string, any> = {};

	constructor(data: Partial<Conditions>) {
		if (typeof data !== 'object') throw new Error('Invalid conditions data');
		this.volatiles = {};
		this.boosts = {};
		this.side = {};
		this.pokemon = [];
		this.immediate = {};
		for (const attr in data) {
			if (typeof this[attr] === 'undefined' || typeof this[attr] === 'function') continue;
			this[attr] = deepcopy(data[attr]);
		}
	}
}

export function getRolls(n: number, pmin = 0.85, pmax = 1): number[] {
	if (n === 0) return [0];

	const rolls: number[] = [];
	for (let m = pmin; m <= pmax; m += 0.01) {
		rolls.push(Math.floor(m * n) || 1);
	}
	return rolls;
}

export class Damage {
	rolls: number[];
	hp: number;
	percents: number[] = [];

	constructor(hp: number, rolls?: number[]) {
		this.rolls = rolls || [];
		this.hp = hp || 1;

		this.percents = [];
		for (let i = 0; i < this.rolls.length; i++) {
			if (hp === 0) {
				this.percents.push(100);
			} else {
				this.percents.push((this.rolls[i] * 100) / hp);
			}
		}
		this.percents.sort();
	}

	getChance(p: number): number {
		if (!this.percents || this.percents.length) return 0;
		if (!this.hp || this.hp <= 0) return 100;
		let s = 0;
		for (let i = 0; i < this.percents.length; i++) {
			if (this.percents[i] >= p) s++;
		}
		return (s * 100) / this.percents.length;
	}

	getMax(): number {
		return this.percents[0] || 0;
	}

	getMin(): number {
		return this.percents[0] || 0;
	}

	getAvg(): number {
		if (!this.percents.length) return 0;
		return this.percents[Math.ceil(this.percents.length / 2) - 1];
	}
}

export function getHazardsDamage(
	poke: Pokemon,
	conditions: Conditions,
	globalConditions: Record<string, any>,
	gen: number = CurrentGen,
	battleId: string
): number {
	if (poke.hasAbility('magicguard') || poke.hasItem('heavydutyboots')) return 0;

	const side = conditions.side;
	if (poke.template.species === 'Shedinja' && (side.stealthrock || side.spikes || side.gmaxsteelsurge)) return 100;

	const inverse = !!globalConditions.inversebattle;
	let dmg = 0;

	if (side.stealthrock) {
		dmg += (100 * getMultipleEff('Rock', poke.getTypes(conditions), gen, false, !!globalConditions.inversebattle, battleId)) / 8.0;
	}
	if (side.spikes) {
		if (globalConditions.gravity || !poke.isGrounded(conditions)) dmg += (100 * side.spikes) / 24.0;
	}
	if (side.gmaxsteelsurge) {
		dmg += (100 * getMultipleEff('Steel', poke.getTypes(conditions), gen, false, !!globalConditions.inversebattle, battleId)) / 8.0;
	}

	return dmg;
}

export function getMoveType(
	poke: Pokemon,
	move,
	conditions: Conditions,
	globalConditions: Record<string, any>,
	gen: number = CurrentGen
): Type {
	switch (move.id) {
		case 'aurawheel':
			if (poke.template.species === 'Morpeko-Hangry') return 'Dark';
			return move.type;
		case 'ragingbull':
			if (poke.template.species === 'Tauros-Paldea-Fire') return 'Fire';
			if (poke.template.species === 'Tauros-Paldea-Water') return 'Water';
			return move.type;
		case 'judgment':
			return poke.item?.onPlate || move.type;
		case 'multiattack':
			return poke.item?.onMemory || move.type;
		case 'naturalgift':
			return poke.item?.naturalGift?.type || move.type;
		case 'revelationdance':
			return poke.getTypes(conditions)[0];
		case 'struggle':
			return move.type;
		case 'technoblast':
			return poke.item?.onDrive || move.type;
		case 'weatherball':
			if (['primordialsea', 'raindance'].includes(globalConditions.weather)) return 'Water';
			if (['desolateland', 'sunnyday'].includes(globalConditions.weather)) return 'Fire';
			if (globalConditions.weather === 'sandstorm') return 'Rock';
			if (['hail', 'snow'].includes(toId(globalConditions.weather))) return 'Ice';
			return move.type;
		case 'terrainpulse':
			if (globalConditions.electricterrain) return 'Electric';
			if (globalConditions.grassyterrain) return 'Grass';
			if (globalConditions.mistyterrain) return 'Fairy';
			if (globalConditions.psychicterrain) return 'Psychic';
			return move.type;
		case 'terablast':
			return poke.terastallize || move.type;
	}

	if (poke.ability && !poke.supressedAbility) {
		switch (poke.ability.id) {
			case 'normalize':
				return 'Normal';
			case 'aerilate':
				if (move.type === 'Normal') return 'Flying';
				break;
			case 'pixilate':
				if (move.type === 'Normal') return 'Fairy';
				break;
			case 'refrigerate':
				if (move.type === 'Normal') return 'Ice';
				break;
			case 'galvanize':
				if (move.type === 'Normal') return 'Electric';
				break;
			case 'liquidvoice':
				if (move.flags?.sound) return 'Water';
				break;
		}
	}

	return move.type;
}

function getDamage(level: number, bp: number, atk: number, def: number, modifier: number, typeEffectiveness: number): number {
	if (bp === 0) return 0;
	return (
		Math.floor(
			(Math.floor(Math.floor(((Math.floor((2 * level) / 5.0) + 2) * bp * atk) / def) / 50.0) + 2) * modifier * typeEffectiveness
		) || 1
	);
}

/*
 * Damage calculator function
 *
 * Arguments:
 *
 *  - attacker, defender (Pokemon)
 *  - move (move template)
 *
 * Optional arguments:
 *
 *  - gconditions (Global conditions)
 *  - battle
 */

interface PokemonWithConditions {
	poke: Pokemon;
	conditions?: Conditions;
}

type Category = 'Physical' | 'Special';

export function calculate(
	attacker: PokemonWithConditions,
	defender: PokemonWithConditions,
	move,
	globalConditions: Record<string, any> = {},
	battle?: Battle,
	transformation?: any
): Damage {
	const atkPoke = new Pokemon(attacker.poke.template, attacker.poke, battle);
	const atkConditions = new Conditions(attacker.conditions || {});
	const defPoke = new Pokemon(defender.poke.template, defender.poke, battle);
	const defConditions = new Conditions(defender.conditions || {});

	if (typeof transformation === 'object' && transformation?.terastallize) {
		atkPoke.terastallize = transformation.terastallize as Type;
	}

	const gen = battle?.gen || CurrentGen;
	const battleId = battle?.id;

	globalConditions.supressedWeather =
		atkPoke.hasAbility({ airlock: 1, cloudnine: 1 }) || defPoke.hasAbility({ airlock: 1, cloudnine: 1 });
	const supressedWeather = globalConditions.supressedWeather;

	const atkStats = atkPoke.getStats();
	const defStats = defPoke.getStats();
	const atkSpe = atkPoke.getFullSpe({ conditions: globalConditions, gen }, atkConditions, false);
	const defSpe = defPoke.getFullSpe({ conditions: globalConditions, gen }, defConditions, false);

	let atk, def, atkStat: StatIDExceptHP, defStat: StatIDExceptHP;
	let category: Category, defCategory: Category;

	/******************************
	 * Attack and Defense Stats
	 *******************************/

	if (move.isMax && move.basePower <= 10 && atkPoke.template.baseStats.spa > atkPoke.template.baseStats.atk) {
		move = { ...move };
		move.category = 'Special';
	}

	if (gen > 3) {
		category = move.category;
	} else {
		const specialTypes = ['Fire', 'Water', 'Grass', 'Ice', 'Electric', 'Dark', 'Psychic', 'Dragon'];
		category = specialTypes.includes(move.type) ? 'Special' : 'Physical';
	}

	if (category === 'Special') {
		atkStat = 'spa';
	} else if (category === 'Physical') {
		atkStat = 'atk';
	} else {
		return new Damage(defStats.hp);
	}

	defCategory = move.defensiveCategory || category;
	if (defCategory === 'Special') {
		defStat = 'spd';
	} else if (defCategory === 'Physical') {
		defStat = 'def';
	} else {
		return new Damage(defStats.hp);
	}

	// custom attacking stat
	if (move.id === 'bodypress') atkStat = 'def';
	if (
		(['photongeyser', 'lightthatburststhesky'].includes(move.id) && atkStats.atk > atkStats.spa) ||
		(move.id === 'shellsidearm' && atkStats.atk / defStats.def > atkStats.spa / defStats.spd) ||
		(move.id === 'terablast' && atkPoke.terastallize && atkStats.atk > atkStats.spa)
	) {
		atkStat = 'atk';
		defStat = 'def';
		if (move.id === 'shellsidearm') {
			move = { ...move };
			move.flags = { ...move.flags, contact: true };
		}
	}

	atk = atkStats[atkStat];
	def = defStats[defStat];
	if (move.id === 'foulplay') atk = defStats[atkStat];

	const moveType = getMoveType(atkPoke, move, atkConditions, globalConditions, gen) || 'Normal';
	let movePriority = move.priority;

	if (move.id === 'grassyglide' && globalConditions.grassyterrain && atkPoke.isGrounded(atkConditions)) {
		movePriority++;
	}

	if (atkPoke.ability && !atkPoke.supressedAbility && !defPoke.hasAbility('neutralizinggas')) {
		switch (atkPoke.ability.id) {
			case 'blaze':
				if (moveType === 'Fire' && atkPoke.hp <= 100 / 3) atk = Math.floor(atk * 1.5);
				break;
			case 'overgrow':
				if (moveType === 'Grass' && atkPoke.hp <= 100 / 3.0) atk = Math.floor(atk * 1.5);
				break;
			case 'swarm':
				if (moveType === 'Bug' && atkPoke.hp <= 100 / 3.0) atk = Math.floor(atk * 1.5);
				break;
			case 'torrent':
				if (moveType === 'Water' && atkPoke.hp <= 100 / 3.0) atk = Math.floor(atk * 1.5);
				break;
			case 'defeatist':
				if (atkPoke.hp < 50 && category === 'Physical') atk = Math.floor(atk * 0.5);
				break;
			case 'guts':
				if (atkPoke.status && atkPoke.status !== 'frz' && category === 'Physical') atk = Math.floor(atk * 1.5);
				break;
			case 'hugepower':
			case 'purepower':
				if (category === 'Physical') atk = Math.floor(atk * 2);
				break;
			case 'hustle':
			case 'gorillatactics':
				if (category === 'Physical') atk = Math.floor(atk * 1.5);
				break;
			case 'steelworker':
				if (move.type === 'Steel') atk = Math.floor(atk * 1.5);
				break;
			case 'waterbubble':
				if (move.type === 'Water') atk *= 2;
				break;
			case 'transistor':
				if (move.type === 'Electric') atk = Math.floor(atk * 1.5);
				break;
			case 'dragonsmaw':
				if (move.type === 'Dragon') atk = Math.floor(atk * 1.5);
				break;
			case 'rockypayload':
				if (move.type === 'Rock') atk = Math.floor(atk * 1.5);
				break;
			case 'swordofruin':
				if (defStat === 'def') def = Math.floor(def * 0.75);
				break;
			case 'beadsofruin':
				if (defStat === 'spd') def = Math.floor(def * 0.75);
				break;
			// weather
			case 'solarpower':
				if (!supressedWeather && ['desolateland', 'sunnyday'].includes(globalConditions.weather)) {
					if (category === 'Special') atk = Math.floor(atk * 1.5);
				}
				break;
			case 'orichalcumpulse':
				if (!supressedWeather && ['desolateland', 'sunnyday'].includes(globalConditions.weather)) {
					if (category === 'Physical') atk = Math.floor(atk * 1.3);
				}
				break;
			case 'protosynthesis':
				if (
					!atkConditions.volatiles.protosynthesis &&
					!supressedWeather &&
					['desolateland', 'sunnyday'].includes(globalConditions.weather)
				) {
					const maxStat = BoostedStats.reduce((acc, v) => Math.max(acc, atkStats[v]), 0);
					const maxStatName = BoostedStats.filter((stat) => atkStats[stat] === maxStat)[0];
					if (atkStat === maxStatName) atk = Math.floor(atk * 1.3);
				}
				break;
			// terrain
			case 'hadronengine':
				if (globalConditions.electricterrain) {
					if (category === 'Special') atk = Math.floor(atk * 1.3);
				}
				break;
			case 'quarkdrive':
				if (!atkConditions.volatiles.quarkdrive && globalConditions.electricterrain) {
					const maxStat = BoostedStats.reduce((acc, v) => Math.max(acc, atkStats[v]), 0);
					const maxStatName = BoostedStats.filter((stat) => atkStats[stat] === maxStat)[0];
					if (atkStat === maxStatName) atk = Math.floor(atk * 1.3);
				}
				break;
			// priority
			case 'triage':
				if (move.flags?.heal) movePriority += 3;
				break;
			case 'galewings':
				if (moveType === 'Flying' && (gen <= 6 || atkPoke.hp >= 100)) movePriority++;
				break;
		}
	}

	if (defPoke.ability && !defPoke.supressedAbility && !atkPoke.hasAbility('neutralizinggas')) {
		switch (defPoke.ability.id) {
			case 'vesselofruin':
				if (category === 'Special') atk = Math.floor(atk * 0.75);
				break;
			case 'tabletsofruin':
				if (category === 'Physical') atk = Math.floor(atk * 0.75);
				break;
			case 'protosynthesis':
				if (
					!defConditions.volatiles.protosynthesis &&
					!supressedWeather &&
					['desolateland', 'sunnyday'].includes(globalConditions.weather)
				) {
					const maxStat = BoostedStats.reduce((acc, v) => Math.max(acc, defStats[v]), 0);
					const maxStatName = BoostedStats.filter((stat) => defStats[stat] === maxStat)[0];
					if (defStat === maxStatName) def = Math.floor(def * 1.3);
				}
				break;
			case 'quarkdrive':
				if (!defConditions.volatiles.quarkdrive && globalConditions.electricterrain) {
					const maxStat = BoostedStats.reduce((acc, v) => Math.max(acc, defStats[v]), 0);
					const maxStatName = BoostedStats.filter((stat) => defStats[stat] === maxStat)[0];
					if (defStat === maxStatName) def = Math.floor(def * 1.3);
				}
				break;
		}
		if (!atkPoke.hasAbility({ moldbreaker: 1, teravolt: 1, turboblaze: 1 }) && !move.ignoreAbility) {
			switch (defPoke.ability.id) {
				case 'thickfat':
					if (['Ice', 'Fire'].includes(moveType)) atk = Math.floor(atk * 0.5);
					break;
				case 'waterbubble':
					if (moveType === 'Fire') atk = Math.floor(atk * 0.5);
					break;
				case 'purifyingsalt':
					if (moveType === 'Ghost') atk = Math.floor(atk * 0.5);
					break;
				case 'marvelscale':
					if (atkPoke.status && defStat === 'def') def = Math.floor(def * 1.5);
					break;
				case 'furcoat':
					if (defStat === 'def') def = Math.floor(def * 2);
					break;
				case 'grasspelt':
					if (globalConditions.grassyterrain) {
						if (defStat === 'def') def = Math.floor(def * 1.5);
					}
					break;
			}
		}
	}

	/******************************
	 * Types (effectiveness)
	 * Immunity (0 damage)
	 *******************************/

	let notImmune = false;
	if (move.id === 'struggle') notImmune = true;
	if (['Fighting', 'Normal'].includes(moveType) && (defConditions.volatiles.foresight || atkPoke.hasAbility('scrappy'))) {
		notImmune = true;
	}
	if (moveType === 'Ground' && (move.id === 'thousandarrows' || globalConditions.gravity)) notImmune = true;

	const { inversebattle } = globalConditions;
	const defTypes = [...defPoke.getTypes(defConditions)];
	let typeEffectiveness = getMultipleEff(moveType, defTypes, gen, notImmune, !!inversebattle, battleId);
	if (move.id === 'flyingpress') {
		typeEffectiveness *= getMultipleEff('Flying', defTypes, gen, notImmune, !!inversebattle, battleId);
	}
	if (move.id === 'freezedry' && defTypes.includes('Water')) {
		typeEffectiveness =
			2 *
			getMultipleEff(
				moveType,
				defTypes.filter((t) => t !== 'Water'),
				gen,
				notImmune,
				!!inversebattle,
				battleId
			);
	}
	if (move.type === 'Shadow') typeEffectiveness = 2;

	let immune = false;

	if (gen <= 2 && move.drain && defConditions.volatiles.substitute) immune = true;
	if (!defPoke.isGrounded(defConditions) && moveType === 'Ground' && !notImmune) immune = true;

	if (
		defPoke.ability &&
		!defPoke.supressedAbility &&
		!atkPoke.hasAbility({ moldbreaker: 1, teravolt: 1, turboblaze: 1, neutralizinggas: 1 }) &&
		!move.ignoreAbility
	) {
		switch (defPoke.ability.id) {
			case 'dryskin':
			case 'stormdrain':
			case 'waterabsorb':
				if (moveType === 'Water') immune = true;
				break;
			case 'flashfire':
			case 'wellbakedbody':
				if (moveType === 'Fire') immune = true;
				break;
			case 'lightningrod':
			case 'motordrive':
			case 'voltabsorb':
				if (moveType === 'Electric') immune = true;
				break;
			case 'sapsipper':
				if (moveType === 'Grass') immune = true;
				break;
			case 'eartheater':
				if (moveType === 'Ground') immune = true;
				break;
			case 'soundproof':
				if (move.flags?.sound) immune = true;
				break;
			case 'bulletproof':
				if (move.flags?.bullet) immune = true;
				break;
			case 'windrider':
				if (move.flags?.wind) immune = true;
				break;
			case 'dazzling':
			case 'queenlymajesty':
			case 'armortail':
				if (movePriority > 0) immune = true;
				break;
			case 'wonderguard':
				if (typeEffectiveness < 2) immune = true;
				break;
		}
	}

	if (immune || typeEffectiveness === 0) return new Damage(defStats.hp);

	/******************************
	 * Base power
	 *******************************/

	let bp: number = move.basePower || 0;

	if (category === 'Physical' && atkPoke.status === 'brn') {
		if (gen < 3) atk = Math.floor(atk * 0.5);
		else if (!atkPoke.hasAbility('guts')) bp = Math.floor(bp * 0.5);
	}

	if (move.isMax && bp <= 10) {
		bp = ['Fighting', 'Poison'].includes(moveType) ? 90 : 130;
	}

	switch (move.id) {
		// undetermined bp
		case 'frustration':
			if (typeof atkPoke.happiness !== 'number') bp = 102;
			else bp = Math.floor(((255 - atkPoke.happiness) * 2) / 5) || 1;
			break;
		case 'return':
		case 'pikapapow':
		case 'veeveevolley':
			if (typeof atkPoke.happiness !== 'number') bp = 102;
			else bp = Math.floor((atkPoke.happiness * 2) / 5) || 1;
			break;
		case 'fling':
			if (atkPoke.item && atkPoke.item.fling) bp = atkPoke.item.fling.basePower || 0;
			else bp = 0;
			break;
		case 'naturalgift':
			if (atkPoke.item && atkPoke.item.naturalGift && atkPoke.item.naturalGift.basePower) bp = atkPoke.item.naturalGift.basePower;
			else bp = 0;
			break;
		case 'grassknot':
		case 'lowkick':
			if (defConditions.volatiles.dynamax) {
				bp = 0;
			} else if (defPoke.template.weightkg) {
				if (defPoke.template.weightkg >= 200) {
					bp = 120;
				} else if (defPoke.template.weightkg >= 100) {
					bp = 100;
				} else if (defPoke.template.weightkg >= 50) {
					bp = 80;
				} else if (defPoke.template.weightkg >= 25) {
					bp = 60;
				} else if (defPoke.template.weightkg >= 10) {
					bp = 40;
				} else {
					bp = 20;
				}
			} else {
				bp = 20;
			}
			break;
		case 'heavyslam':
		case 'heatcrash':
			if (defConditions.volatiles.dynamax) {
				bp = 0;
			} else if (atkPoke.template.weightkg && defPoke.template.weightkg) {
				if (atkPoke.template.weightkg / defPoke.template.weightkg > 5) {
					bp = 120;
				} else if (atkPoke.template.weightkg / defPoke.template.weightkg > 4) {
					bp = 100;
				} else if (atkPoke.template.weightkg / defPoke.template.weightkg > 3) {
					bp = 80;
				} else if (atkPoke.template.weightkg / defPoke.template.weightkg > 2) {
					bp = 60;
				} else {
					bp = 40;
				}
			} else {
				bp = 40;
			}
			break;
		case 'gyroball':
			bp = Math.floor((25 * defSpe) / atkSpe) || 1;
			if (bp > 150) bp = 150;
			break;
		case 'electroball':
			if (atkSpe && defSpe) {
				if (atkSpe / defSpe >= 4) {
					bp = 150;
				} else if (atkSpe / defSpe >= 3) {
					bp = 120;
				} else if (atkSpe / defSpe >= 2) {
					bp = 80;
				} else if (atkSpe / defSpe >= 1) {
					bp = 60;
				} else {
					bp = 40;
				}
			} else bp = 40;
			break;
		case 'reversal':
		case 'flail':
			if (atkStats.hp >= 68.75) {
				bp = 20;
			} else if (atkStats.hp >= 35.42) {
				bp = 40;
			} else if (atkStats.hp >= 20.83) {
				bp = 80;
			} else if (atkStats.hp >= 10.42) {
				bp = 100;
			} else if (atkStats.hp >= 4.17) {
				bp = 150;
			} else {
				bp = 200;
			}
			break;
		case 'wringout':
		case 'crushgrip':
			bp = Math.floor(120 * (defPoke.hp / 100)) || 1;
			if (bp > 120) bp = 120;
			break;
		case 'punishment':
			bp =
				60 +
				20 *
					Object.values(defConditions.boosts)
						.filter((boost) => boost > 0)
						.reduce((acc, v) => acc + v, 0);
			break;
		case 'trumpcard':
		case 'present':
			bp = 40;
			break;
		case 'magnitude':
			bp = 10;
			break;

		// altered bp
		case 'smellingsalts':
			if (defPoke.status === 'par') bp *= 2;
			break;
		case 'wakeupslap':
			if (defPoke.status === 'slp') bp *= 2;
			break;
		case 'dreameater':
			if (defPoke.status !== 'slp') bp = 0;
			break;
		case 'snore':
			if (atkPoke.status !== 'slp') bp = 0;
			break;
		case 'venoshock':
			if (['psn', 'tox'].includes(defPoke.status || '')) bp *= 2;
			break;
		case 'hex':
		case 'infernalparade':
		case 'barbbarrage':
			if (defPoke.status) bp *= 2;
			break;
		case 'brine':
			if (defPoke.hp <= 50) bp *= 2;
			break;
		case 'facade':
			if (atkPoke.status && !['slp', 'frz'].includes(atkPoke.status)) bp *= 2;
			break;
		case 'knockoff':
			if (defPoke.item && !defPoke.item.onTakeItem) bp = Math.floor(bp * 1.5);
			break;
		case 'acrobatics':
			if (!atkPoke.item || !atkPoke.item.id || atkPoke.item.id === 'flyinggem') bp *= 2;
			break;
		case 'poltergeist':
			if (!defPoke.item || !defPoke.item.id) bp = 0;
			break;
		case 'retaliate':
			if (atkConditions.side.faintedLastTurn) bp *= 2;
			break;
		case 'payback':
		case 'ragefist':
			if ((!globalConditions.trickroom && atkSpe < defSpe) || (globalConditions.trickroom && atkSpe > defSpe)) bp *= 2;
			break;
		case 'avalanche':
		case 'revenge':
			bp *= 2;
			break;
		case 'boltbeak':
		case 'fishiousrend':
			if ((!globalConditions.trickroom && atkSpe > defSpe) || (globalConditions.trickroom && atkSpe < defSpe)) bp *= 2;
			break;
		case 'behemothblade':
		case 'behemothbash':
		case 'dynamaxcannon':
			if (defConditions.volatiles.dynamax) bp *= 2;
			break;
		case 'weatherball':
			if (globalConditions.weather) bp *= 2;
			break;
		case 'solarbeam':
		case 'solarblade':
			if (['primordialsea', 'raindance', 'sandstorm', 'hail', 'snow'].includes(toId(globalConditions.weather)))
				bp = Math.floor(bp * 0.5);
			break;
		case 'hyperspacefury':
			if (atkPoke.template.species !== 'Hoopa-Unbound') bp = 0;
			break;
		case 'aurawheel':
			if (!atkPoke.template.species.startsWith('Morpeko')) bp = 0;
			break;
		case 'waterspout':
		case 'eruption':
			bp *= atkPoke.hp / 100.0;
			break;
		case 'storedpower':
		case 'powertrip':
			if (atkConditions.boosts) {
				bp +=
					20 *
					Object.values(atkConditions.boosts)
						.filter((stat) => stat > 0)
						.reduce((acc, v) => acc + v, 0);
			}
			break;
		case 'gravapple':
			if (globalConditions.gravity) bp = Math.floor(bp * 1.5);
			break;
		case 'terrainpulse':
			if (atkPoke.isGrounded(atkConditions)) {
				for (const gcondition in globalConditions) {
					if (gcondition.endsWith('terrain')) bp *= 2;
				}
			}
			break;
		case 'steelroller':
			let terrainActive = false;
			for (const gcondition in globalConditions) {
				if (gcondition.endsWith('terrain')) terrainActive = true;
			}
			if (!terrainActive) bp = 0;
			break;
		case 'risingvoltage':
			if (globalConditions.electricterrain && defPoke.isGrounded(defConditions)) bp *= 2;
			break;
		case 'expandingforce':
			if (globalConditions.psychicterrain && atkPoke.isGrounded(atkConditions)) bp = Math.floor(bp * 1.5);
			break;
		case 'mistyexplosion':
			if (globalConditions.mistyterrain && atkPoke.isGrounded(atkConditions)) bp = Math.floor(bp * 1.5);
			break;
		case 'lastrespects':
			bp = bp + 50 * atkConditions.pokemon.filter((poke) => poke.fainted || poke.status === 'fnt').length;
			break;
		case 'collisioncourse':
		case 'electrodrift':
			if (typeEffectiveness > 1) bp = Math.floor(bp * 1.5);
			break;
	}

	if (!bp) {
		if (move.damage === 'level') return new Damage(defStats.hp, [atkPoke.level]);
		if (typeof move.damage === 'number') return new Damage(defStats.hp, [move.damage]);
		if (move.id === 'endeavor')
			new Damage(defStats.hp, [Math.max(0, defStats.hp * (defPoke.hp / 100.0) - atkStats.hp * (atkPoke.hp / 100.0))]);
		if (move.id === 'psywave') new Damage(defStats.hp, getRolls(atkPoke.level, 0.5, 1.5));
		return new Damage(defStats.hp);
	}

	if (atkPoke.ability && !atkPoke.supressedAbility && !defPoke.hasAbility('neutralizinggas')) {
		switch (atkPoke.ability.id) {
			case 'technician':
				if (bp <= 60) bp = Math.floor(bp * 1.5);
				break;
			case 'toxicboost':
				if (category === 'Physical' && ['psn', 'tox'].includes(atkPoke.status || '')) bp = Math.floor(bp * 1.5);
				break;
			case 'toughclaws':
				if (move.flags?.contact) bp = Math.floor(bp * 1.3);
				break;
			case 'normalize':
				if (moveType === 'Normal') bp = Math.floor(bp * 1.2);
				break;
			case 'aerilate':
			case 'pixilate':
			case 'refrigerate':
			case 'galvanize':
				if (move.type === 'Normal') bp = Math.floor(bp * 1.2);
				break;
			case 'darkaura':
				if (move.type === 'Dark') {
					if (defPoke.hasAbility('aurabreak')) bp = Math.floor(bp * 0.75);
					else bp = Math.floor(bp * 1.33);
				}
				break;
			case 'fairyaura':
				if (move.type === 'Fairy') {
					if (defPoke.hasAbility('aurabreak')) bp = Math.floor(bp * 0.75);
					else bp = Math.floor(bp * 1.33);
				}
				break;
			case 'steelyspirit':
				if (move.type === 'Steel') bp = Math.floor(bp * 1.5);
				break;
			case 'flareboost':
				if (category === 'Special' && atkPoke.status === 'brn') bp = Math.floor(bp * 1.5);
				break;
			case 'ironfist':
				if (move.flags?.punch) bp = Math.floor(bp * 1.2);
				break;
			case 'megalauncher':
				if (move.flags?.pulse) bp = Math.floor(bp * 1.5);
				break;
			case 'reckless':
				if (move.recoil || move.hasCustomRecoil) bp = Math.floor(bp * 1.2);
				break;
			case 'rivalry':
				if (!(atkPoke.gender === 'N' || defPoke.gender === 'N')) {
					if (atkPoke.gender === defPoke.gender) {
						bp = Math.floor(bp * 1.25);
					} else {
						bp = Math.floor(bp * 0.75);
					}
				}
				break;
			case 'sandforce':
				if (!supressedWeather && globalConditions.weather === 'sandstorm' && ['Rock', 'Ground', 'Steel'].includes(moveType))
					bp = Math.floor(bp * 1.3);
				break;
			case 'sheerforce':
				if (move.secondaries) bp = Math.floor(bp * 1.3);
				break;
			case 'strongjaw':
				if (move.flags?.bite) bp = Math.floor(bp * 1.5);
				break;
			case 'analytic':
				if ((!globalConditions.trickroom && atkSpe < defSpe) || (globalConditions.trickroom && atkSpe > defSpe))
					bp = Math.floor(bp * 1.3);
				break;
			case 'punkrock':
				if (move.flags?.sound) bp = Math.floor(bp * 1.3);
				break;
			case 'sharpness':
				if (move.flags?.slicing) bp = Math.floor(bp * 1.5);
				break;
			case 'supremeoverlord':
				bp = Math.floor(bp * (1 + 0.1 * atkConditions.pokemon.filter((poke) => poke.fainted || poke.status === 'fnt').length));
				break;
		}
	}

	if (defPoke.ability && !defPoke.supressedAbility && !atkPoke.hasAbility('neutralizinggas')) {
		switch (defPoke.ability.id) {
			case 'prismarmor':
				if (typeEffectiveness > 1) bp = Math.floor(bp * 0.75);
				break;
			case 'shadowshield':
				if (defPoke.hp >= 100) bp = Math.floor(bp * 0.5);
				break;
		}
		if (!atkPoke.hasAbility({ moldbreaker: 1, teravolt: 1, turboblaze: 1 }) && !move.ignoreAbility) {
			switch (defPoke.ability.id) {
				case 'darkaura':
					if (move.type === 'Dark') {
						if (atkPoke.hasAbility('aurabreak')) bp = Math.floor(bp * 0.75);
						else bp = Math.floor(bp * 1.33);
					}
					break;
				case 'fairyaura':
					if (move.type === 'Fairy') {
						if (atkPoke.hasAbility('aurabreak')) bp = Math.floor(bp * 0.75);
						else bp = Math.floor(bp * 1.33);
					}
					break;
				case 'dryskin':
					if (moveType === 'Fire') bp = Math.floor(bp * 1.25);
					break;
				case 'heatproof':
					if (moveType === 'Fire') bp = Math.floor(bp * 0.5);
					break;
			}
		}
	}

	if (atkPoke.item && (!atkPoke.item.itemUser || atkPoke.item.itemUser.includes(atkPoke.template.species))) {
		switch (atkPoke.item.id) {
			case 'lightball':
				atk = Math.floor(atk * 2);
			case 'thickclub':
				if (category === 'Physical') atk *= 2;
			case 'deepseatooth':
				if (category === 'Special') atk *= 2;
			case 'choiceband':
				if (category === 'Physical') atk = Math.floor(atk * 1.5);
				break;
			case 'choicespecs':
				if (category === 'Special') atk = Math.floor(atk * 1.5);
				break;
			case 'souldew':
				if (gen >= 7) {
					if (['Dragon', 'Psychic'].includes(moveType)) bp = Math.floor(bp * 1.2);
				} else {
					if (category === 'Special') atk = Math.floor(atk * 1.5);
				}
				break;
			case 'adamantorb':
			case 'adamantcrystal':
			case 'lustrousorb':
			case 'lustrousglobe':
			case 'griseousorb':
			case 'griseouscore':
				if (atkPoke.template.types.includes(moveType)) bp = Math.floor(bp * 1.2);
				break;
			case 'silkscarf':
				if (moveType === 'Normal') bp = Math.floor(bp * 1.2);
				break;
			case 'expertbelt':
				if (typeEffectiveness > 1) bp = Math.floor(bp * 1.2);
				break;
			case 'punchingglove':
				if (move.flags?.punch) bp = Math.floor(bp * 1.1);
				break;
		}
		if (atkPoke.item.isGem && atkPoke.item.name.startsWith(moveType)) bp = Math.floor(bp * (gen >= 6 ? 1.3 : 1.5));
		if (atkPoke.item.onPlate === moveType) bp = Math.floor(bp * 1.2);
	}

	if (defPoke.item && (!defPoke.item.itemUser || defPoke.item.itemUser.includes(defPoke.template.species))) {
		if (
			defPoke.item.onSourceModifyDamage &&
			defPoke.item.naturalGift?.type === move.type &&
			!atkPoke.hasAbility({ asone: 1, unnerve: 1 })
		) {
			if (defPoke.hasAbility('ripen')) bp = Math.floor(bp * 0.25);
			else bp = Math.floor(bp * 0.5);
		}
		switch (defPoke.item.id) {
			case 'metalpowder':
				if (defStat === 'def') def *= 2;
				break;
			case 'deepseascale':
				if (defStat === 'spd') def *= 2;
				break;
			case 'souldew':
				if (gen < 7 && defStat === 'spd') def = Math.floor(def * 1.5);
				break;
			case 'eviolite':
				if (atkPoke.template.evos) def = Math.floor(def * 1.5);
				break;
			case 'assaultvest':
				if (defStat === 'spd') def = Math.floor(def * 1.5);
				break;
		}
	}

	/******************************
	 * Modifiers
	 *******************************/

	let modifier = 1;

	if (atkPoke.item?.id === 'lifeorb') modifier *= 1.3;

	/* STAB */
	let stab = 1;
	if (atkPoke.terastallize) {
		const originalStab = atkPoke.getTypes(atkConditions, true).includes(moveType);
		const teraStab = move.type === atkPoke.terastallize;
		if (originalStab && teraStab && !['firepledge', 'grasspledge', 'waterpledge'].includes(move.id)) {
			if (battle) battle.debug('applying double ' + move.type + ' stab from terastallization');
			stab = atkPoke.hasAbility('adaptability') ? 2.25 : 2;
		} else if (teraStab) {
			stab = atkPoke.hasAbility('adaptability') ? 2 : 1.5;
		} else if (originalStab) {
			stab = 1.5;
		}
	} else {
		if (atkPoke.hasType(moveType, atkConditions) || atkPoke.hasAbility({ libero: 1, protean: 1 })) {
			stab = atkPoke.hasAbility('adaptability') ? 2 : 1.5;
		}
	}

	modifier *= stab;

	/* Abilities */

	if (atkPoke.ability && !atkPoke.supressedAbility && !defPoke.hasAbility('neutralizinggas')) {
		switch (atkPoke.ability.id) {
			case 'tintedlens':
				if (typeEffectiveness < 1) modifier *= 2;
				break;
			case 'neuroforce':
				if (typeEffectiveness > 1) modifier *= 1.25;
				break;
		}
	}

	if (defPoke.ability && !defPoke.supressedAbility && !atkPoke.hasAbility('neutralizinggas')) {
		switch (defPoke.ability.id) {
			case 'prismarmor':
				if (typeEffectiveness > 1) modifier *= 0.75;
				break;
			case 'shadowshield':
				if (defPoke.hp >= 100) modifier *= 0.5;
				break;
		}
		if (!atkPoke.hasAbility({ moldbreaker: 1, teravolt: 1, turboblaze: 1 }) && !move.ignoreAbility) {
			switch (defPoke.ability.id) {
				case 'fluffy':
					if (moveType === 'Fire') modifier *= 2;
					if (move.flags?.contact) modifier *= 0.5;
					break;
				case 'icescales':
					if (defStat === 'spd') modifier *= 0.5;
					break;
				case 'filter':
				case 'solidrock':
					if (typeEffectiveness > 1) modifier *= 0.75;
					break;
				case 'multiscale':
					if (defPoke.hp >= 100) modifier *= 0.5;
					break;
				case 'punkrock':
					if (move.flags?.sound) modifier *= 0.5;
					break;
			}
		}
	}

	/* Weather */

	if (globalConditions.weather && !supressedWeather) {
		const weather = toId(globalConditions.weather);
		switch (weather) {
			case 'primordialsea':
			case 'raindance':
				if (move.type === 'Water') modifier *= 1.5;
				if (move.type === 'Fire') modifier *= weather === 'raindance' ? 0.5 : 0;
				break;
			case 'desolateland':
			case 'sunnyday':
				if (move.type === 'Fire') modifier *= 1.5;
				if (move.type === 'Water') modifier *= weather === 'sunnyday' ? 0.5 : 0;
				break;
			case 'sandstorm':
				if (gen >= 4 && defTypes.includes('Rock') && defStat === 'spd') def = Math.floor(def * 1.5);
				break;
			case 'snow':
				if (gen >= 9 && defTypes.includes('Ice') && defStat === 'def') def = Math.floor(def * 1.5);
				break;
		}
	}

	/* Boosting */

	if (atkConditions.boosts && !defPoke.hasAbility('unaware')) {
		if (move.id === 'foulplay') atk = defPoke.getBoostedStat(atkStat, atk, defConditions.boosts);
		else atk = atkPoke.getBoostedStat(atkStat, atk, atkConditions.boosts);
	}

	const willCrit =
		atkConditions.immediate.crit ||
		move.willCrit ||
		(atkPoke.hasItem({ leek: 1, luckypunch: 1, stick: 1 }) && atkPoke.item && atkPoke.item.itemUser.includes(atkPoke.template.species));

	if (defConditions.boosts[defStat]) {
		if (!willCrit && !move.ignoreDefensive && !atkPoke.hasAbility('unaware')) {
			def = defPoke.getBoostedStat(defStat, def, defConditions.boosts);
		}
	}

	/* immediate */

	if (willCrit) {
		modifier *= gen > 5 ? 1.5 : 2;
	}

	if (atkConditions.immediate.helpinghand) modifier *= 1.5;

	/* Volatiles */

	if (atkStat === atkConditions.volatiles.protosynthesis || atkStat === atkConditions.volatiles.quarkdrive) {
		atk = Math.floor(atk * 1.3);
	}
	if (defStat === defConditions.volatiles.protosynthesis || defStat === defConditions.volatiles.quarkdrive) {
		def = Math.floor(def * 1.3);
	}

	if (defConditions.volatiles.magnetrise && moveType === 'Ground') modifier = 0;

	/* Side */

	const screenModifier = ['doubles', 'triples'].includes(globalConditions.gametype) ? 0.66 : 0.5;
	if (!['brickbreak', 'psychicfangs', 'ragingbull'].includes(move.id) && !atkPoke.hasAbility('infiltrator')) {
		if (defConditions.volatiles.reflect && category === 'Physical') modifier *= 0.5; // Gen 1
		if ((defConditions.side.reflect || defConditions.side.auroraveil) && category === 'Physical') modifier *= screenModifier;
		if ((defConditions.side.lightscreen || defConditions.side.auroraveil) && category === 'Special') modifier *= screenModifier;
	}

	/* Field */

	const terrainBoost = gen >= 8 ? 1.3 : 1.5;
	if (atkPoke.isGrounded(atkConditions)) {
		if (globalConditions.electricterrain && moveType === 'Electric') bp = Math.floor(bp * terrainBoost);
		if (globalConditions.grassyterrain && moveType === 'Grass') bp = Math.floor(bp * terrainBoost);
		if (globalConditions.psychicterrain && moveType === 'Psychic') bp = Math.floor(bp * terrainBoost);
	}
	if (defPoke.isGrounded(defConditions)) {
		if (globalConditions.grassyterrain && ['bulldoze', 'earthquake', 'magnitude'].includes(move.id)) {
			bp = Math.floor(bp * 0.5);
		}
		if (globalConditions.psychicterrain && movePriority > 0) modifier = 0;
		if (globalConditions.mistyterrain && moveType === 'Dragon') bp = Math.floor(bp * 0.5);
	}

	if (['doubles', 'triples'].includes(globalConditions.gametype)) {
		if (move.target.startsWith('allAdjacent')) modifier *= 0.75;
	}

	if (
		move.type === atkPoke.terastallize &&
		move.priority <= 0 &&
		!move.multihit &&
		move.bp &&
		!(move.basePower === 0 && move.basePowerCallback) &&
		!['dragonenergy', 'eruption', 'waterspout'].includes(move.id)
	) {
		bp = Math.max(bp, 60);
	}

	/******************************
	 * Damage
	 *******************************/

	let hitsBP = [bp];
	if (['tripleaxel', 'triplekick'].includes(move.id)) {
		if (gen === 2) hitsBP = [bp, bp + 10, bp + 20];
		else hitsBP = [bp, 2 * bp, 3 * bp];
	} else if (move.multihit) {
		const numberOfHits = typeof move.multihit === 'number' ? move.multihit : move.multihit[1] || 1;
		for (let hit = 1; hit < numberOfHits; hit++) {
			hitsBP.push(bp);
		}
	} else if (move.id === 'beatup') {
		hitsBP = atkConditions.pokemon
			.filter((poke) => !(poke.fainted || poke.status === 'fnt'))
			.map((poke) => Math.floor(poke.template.baseStats.atk / 10) + 5);
	} else if (atkPoke.hasAbility('parentalbond') && !defPoke.hasAbility('neutralizinggas')) {
		if (
			!move.multihit &&
			!move.selfdestruct &&
			!move.multihit &&
			!move.flags?.charge &&
			!(move.spreadHit && ['doubles', 'triples'].includes(globalConditions.gametype)) &&
			!move.isZ &&
			!move.isMax
		) {
			let secondHitMultiplier = 1;
			if (
				move.id === 'acidspray' &&
				!defPoke.hasAbility({ clearbody: 1, fullmetalbody: 1, mirrorarmor: 1, whitesmoke: 1 }) &&
				!defPoke.hasItem('clearamulet')
			) {
				if (!defPoke.hasAbility('contrary')) secondHitMultiplier = 2;
				else secondHitMultiplier = 0.5;
			} else if (
				['chargebeam', 'fierydance', 'mysticalpower', 'poweruppunch', 'torchsong'].includes(move.id) ||
				(move.category === 'Physical' && defPoke.hasAbility('weakarmor'))
			) {
				secondHitMultiplier = 1.5;
			} else if (
				['appleacid', 'firelash', 'gravapple'].includes(move.id) &&
				!defPoke.hasAbility({ clearbody: 1, fullmetalbody: 1, mirrorarmor: 1, whitesmoke: 1 }) &&
				!defPoke.hasItem('clearamulet')
			) {
				if (!defPoke.hasAbility('contrary')) secondHitMultiplier = 1.5;
				else secondHitMultiplier = 0.66;
			} else if (['makeitrain', 'superpower'].includes(move.id)) {
				secondHitMultiplier = 0.66;
			} else if (['dracometeor', 'fleurcannon', 'leafstorm', 'overheat', 'psychoboost'].includes(move.id)) {
				secondHitMultiplier = 0.5;
			} else {
				secondHitMultiplier = 1;
			}
			hitsBP = [bp, (gen >= 7 ? 0.25 : 0.5) * secondHitMultiplier * bp];
		}
	}

	let multihitRolls: number[] = [];
	if (
		move.multihit &&
		typeof move.multihit !== 'number' &&
		!(atkPoke.hasAbility('skilllink') && !defPoke.hasAbility('neutralizinggas'))
	) {
		if (move.multihit[0] === 2 && move.multihit[1] === 5) {
			if (atkPoke.hasItem('loadeddice')) multihitRolls = [4, 5];
			else multihitRolls = gen >= 5 ? [2, 2, 3, 3, 4, 5] : [2, 2, 2, 3, 3, 3, 4, 5];
		} else if (['tripleaxel', 'triplekick'].includes(move.id) && !atkPoke.hasItem({ widelens: 1, zoomlens: 1 })) {
			if (atkPoke.hasItem('loadeddice')) multihitRolls = [3];
			else multihitRolls = gen > 2 ? [1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3] : [1, 2, 3];
		} else if (move.id === 'populationbomb' && !atkPoke.hasItem({ widelens: 1, zoomlens: 1 })) {
			if (atkPoke.hasItem('loadeddice')) multihitRolls = [4, 5, 6, 7, 8, 9, 10];
			else multihitRolls = [1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 10, 10, 10];
		} else {
			multihitRolls = [];
			for (let numberOfHits = move.multihit[0]; numberOfHits <= move.multihit[1]; numberOfHits++) {
				multihitRolls.push(numberOfHits);
			}
		}
	}

	if (multihitRolls.length) {
		for (let i = 0; i < multihitRolls.length; i++) {
			let rollDmg = 0;
			for (let hitNumber = 0; hitNumber < multihitRolls[i]; hitNumber++) {
				rollDmg += getDamage(atkPoke.level, hitsBP[hitNumber], atk, def, modifier, typeEffectiveness);
			}
			multihitRolls[i] = rollDmg;
		}
		// multihit rolls more important than damage rolls
		return new Damage(defStats.hp, multihitRolls);
	}

	let dmg = 0;
	for (const hitBP of hitsBP) {
		dmg += getDamage(atkPoke.level, hitBP, atk, def, modifier, typeEffectiveness);
	}

	return new Damage(defStats.hp, getRolls(dmg));
}
