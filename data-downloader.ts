/*
	Data Downloader
*/
import { writeFile } from 'fs';
import { IncomingMessage } from 'http';
import { get } from 'https';

import { AbilityData } from './data/types-abilities';
import { ItemData } from './data/types-items';
import { MoveData } from './data/types-moves';
import { LearnsetData, SpeciesData, SpeciesFormatsData } from './data/types-species';
import { debug, errlog, error } from './log';
import { uncacheTree } from './tools';

export class DataDownloader {
	initDate = Date.now();
	lastDownload?: number;
	data: { url: string; file: string }[] = [
		{
			url: 'https://play.pokemonshowdown.com/data/formats-data.js?' + this.initDate,
			file: 'formats-data.js',
		},
		{
			url: 'https://play.pokemonshowdown.com/data/pokedex.js?' + this.initDate,
			file: 'pokedex.js',
		},
		{
			url: 'https://play.pokemonshowdown.com/data/moves.js?' + this.initDate,
			file: 'moves.js',
		},
		{
			url: 'https://play.pokemonshowdown.com/data/abilities.js?' + this.initDate,
			file: 'abilities.js',
		},
		{
			url: 'https://play.pokemonshowdown.com/data/items.js?' + this.initDate,
			file: 'items.js',
		},
		{
			url: 'https://play.pokemonshowdown.com/data/learnsets.js?' + this.initDate,
			file: 'learnsets.js',
		},
		{
			url: 'https://play.pokemonshowdown.com/data/aliases.js?' + this.initDate,
			file: 'aliases.js',
		},
	];

	httpsGet(url: string, callback?: (data: string | null, error?: Error) => void): void {
		if (!callback) return;
		get(url, (res: IncomingMessage): void => {
			const data = { data: '' };
			res.on('data', (part: any): void => {
				data.data += part;
			});
			res.on('end', (): void => {
				callback(data.data);
			});
			res.on('error', (e): void => {
				callback(null, e);
			});
		}).on('error', (e: Error): void => {
			callback(null, e);
		});
	}

	downloadFile(url: string, file: string, callback?: (success: boolean, error?: Error) => void): void {
		this.httpsGet(url, (data, err): void => {
			if (err || !data) {
				if (callback) callback(false, err);
				return;
			}
			writeFile('./data/' + file, data, (err2: NodeJS.ErrnoException | null): void => {
				if (err2) {
					if (callback) callback(false, err2);
					return;
				}
				try {
					uncacheTree('./data/' + file);
				} catch (e: any) {}
				debug('Downloaded data file: ' + '../data/' + file);
				if (callback) callback(true);
			});
		});
	}

	download(): void {
		if (this.lastDownload && Date.now() - this.lastDownload <= 60 * 1000) return;
		this.lastDownload = Date.now();
		for (let i = 0; i < this.data.length; i++) {
			this.downloadFile(
				this.data[i].url,
				this.data[i].file,
				((s: boolean, err?: Error): void => {
					if (s) return;
					error('Data download failed: ' + this.data[i].file + '\n' + err?.message);
					if (err?.stack) errlog(err.stack);
				}).bind(this)
			);
		}
	}

	getPokedex(): Record<string, SpeciesData> {
		return require('./data/pokedex.js').BattlePokedex;
	}

	getMovedex(): Record<string, MoveData> {
		return require('./data/moves.js').BattleMovedex;
	}

	getAbilities(): Record<string, AbilityData> {
		return require('./data/abilities.js').BattleAbilities;
	}

	getItems(): Record<string, ItemData> {
		return require('./data/items.js').BattleItems;
	}

	getAliases(): Record<string, string> {
		return require('./data/aliases.js').BattleAliases;
	}

	getFormatsData(): Record<string, SpeciesFormatsData> {
		return require('./data/formats-data.js').BattleFormatsData;
	}

	getLearnsets(): Record<string, LearnsetData> {
		return require('./data/learnsets.js').BattleLearnsets;
	}
}
