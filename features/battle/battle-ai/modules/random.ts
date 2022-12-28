/*
 * Random Decision
 */

import { Battle } from '../battle';
import { Decision } from '../decision';
import { BattleModule } from '../modules';

export class Random implements BattleModule {
	static readonly ID = 'random';
	readonly name = 'random';

	constructor() {}

	decide(battle: Battle, decisions: Decision[][]): Decision[] {
		return decisions[Math.floor(Math.random() * decisions.length)];
	}
}
