import { ID } from '../tools';
import { Ability } from './types-abilities';
import { Condition } from './types-conditions';
import { Item } from './types-items';
import { Species } from './types-species';

export type GenderName = 'M' | 'F' | 'N' | '';
export type StatIDExceptHP = 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export type StatID = 'hp' | StatIDExceptHP;
export type StatsExceptHPTable = { [stat in StatIDExceptHP]: number };
export type StatsTable = { [stat in StatID]: number };
export type SparseStatsTable = Partial<StatsTable>;
export type BoostID = StatIDExceptHP | 'accuracy' | 'evasion';
export type BoostsTable = { [boost in BoostID]: number };
export type SparseBoostsTable = Partial<BoostsTable>;
export type Nonstandard = 'Past' | 'Future' | 'Unobtainable' | 'CAP' | 'LGPE' | 'Custom' | 'Gigantamax';

export type MoveSource = `${number}${'M' | 'L' | 'T' | 'R' | 'E' | 'D' | 'S' | 'V' | 'C'}${number | ''}`;

export type TierTypes = {
	Singles:
		| 'AG'
		| 'Uber'
		| '(Uber)'
		| 'OU'
		| '(OU)'
		| 'UUBL'
		| 'UU'
		| 'RUBL'
		| 'RU'
		| 'NUBL'
		| 'NU'
		| '(NU)'
		| 'PUBL'
		| 'PU'
		| '(PU)'
		| 'NFE'
		| 'LC';
	Doubles: 'DUber' | '(DUber)' | 'DOU' | '(DOU)' | 'DBL' | 'DUU' | '(DUU)' | 'NFE' | 'LC';
	Other: 'Unreleased' | 'Illegal' | 'CAP' | 'CAP NFE' | 'CAP LC';
};

export interface EventInfo {
	generation: number;
	level?: number;
	/** true: always shiny, 1: sometimes shiny, false | undefined: never shiny */
	shiny?: boolean | 1;
	gender?: GenderName;
	nature?: string;
	ivs?: SparseStatsTable;
	perfectIVs?: number;
	/** true: has hidden ability, false | undefined: never has hidden ability */
	isHidden?: boolean;
	abilities?: string[];
	maxEggMoves?: number;
	moves?: string[];
	pokeball?: string;
	from?: string;
	/** Japan-only events can't be transferred to international games in Gen 1 */
	japan?: boolean;
}

export type Effect = Ability | Item | Species | Condition;

export interface EffectData {
	name?: string;
	desc?: string;
	duration?: number;
	effectType?: string;
	infiltrates?: boolean;
	isNonstandard?: Nonstandard | null;
	shortDesc?: string;
}

type EffectType =
	| 'Condition'
	| 'Pokemon'
	| 'Move'
	| 'Item'
	| 'Ability'
	| 'Format'
	| 'Nature'
	| 'Ruleset'
	| 'Weather'
	| 'Status'
	| 'Terastal'
	| 'Rule'
	| 'ValidatorRule';

export interface BasicEffect extends EffectData {
	id: ID;
	effectType: EffectType;
	exists: boolean;
	fullname: string;
	/**
	 * Dex number? For a Pokemon, this is the National Dex number. For
	 * other effects, this is often an internal ID (e.g. a move
	 * number). Not all effects have numbers, this will be 0 if it
	 * doesn't. Nonstandard effects (e.g. CAP effects) will have
	 * negative numbers.
	 */
	num: number;
	gen: number;
	/** Whether or not the condition is ignored by Baton Pass - only for pure conditions. */
	noCopy: boolean;
	/** Whether or not the condition affects fainted Pokemon. */
	affectsFainted: boolean;
	sourceEffect: string;
}
