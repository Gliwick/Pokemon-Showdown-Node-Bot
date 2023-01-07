import { AbilityData } from '../../../data/types-abilities';
import { ItemData } from '../../../data/types-items';
import { MoveData } from '../../../data/types-moves';
import { SpeciesData, SpeciesFormatsData } from '../../../data/types-species';
import { toId } from '../../../tools';
import { MODS_DATA_DIR } from '../battle-ai/battle-data';

type Modded<T> = T & { inherit?: boolean };

export function getPokemon(name: string, mod?: string): Modded<SpeciesData> | null {
	try {
		const pokedex: Record<string, SpeciesData> = mod
			? require((Config.battleModsDir || MODS_DATA_DIR) + mod + '/pokedex.js').BattlePokedex
			: DataDownloader.getPokedex();
		return { ...pokedex[toId(name)] } || null;
	} catch (e: any) {}
	return null;
}

export function getItem(name: string, mod?: string): Modded<ItemData> | null {
	try {
		const itemdex: Record<string, ItemData> = mod
			? require((Config.battleModsDir || MODS_DATA_DIR) + mod + '/items.js').BattleItems
			: DataDownloader.getItems();
		return { ...itemdex[toId(name)] } || null;
	} catch (e: any) {}
	return null;
}

export function getAbility(name: string, mod?: string): Modded<AbilityData> | null {
	try {
		const abilitydex: Record<string, AbilityData> = mod
			? require((Config.battleModsDir || MODS_DATA_DIR) + mod + '/abilities.js').BattleAbilities
			: DataDownloader.getAbilities();
		return { ...abilitydex[toId(name)] } || null;
	} catch (e: any) {}
	return null;
}

export function getMove(name: string, mod?: string): Modded<MoveData> | null {
	try {
		const movedex: Record<string, MoveData> = mod
			? require((Config.battleModsDir || MODS_DATA_DIR) + mod + '/moves.js').BattleMovedex
			: DataDownloader.getMovedex();
		return { ...movedex[toId(name)] } || null;
	} catch (e: any) {}
	return null;
}

export function getFormatsData(name: string, mod?: string): Modded<SpeciesFormatsData> | null {
	try {
		const pokedex: Record<string, SpeciesFormatsData> = mod
			? require((Config.battleModsDir || MODS_DATA_DIR) + mod + '/formats-data.js').BattleFormatsData
			: DataDownloader.getFormatsData();
		return { ...pokedex[toId(name)] } || null;
	} catch (e: any) {}
	return null;
}
