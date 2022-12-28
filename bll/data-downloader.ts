/*
	Data Downloader
*/
import { writeFile } from 'fs';
import { IncomingMessage } from 'http';
import * as https from 'https';

import { debug, errlog, error } from '../log';

const datenow = Date.now();

export class DataDownloader {
	data: { url: string; file: string }[] = [
		{
			url: 'https://raw.githubusercontent.com/Zarel/Pokemon-Showdown/master/config/formats.js',
			file: 'formats.js',
		},
		{
			url: 'https://play.pokemonshowdown.com/data/formats-data.js?' + datenow,
			file: 'formats-data.js',
		},
		{
			url: 'https://play.pokemonshowdown.com/data/pokedex.js?' + datenow,
			file: 'pokedex.js',
		},
		{
			url: 'https://play.pokemonshowdown.com/data/moves.js?' + datenow,
			file: 'moves.js',
		},
		{
			url: 'https://play.pokemonshowdown.com/data/abilities.js?' + datenow,
			file: 'abilities.js',
		},
		{
			url: 'https://play.pokemonshowdown.com/data/items.js?' + datenow,
			file: 'items.js',
		},
		{
			url: 'https://play.pokemonshowdown.com/data/learnsets.js?' + datenow,
			file: 'learnsets.js',
		},
		{
			url: 'https://play.pokemonshowdown.com/data/aliases.js?' + datenow,
			file: 'aliases.js',
		},
	];

	httpsGet(url: string, callback: (data: string | null, error?: Error) => void): void {
		if (typeof callback !== 'function') return;
		https
			.get(url, (res: IncomingMessage): void => {
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
			})
			.on('error', (e: Error): void => {
				callback(null, e);
			});
	}

	downloadFile(url: string, file: string, callback: (success: boolean, error?: Error) => void): void {
		this.httpsGet(url, (data, err): void => {
			if (err || !data) {
				if (typeof callback === 'function') callback(false, err);
				return;
			}
			writeFile('./data/' + file, data, (err2: NodeJS.ErrnoException | null): void => {
				if (err2) {
					if (typeof callback === 'function') callback(false, err2);
					return;
				}
				try {
					Tools.uncacheTree('./data/' + file);
				} catch (e) {}
				debug('Downloaded data file: ' + '../data/' + file);
				if (typeof callback === 'function') callback(true);
			});
		});
	}

	download(): void {
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

	getPokedex() {
		return require('../data/pokedex.js').BattlePokedex;
	}

	getMovedex() {
		return require('../data/moves.js').BattleMovedex;
	}

	getAbilities() {
		return require('../data/abilities.js').BattleAbilities;
	}

	getItems() {
		return require('../data/items.js').BattleItems;
	}

	getAliases() {
		return require('../data/aliases.js').BattleAliases;
	}

	getFormats() {
		return require('../data/formats.js').Formats;
	}

	getFormatsData() {
		return require('../data/formats-data.js').BattleFormatsData;
	}

	getLearnsets() {
		return require('../data/learnsets.js').BattleLearnsets;
	}
}
