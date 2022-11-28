/*
 * Battle modules
 */

import { Battle } from './battle';
import { Decision } from './decision';

interface Module {
	ID: string;
	desc?: string;
	decide: (battle: Battle, decisions: Decision[][]) => Decision[];
}

export const modules: { [key: string]: Module } = {};

const modFiles = ['singles-eff.ts', 'ingame-nostatus.ts', 'random.ts'];

modFiles.forEach((file) => {
	try {
		const mod = require("./modules/" + file) as Module | undefined;
		if (!mod?.ID) return;
		modules[mod.ID] = mod;
		debug("Loaded battle module: " + mod.ID + (mod.desc ? (" [" + mod.desc + "]") : ""));
	} catch (e) {
		errlog(e.stack);
		error("Could not import battle module: " + file + " | " + sys.inspect(e));
	}
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

	if (toId(battle.tier) in { 'challengecup1v1': 1, '1v1': 1 }) {
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
