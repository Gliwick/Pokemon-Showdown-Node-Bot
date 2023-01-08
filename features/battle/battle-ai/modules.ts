/*
 * Battle modules
 */

import { debug } from '../../../log';
import { toId } from '../../../tools';
import { Battle, Request } from './battle';
import { Player } from './battle-data';
import { Decision } from './decision';
import { IngameNoStatus } from './modules/ingame-nostatus';
import { Random } from './modules/random';
import { SinglesEffective } from './modules/singles-eff';

export interface BattleModuleClass {
	readonly ID: string;
	new (): BattleModule;
}

export interface ActiveBattle extends Battle {
	request: Request;
	self: Player;
	foe: Player;
}

export interface BattleModule {
	readonly name: string;
	readonly desc?: string;
	decide: (battle: ActiveBattle, decisions: Decision[][]) => Decision[] | null;
}

export class ModuleManager {
	modules: Record<string, BattleModule>;

	constructor() {
		this.modules = ([IngameNoStatus, Random, SinglesEffective] as BattleModuleClass[]).reduce((acc, Module) => {
			const moduleInstance = new Module();
			acc[Module.ID] = moduleInstance;
			debug('Loaded battle module: ' + Module.ID + (moduleInstance.desc ? ' [' + moduleInstance.desc + ']' : ''));
			return acc;
		}, {} as Record<string, BattleModule>);
	}

	private chooseInt(battle: Battle): BattleModule | null {
		if (!battle.tier) return null;

		const modId = Config.battleModules?.[toId(battle.tier)];
		if (modId) {
			const mod = this.modules[modId];
			if (mod) {
				return mod;
			}
		}

		/* Module decision by default */

		if (toId(battle.tier).includes('1v1')) {
			if (this.modules[IngameNoStatus.ID]) {
				return this.modules[IngameNoStatus.ID];
			}
		}

		if (battle.gametype === 'singles') {
			if (this.modules[SinglesEffective.ID]) {
				return this.modules[SinglesEffective.ID];
			}
		}

		return this.modules[IngameNoStatus.ID] || null;
	}

	choose(battle: Battle): BattleModule | null {
		const module = this.chooseInt(battle);
		if (module) {
			battle.debug('Battle module [' + battle.id + '] - Using ' + module.name);
		} else {
			battle.debug('Battle module [' + battle.id + '] - Not found, using random');
		}
		return module;
	}
}
