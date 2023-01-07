import { AbilityData } from '../../../data/types-abilities';
import { ItemData } from '../../../data/types-items';
import { MoveData } from '../../../data/types-moves';
import { SpeciesData } from '../../../data/types-species';
import { toId } from '../../../tools';

export function getPokemon(name?: string): SpeciesData | {} {
	try {
		return DataDownloader.getPokedex()[toId(name)] || {};
	} catch (e: any) {}
	return {};
}

export function getItem(name?: string): ItemData | {} {
	try {
		return DataDownloader.getItems()[toId(name)] || {};
	} catch (e: any) {}
	return {};
}

export function getAbility(name?: string): AbilityData | {} {
	try {
		return DataDownloader.getAbilities()[toId(name)] || {};
	} catch (e: any) {}
	return {};
}

export function getMove(name?: string): MoveData | {} {
	try {
		return DataDownloader.getMovedex()[toId(name)] || {};
	} catch (e: any) {}
	return {};
}
