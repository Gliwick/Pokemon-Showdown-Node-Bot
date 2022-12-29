import { existsSync, readdirSync } from 'fs';

import { errlog, error, info, ok } from '../log';
import { toId } from '../tools';

export interface Parser {
	parse: (room: string, message: string, isIntro: boolean, spl: string[]) => void;
}

export interface Feature extends Parser {
	readonly id: string;
	readonly desc?: string;
	init: () => void;
	getInitCmds?: () => string[];
	destroy: () => void;
}

const DIR = './features/';

export function loadFeature(feature: string, reloading?: boolean): void {
	feature = toId(feature); // to prevent injection
	const filename = feature + '/index.ts';
	const path = DIR + filename;

	if (!existsSync(path)) throw new Error('Error: Feature ' + feature + ' not found');
	if (reloading) Tools.uncacheTree(path);
	const f = new (require('./' + filename).feature)() as Feature;
	if (f.id) {
		if (Features[f.id]) {
			if (!reloading) return;
			Features[f.id].destroy();
		}
		Features[f.id] = f;
		if (reloading) {
			Features[f.id].init();
			info('Feature "' + f.id + '" ' + 'reloaded');
		} else {
			ok('New feature: ' + f.id + ' | ' + f.desc);
		}
	} else {
		throw new Error('Error: Feature ' + feature + ' not found');
	}
}

export function loadFeatures(reloading?: boolean): string[] {
	const featureList = readdirSync(DIR);
	const errs: string[] = [];

	featureList.forEach((feature): void => {
		const path = DIR + feature + '/index.ts';
		if (existsSync(path)) {
			try {
				loadFeature(feature, reloading);
			} catch (e: any) {
				errlog(e.stack);
				error('Failed to ' + (reloading ? 'reload' : 'load') + ' feature: ' + './features/' + feature);
				errs.push(feature);
			}
		}
	});
	(reloading ? info : ok)(
		'Features ' + (reloading ? 'reloaded' : 'loaded') + (errs.length ? '. Errors: ' + errs.join(', ') : '')
	);
	return errs;
}
