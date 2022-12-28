/*
 * Tools file
 */
import { lstatSync, readdirSync } from 'fs';
import { inspect } from 'util';

import { errlog, error, info, ok } from '../log';

export class Intl {
	translations: Record<
		string,
		{
			commands: Record<string, Record<string, string>>;
			globals: Record<string, Record<string, string>>;
		}
	> = {};

	/* Languages */

	loadLang(lang: string, reloading?: boolean): Intl['translations'][string] {
		const langToGlobals: Record<string, Record<string, string>> = {};
		const langToCommands: Record<string, Record<string, string>> = {};
		readdirSync('./languages/' + lang).forEach((file: string): void => {
			if (!file.endsWith('.json')) return;
			if (reloading) Tools.uncacheTree('../languages/' + lang + '/' + file);
			const { commands, ...globals } = require('../languages/' + lang + '/' + file);
			Object.assign(langToCommands, commands || {});
			Object.assign(langToGlobals, globals);
		});
		return { commands: langToCommands, globals: langToGlobals };
	}

	loadTranslations(reloading?: boolean): string[] {
		const errs: string[] = [];
		readdirSync('./languages').forEach((lang: string): void => {
			if (lstatSync('./languages/' + lang).isDirectory()) {
				try {
					this.translations[lang] = this.loadLang(lang, reloading);
				} catch (e: any) {
					errlog(e.stack);
					error('Could not import language: ./languages/' + lang + '/ | ' + inspect(e));
					errs.push(lang);
				}
			}
		});
		if (reloading)
			info(
				'Languages reloaded' +
					(errs.length ? '. Errors: ' + errs.join(', ') : '') +
					'. Languages: ' +
					Object.keys(this.translations).join(', ')
			);
		else
			ok(
				'Loaded languages' +
					(errs.length ? '. Errors: ' + errs.join(', ') : '') +
					'. Languages: ' +
					Object.keys(this.translations).join(', ')
			);
		return errs;
	}

	translateCmd(cmd: string, data: string, lang: string): string {
		if (this.translations[lang] && this.translations[lang].commands && this.translations[lang].commands[cmd]) {
			return this.translations[lang].commands[cmd][data];
		} else {
			lang = 'english';
			if (
				!this.translations[lang] ||
				!this.translations[lang].commands ||
				!this.translations[lang].commands[cmd]
			) {
				return '__(not found)__';
			} else {
				return this.translations[lang].commands[cmd][data];
			}
		}
	}

	translateGlobal(glob: string, data: string, lang: string): string {
		return (
			this.translations[lang]?.globals?.[glob]?.[data] ||
			this.translations['english']?.globals?.[glob]?.[data] ||
			'__(not found)__'
		);
	}
}
