import { toId } from '../../../tools';

export function getTemplate(name?: string): Record<string, any> {
	name = toId(name || '');
	try {
		return DataDownloader.getPokedex()[name] || {};
	} catch (e) {}
	return {};
}

export function getItem(name?: string): Record<string, any> {
	name = toId(name || '');
	try {
		return DataDownloader.getItems()[name] || {};
	} catch (e) {}
	return {};
}

export function getAbility(name?: string): Record<string, any> {
	name = toId(name || '');
	try {
		return DataDownloader.getAbilities()[name] || {};
	} catch (e) {}
	return {};
}

export function getMove(name?: string): Record<string, any> {
	name = toId(name || '');
	try {
		return DataDownloader.getMovedex()[name] || {};
	} catch (e) {}
	return {};
}
