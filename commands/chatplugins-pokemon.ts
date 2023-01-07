/*
 * Pokemon-related commands
 */

import { Command, CommandModuleManager } from '../command-parser';
import { AbilityData } from '../data/types-abilities';
import { ItemData } from '../data/types-items';
import { MoveData } from '../data/types-moves';
import { LearnsetData, SpeciesData, SpeciesFormatsData } from '../data/types-species';
import { debug } from '../log';
import { getGroup, levenshtein, normalize, toId, toName } from '../tools';

class PokemonModule implements CommandModuleManager {
	init(): void {
		Settings.addPermissions(['pokemon']);
	}
}

export const manager = PokemonModule;

const LangAliases: Record<string, string> = { en: 'english' };

interface SearchResult {
	type: string;
	id: string;
	title: string;
	levenstein: number;
}

function searchInLanguage(lang: string, word: string, keys: string[]): SearchResult[] | null {
	const dataLang = Languages.translations[lang]?.globals;
	if (!dataLang) return null;
	if (word.length <= 1) {
		return null;
	}

	const maxLevenstein = Math.min(Math.floor((word.length - 1) / 2), 3) || 1;
	const results: SearchResult[] = keys
		.flatMap((key) => Object.entries(dataLang[key]).map((entry) => [key].concat(entry)))
		.filter(([, , title]) => !!title)
		.map(([type, id, title]) => {
			const levenstein = levenshtein(word, normalize(title), maxLevenstein);
			return { type, id, title, levenstein };
		})
		.filter((result) => result.levenstein <= maxLevenstein);
	const minLevenstein = Math.min(...results.map((result) => result.levenstein));
	return results.filter((result) => result.levenstein === minLevenstein);
}

interface Translation {
	type: string;
	from: string;
	to: string;
	levenstein: number;
}

function getTranslations(from: string, to: string, word: string): Translation[] | null {
	word = normalize(word);
	const toLangData = Languages.translations[to]?.globals;
	if (!toLangData) return null;
	const ids = searchInLanguage(from, word, ['abilities', 'items', 'moves', 'natures', 'pokemon']);
	if (!ids?.length) return null;
	return ids
		.filter((id) => !!toLangData[id.type]?.[id.id])
		.map((id) => {
			return { type: id.type, from: id.title, to: toLangData[id.type][id.id], levenstein: id.levenstein };
		});
}

function getData(): {
	pokedex?: Record<string, SpeciesData>;
	movedex?: Record<string, MoveData>;
	abilities?: Record<string, AbilityData>;
	items?: Record<string, ItemData>;
	aliases?: Record<string, string>;
	formatsData?: Record<string, SpeciesFormatsData>;
	learnsets?: Record<string, LearnsetData>;
} {
	try {
		return {
			pokedex: DataDownloader.getPokedex(),
			movedex: DataDownloader.getMovedex(),
			abilities: DataDownloader.getAbilities(),
			items: DataDownloader.getItems(),
			aliases: DataDownloader.getAliases(),
			formatsData: DataDownloader.getFormatsData(),
			learnsets: DataDownloader.getLearnsets(),
		};
	} catch (e: any) {
		return {};
	}
}

function getPokemonMoves(pokemon: string, filter: (move: any) => boolean): string[] | null {
	const { pokedex, movedex, learnsets } = getData();
	if (!pokedex || !movedex || !learnsets) return null;
	const pokemonToCheck: string[] = [];
	while (pokemon) {
		pokemonToCheck.push(pokemon);
		pokemon = toId(pokedex[pokemon].prevo);
	}
	return Array.from(
		new Set<string>(
			pokemonToCheck
				.filter((pokemon) => !!learnsets[pokemon])
				.flatMap((pokemon) => Object.keys(learnsets[pokemon].learnset || {}))
				.map((move) => movedex[move])
				.filter((move) => move && filter(move))
				.map((move) => move.name as string)
		)
	).sort();
}

export const commands: Record<string, string | Command> = {
	tra: 'translate',
	trans: 'translate',
	translate: function (arg) {
		if (!arg) return this.restrictReply(this.trad('u1') + ': ' + this.cmdToken + this.cmd + ' ' + this.trad('u2'), 'pokemon');
		const args = arg.split(',');
		let word = args[0];
		let from: string = toId(args[1] || '');
		let to: string = toId(args[2] || '');
		let bidirectional = false;
		if (this.language !== 'english' && !from && !to) {
			from = this.language;
			to = 'english';
			bidirectional = true;
		}
		if (from && !to && from !== 'english') {
			to = 'english';
		}
		if (LangAliases[from]) from = LangAliases[from];
		if (LangAliases[to]) to = LangAliases[to];
		if (!from || !to || from === to || !word) {
			return this.restrictReply(`${this.trad('u1')}: ${this.cmdToken + this.cmd} ${this.trad('u2')}`, 'pokemon');
		}
		const validlangs = Object.keys(Languages.translations);
		if (!validlangs.includes(from)) {
			return this.restrictReply(`${this.trad('lnot1')} "${from}" ${this.trad('lnot2')}: ${validlangs.join(', ')}`, 'pokemon');
		}
		if (!validlangs.includes(to)) {
			return this.restrictReply(`${this.trad('lnot1')} "${to}" ${this.trad('lnot2')}: ${validlangs.join(', ')}`, 'pokemon');
		}

		if (from === 'english' || (to === 'english' && bidirectional)) {
			try {
				const aliases = DataDownloader.getAliases();
				if (aliases[toId(word)]) word = aliases[toId(word)];
			} catch (e: any) {
				debug('Could not fetch aliases. Cmd: ' + this.cmd + ' ' + arg + ' | Room: ' + this.room + ' | By: ' + this.by);
			}
		}
		// translation itself
		let translations = getTranslations(from, to, word);
		if (bidirectional) {
			const translationsInv = getTranslations(to, from, word);
			if (translationsInv?.length) {
				if (!translations?.length || translationsInv[0].levenstein < translations[0].levenstein) {
					translations = translationsInv;
					const temp = to;
					to = from;
					from = temp;
				}
			}
		}
		if (!translations?.length) {
			return this.restrictReply(`${this.trad('not1')} "${word}" ${this.trad('not2')} (${from} - ${to})`, 'pokemon');
		}

		const translationsFrom = translations[0].from;
		const text =
			(normalize(translationsFrom) !== normalize(word) ? `${this.trad('not1')} "${word}" ${this.trad('not3')}. ` : '') +
			`${this.trad('tra')} **${toName(translationsFrom)}** (${from} - ${to}): ` +
			translations
				.filter((t) => normalize(translationsFrom) === normalize(t.from))
				.map((t) => `**${toName(t.to)}** (${this.trad(t.type) || t.type})`)
				.join(', ');
		this.restrictReply(text, 'pokemon');
	},

	poke: 'randompokemon',
	randompoke: 'randompokemon',
	rpoke: 'randompokemon',
	randompokemon: function (arg, by, room, cmd) {
		const { pokedex } = getData();
		if (!pokedex) {
			return this.pmReply(this.trad('err'));
		}
		const pokeList = Object.values(pokedex);
		const rpoke = pokeList[Math.floor(Math.random() * pokeList.length)].name;
		if (!this.can('pokemon')) return this.pmReply(rpoke);
		if (cmd === 'poke' && this.botRanked(getGroup('voice'))) return this.reply('!dt ' + rpoke);
		this.reply(rpoke);
	},

	gen: function (arg) {
		const { pokedex, aliases, movedex, abilities, items } = getData();
		if (!pokedex || !aliases || !movedex || !abilities || !items) {
			return this.pmReply(this.trad('err'));
		}
		let id = toId(arg);
		if (!id.length) return this.restrictReply(this.trad('err2'), 'pokemon');
		if (aliases[id]) id = toId(aliases[id]);
		let text = this.trad('g') + ' ' + id + ': ';
		if (id === 'metronome') {
			text += 'Move: Gen 1; Item: Gen 4';
		} else if (pokedex[id]) {
			if (pokedex[id].num < 0) text += 'CAP';
			else if (pokedex[id].num <= 151) text += 'Gen 1';
			else if (pokedex[id].num <= 251) text += 'Gen 2';
			else if (pokedex[id].num <= 386) text += 'Gen 3';
			else if (pokedex[id].num <= 493) text += 'Gen 4';
			else if (pokedex[id].num <= 649) text += 'Gen 5';
			else text += 'Gen 6';
		} else if (movedex[id]) {
			const num = movedex[id].num;
			if (!num) text += 'CAP';
			else if (num <= 165) text += 'Gen 1';
			else if (num <= 251) text += 'Gen 2';
			else if (num <= 354) text += 'Gen 3';
			else if (num <= 467) text += 'Gen 4';
			else if (num <= 559) text += 'Gen 5';
			else if (num <= 617) text += 'Gen 6';
			else text += 'CAP';
		} else if (abilities[id]) {
			const num = abilities[id].num;
			if (!num || num <= 0) text += 'CAP';
			else if (num <= 76) text += 'Gen 3';
			else if (num <= 123) text += 'Gen 4';
			else if (num <= 164) text += 'Gen 5';
			else text += 'Gen 6';
		} else if (items[id]) {
			text += 'Gen ' + items[id].gen;
		} else {
			return this.restrictReply(this.trad('nfound'), 'pokemon');
		}
		this.restrictReply(text, 'pokemon');
	},

	viablemoves: 'randommoves',
	randommoves: function (arg) {
		const { aliases, formatsData, movedex } = getData();
		if (!aliases || !formatsData || !movedex) {
			return this.pmReply(this.trad('err'));
		}
		const args = arg.split(',');
		let text = '__' + this.trad('r') + '__: ';
		let whichRandom: keyof SpeciesFormatsData = 'randomBattleMoves';
		const gameType = toId(args[1]);
		if (gameType && (gameType.startsWith('double') || gameType.startsWith('triple') || ['2', '3'].includes(gameType))) {
			whichRandom = 'randomDoubleBattleMoves';
			text = '__' + this.trad('rd') + '__: ';
		}
		let pokemon = toId(args[0]);
		if (!pokemon.length) return this.restrictReply(this.trad('err2'), 'pokemon');
		if (aliases[pokemon]) pokemon = toId(aliases[pokemon]);
		if (formatsData[pokemon]) {
			const moves = (formatsData[pokemon][whichRandom] || []).map((i) => movedex[i].name).join(', ');
			if (moves === '') text += 'none';
			else text += moves.substring(2);
			this.restrictReply(text, 'pokemon');
		} else {
			return this.restrictReply(this.trad('nfound'), 'pokemon');
		}
	},

	heatcrash: 'heavyslam',
	heavyslam: function (arg) {
		const { pokedex, aliases } = getData();
		if (!pokedex || !aliases) {
			return this.pmReply(this.trad('err'));
		}
		let text = '';
		const pokemon = arg.split(',');
		let weight0, weight1;
		if (pokemon.length < 2) return this.restrictReply(this.trad('err2'), 'pokemon');
		pokemon[0] = toId(pokemon[0]);
		pokemon[1] = toId(pokemon[1]);
		if (aliases[pokemon[0]]) pokemon[0] = toId(aliases[pokemon[0]]);
		if (aliases[pokemon[1]]) pokemon[1] = toId(aliases[pokemon[1]]);
		if (pokedex[pokemon[0]]) weight0 = pokedex[pokemon[0]].weightkg;
		else return this.restrictReply(this.trad('n1'), 'pokemon');
		if (pokedex[pokemon[1]]) weight1 = pokedex[pokemon[1]].weightkg;
		else return this.restrictReply(this.trad('n2'), 'pokemon');
		text += this.trad('s') + ': ';
		if (weight0 / weight1 <= 2) text += '40';
		else if (weight0 / weight1 <= 3) text += '60';
		else if (weight0 / weight1 <= 4) text += '80';
		else if (weight0 / weight1 <= 5) text += '100';
		else text += '120';
		this.restrictReply(text, 'pokemon');
	},

	preevo: 'prevo',
	prevo: function (arg) {
		const { pokedex, aliases } = getData();
		if (!pokedex || !aliases) {
			return this.pmReply(this.trad('err'));
		}
		let text = '';
		let pokemon = toId(arg);
		if (aliases[pokemon]) pokemon = toId(aliases[pokemon]);
		if (pokedex[pokemon]) {
			if (pokedex[pokemon].prevo) {
				text += pokedex[pokemon].prevo;
			} else text += this.trad('p1') + ' ' + pokemon + ' ' + this.trad('p2');
		} else {
			text += this.trad('nfound');
		}
		this.restrictReply(text, 'pokemon');
	},

	priority: function (arg) {
		const { pokedex, aliases } = getData();
		if (!pokedex || !aliases) {
			return this.pmReply(this.trad('err'));
		}
		let text = '';
		arg = toId(arg);
		if (aliases[arg]) arg = toId(aliases[arg]);
		if (pokedex[arg]) {
			const prioritymoves = getPokemonMoves(arg, (move) => move.priority > 0 && move.basePower > 0);
			if (prioritymoves === null) {
				return this.pmReply(this.trad('err'));
			}
			text += prioritymoves.join(', ');
		} else {
			text += this.trad('err2');
		}
		if (!text) text = this.trad('err3');
		this.restrictReply(text, 'pokemon');
	},

	boosting: function (arg) {
		const { pokedex, aliases } = getData();
		if (!pokedex || !aliases) {
			return this.pmReply(this.trad('err'));
		}
		let text = '';
		arg = toId(arg);
		if (aliases[arg]) arg = toId(aliases[arg]);
		if (pokedex[arg]) {
			const boostingmoves = getPokemonMoves(
				arg,
				(move) =>
					(move.boosts && move.target === 'self' && move.id !== 'doubleteam' && move.id !== 'minimize') ||
					move.id === 'bellydrum' ||
					(move.secondary && move.secondary.chance === 100 && move.secondary.self && move.secondary.self.boosts)
			);
			if (boostingmoves === null) {
				return this.pmReply(this.trad('err'));
			}
			text += boostingmoves.join(', ');
		} else {
			text += this.trad('err2');
		}
		if (text === '') text = this.trad('err3');
		this.restrictReply(text, 'pokemon');
	},

	recovery: function (arg) {
		const { pokedex, aliases } = getData();
		if (!pokedex || !aliases) {
			return this.pmReply(this.trad('err'));
		}
		let text = '';
		arg = toId(arg);
		if (aliases[arg]) arg = toId(aliases[arg]);
		if (pokedex[arg]) {
			const recoveryAndDrainMoves = getPokemonMoves(
				arg,
				(move) =>
					move.heal ||
					move.drain ||
					['moonlight', 'morningsun', 'rest', 'shoreup', 'swallow', 'synthesis', 'wish'].includes(move.id)
			);
			if (recoveryAndDrainMoves === null) {
				return this.pmReply(this.trad('err'));
			}
			text += recoveryAndDrainMoves.join(', ');
		} else {
			text += this.trad('err2');
		}
		if (text === '') text = this.trad('err3');
		this.restrictReply(text, 'pokemon');
	},

	hazards: 'hazard',
	hazard: function (arg) {
		const { pokedex, aliases } = getData();
		if (!pokedex || !aliases) {
			return this.pmReply(this.trad('err'));
		}
		let text = '';
		arg = toId(arg);
		if (aliases[arg]) arg = toId(aliases[arg]);
		if (pokedex[arg]) {
			const hazards = getPokemonMoves(arg, (move) => ['spikes', 'stealthrock', 'stickyweb', 'toxicspikes'].includes(move.id));
			if (hazards === null) {
				return this.pmReply(this.trad('err'));
			}
			if (arg === 'copperajahgmax') hazards.push('gmaxsteelsurge');
			if (arg === 'drednawgmax') hazards.push('gmaxstonesurge');
			text += hazards.sort().join(', ');
		} else {
			text += this.trad('err2');
		}
		if (text === '') text = this.trad('err3');
		this.restrictReply(text, 'pokemon');
	},
};
