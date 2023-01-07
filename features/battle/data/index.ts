import { AbilityData } from '../../../data/dex-abilities';
import { ItemData } from '../../../data/dex-items';
import { MoveData } from '../../../data/dex-moves';
import { SpeciesData } from '../../../data/dex-species';
import { toId } from '../../../tools';

export function getPokemon(name?: string): SpeciesData | {} {
	name = toId(name || '');
	try {
		return DataDownloader.getPokedex()[name] || {};
	} catch (e: any) {}
	return {};
}

export function getItem(name?: string): ItemData | {} {
	name = toId(name || '');
	try {
		return DataDownloader.getItems()[name] || {};
	} catch (e: any) {}
	return {};
}

export function getAbility(name?: string): AbilityData | {} {
	name = toId(name || '');
	try {
		return DataDownloader.getAbilities()[name] || {};
	} catch (e: any) {}
	return {};
}

export function getMove(name?: string): MoveData | {} {
	name = toId(name || '');
	try {
		return DataDownloader.getMovedex()[name] || {};
	} catch (e: any) {}
	return {};
}
