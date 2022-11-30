/*
 * Battle modules
 */

import { toId } from '../../../tools';
import { Battle } from './battle';
import { Decision } from './decision';
import { IngameNoStatus } from './modules/ingame-nostatus';
import { Random } from './modules/random';
import { SinglesEff } from './modules/singles-eff';

export interface Module {
	id: string;
	desc?: string;
	decide: (battle: Battle, decisions: Decision[][]) => Decision[];
}

export const modules: { [key: string]: Module } = {
	'ingame-nostatus': new IngameNoStatus(),
	'random': new Random(),
	'singles-eff': new SinglesEff(),
};

Object.values(modules).forEach((mod) => {
	debug("Loaded battle module: " + mod.id + (mod.desc ? (" [" + mod.desc + "]") : ""));
});

export function choose(battle: Battle): Module | null {
	if (!battle.tier) return null;

	const modId = Config.battleModules?.[toId(battle.tier)];
	if (modId) {
		const mod = modules[modId];
		if (mod) {
			debug("Battle module [" + battle.id + "] - Using " + mod);
			return mod;
		}
	}

	/* Module decision by default */

	if (toId(battle.tier).indexOf('1v1') >= 0) {
		if (modules["ingame-nostatus"]) {
			debug("Battle module [" + battle.id + "] - Using ingame-nostatus");
			return modules["ingame-nostatus"];
		}
	}

	if (battle.gametype === "singles") {
		if (modules["singles-eff"]) {
			debug("Battle module [" + battle.id + "] - Using singles-eff");
			return modules["singles-eff"];
		}
	}

	if (modules["ingame-nostatus"]) {
		debug("Battle module [" + battle.id + "] - Using ingame-nostatus");
		return modules["ingame-nostatus"];
	}

	/* Random, no module designed */

	debug("Battle module [" + battle.id + "] - Not found, using random");
	return null;
};
