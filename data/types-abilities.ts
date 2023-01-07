import { ConditionData } from './types-conditions';
import { BasicEffect } from './types-dex';

export interface AbilityData extends Partial<Ability> {
	name: string;
}

export interface Ability extends Readonly<BasicEffect> {
	readonly effectType: 'Ability';

	/** Rating from -1 Detrimental to +5 Essential; see `data/abilities.ts` for details. */
	readonly rating: number;
	readonly suppressWeather: boolean;
	readonly condition?: ConditionData;
	readonly isPermanent?: boolean;
	readonly isBreakable?: boolean;
}
