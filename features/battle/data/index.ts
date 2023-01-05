import { toId } from '../../../tools';

export function getPokemon(name?: string): Record<string, any> {
	name = toId(name || '');
	try {
		return DataDownloader.getPokedex()[name] || {};
	} catch (e: any) {}
	return {};
}

export function getItem(name?: string): Record<string, any> {
	name = toId(name || '');
	try {
		return DataDownloader.getItems()[name] || {};
	} catch (e: any) {}
	return {};
}

export function getAbility(name?: string): Record<string, any> {
	name = toId(name || '');
	try {
		return DataDownloader.getAbilities()[name] || {};
	} catch (e: any) {}
	return {};
}

export function getMove(name?: string): Record<string, any> {
	name = toId(name || '');
	try {
		return DataDownloader.getMovedex()[name] || {};
	} catch (e: any) {}
	return {};
}
