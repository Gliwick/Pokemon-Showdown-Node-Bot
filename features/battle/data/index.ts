import { existsSync } from 'fs';

import { AbilityData } from '../../../data/types-abilities';
import { ItemData } from '../../../data/types-items';
import { MoveData } from '../../../data/types-moves';
import { SpeciesData, SpeciesFormatsData } from '../../../data/types-species';
import { errlog } from '../../../log';
import { toId } from '../../../tools';
import { MODS_DATA_DIR } from '../battle-ai/battle-data';

type Modded<T> = T & { inherit?: boolean };

function load(mod: string, filename: string): any {
	const path = (Config.battleModsDir || MODS_DATA_DIR) + mod + '/' + filename;
	return existsSync(path) ? require(path) : null;
}

export function getPokemon(name: string, mod?: string): Modded<SpeciesData> | null {
	try {
		const pokedex: Record<string, SpeciesData> = mod ? load(mod, 'pokedex.js')?.BattlePokedex : DataDownloader.getPokedex();
		return pokedex?.[toId(name)] ? { ...pokedex[toId(name)] } : null;
	} catch (e: any) {
		errlog(e.stack);
	}
	return null;
}

export function getItem(name: string, mod?: string): Modded<ItemData> | null {
	try {
		const itemdex: Record<string, ItemData> = mod ? load(mod, 'items.js')?.BattleItems : DataDownloader.getItems();
		return itemdex?.[toId(name)] ? { ...itemdex[toId(name)] } : null;
	} catch (e: any) {}
	return null;
}

export function getAbility(name: string, mod?: string): Modded<AbilityData> | null {
	try {
		const abilitydex: Record<string, AbilityData> = mod ? load(mod, 'abilities.js')?.BattleAbilities : DataDownloader.getAbilities();
		return abilitydex?.[toId(name)] ? { ...abilitydex[toId(name)] } : null;
	} catch (e: any) {}
	return null;
}

export function getMove(name: string, mod?: string): Modded<MoveData> | null {
	try {
		const movedex: Record<string, MoveData> = mod ? load(mod, 'moves.js')?.BattleMovedex : DataDownloader.getMovedex();
		return movedex?.[toId(name)] ? { ...movedex[toId(name)] } : null;
	} catch (e: any) {}
	return null;
}

export function getFormatsData(name: string, mod?: string): Modded<SpeciesFormatsData> | null {
	try {
		const pokedex: Record<string, SpeciesFormatsData> = mod
			? load(mod, 'formats-data.js')?.BattleFormatsData
			: DataDownloader.getFormatsData();
		return pokedex?.[toId(name)] ? { ...pokedex[toId(name)] } : null;
	} catch (e: any) {}
	return null;
}
