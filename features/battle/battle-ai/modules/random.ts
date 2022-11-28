/*
 * Random Decision
 */

import { Battle } from "../battle";
import { Decision } from "../decision";

export const ID = "random";

export function decide(battle: Battle, decisions: Decision[][]): Decision[] {
	return decisions[Math.floor(Math.random() * decisions.length)];
};
