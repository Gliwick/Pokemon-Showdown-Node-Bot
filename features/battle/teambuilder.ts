import { existsSync, readFileSync, rename, writeFile } from 'fs';
import { Array as Sugar } from 'sugar';
import { inspect } from 'util';

import { typechart } from '../../data/typechart';
import { StatID } from '../../data/types-dex';
import { SpeciesData } from '../../data/types-species';
import { debug, errlog, error } from '../../log';
import { isUndefinedOrEquals, splitLast, toId, uncacheTree } from '../../tools';
import { getItem, getMove, getPokemon } from './data';

const TEAMS_DATA_FILE = AppOptions.data + 'teams.json';

interface RandomTeam {
	maxPokemon: number;
	pokemon: PokeSet[];
	essentialPokemon?: PokeSet[];
}

type Team = string | PokeSet[] | RandomTeam;

const Stats: StatID[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

const BattleStatIDs: Record<string, StatID> = {
	HP: 'hp',
	hp: 'hp',
	Atk: 'atk',
	atk: 'atk',
	Def: 'def',
	def: 'def',
	SpA: 'spa',
	SAtk: 'spa',
	SpAtk: 'spa',
	spa: 'spa',
	SpD: 'spd',
	SDef: 'spd',
	SpDef: 'spd',
	spd: 'spd',
	Spe: 'spe',
	Spd: 'spe',
	spe: 'spe',
};

const BattleStatNames: Record<StatID, string> = {
	hp: 'HP',
	atk: 'Atk',
	def: 'Def',
	spa: 'SpA',
	spd: 'SpD',
	spe: 'Spe',
};

interface PokeSet {
	name: string;
	species: string;
	item: string;
	ability: string;
	moves: string[];
	nature: string;
	evs?: Record<StatID, number>;
	gender?: string;
	ivs?: Partial<Record<StatID, number>>;
	shiny?: boolean;
	level?: number;
	happiness?: number;
	pokeball?: string;
	hpType?: string;
	gigantamax?: boolean;
	dynamaxLevel?: number;
	teraType?: string;
}

export class TeamBuilder {
	teams: Record<string, Team[]> = {};
	staticTeams: Record<string, Team[]> = {};
	dynTeams: Record<string, { format: string; packed: string }> = {};

	writing = false;
	writePending = false;

	loadTeamList(reloading?: boolean): boolean {
		try {
			if (reloading) uncacheTree('./features/battle/teams.js');
			this.staticTeams = require('./teams.js').teams;
			if (!existsSync(TEAMS_DATA_FILE)) {
				this.dynTeams = {};
			} else {
				this.dynTeams = JSON.parse(readFileSync(TEAMS_DATA_FILE).toString());
			}
			this.mergeTeams();
			return true;
		} catch (e: any) {
			error('failed to load teams: ' + inspect(e));
			return false;
		}
	}

	mergeTeams(): void {
		this.teams = {};
		Object.assign(this.teams, this.staticTeams);
		for (const i in this.dynTeams) {
			const team = this.dynTeams[i];
			if (!this.teams[team.format]) this.teams[team.format] = [];
			this.teams[team.format].push(team.packed);
		}
	}

	addTeam(name: string, format: string, packed: string): boolean {
		if (this.dynTeams[name]) return false;
		this.dynTeams[name] = {
			format: format,
			packed: packed,
		};
		this.mergeTeams();
		this.saveTeams();
		return true;
	}

	removeTeam(name: string): boolean {
		if (!this.dynTeams[name]) return false;
		delete this.dynTeams[name];
		this.mergeTeams();
		this.saveTeams();
		return true;
	}

	saveTeams(): void {
		const data = JSON.stringify(this.dynTeams);
		const finishWriting = ((): void => {
			this.writing = false;
			if (this.writePending) {
				this.writePending = false;
				this.saveTeams();
			}
		}).bind(this);
		if (this.writing) {
			this.writePending = true;
			return;
		}
		writeFile(TEAMS_DATA_FILE + '.0', data, (): void => {
			// rename is atomic on POSIX, but will throw an error on Windows
			rename(TEAMS_DATA_FILE + '.0', TEAMS_DATA_FILE, (err: NodeJS.ErrnoException | null): void => {
				if (err) {
					// This should only happen on Windows.
					writeFile(TEAMS_DATA_FILE, data, finishWriting);
					return;
				}
				finishWriting();
			});
		});
	}

	getTeam(format: string): string | false {
		const formatId = toId(format);
		const teamStuff = this.teams[formatId];
		if (!teamStuff || !teamStuff.length) return false;
		const teamChosen = teamStuff[Math.floor(Math.random() * teamStuff.length)]; //choose team
		let teamStr = '';
		try {
			if (typeof teamChosen === 'string') {
				// already parsed
				teamStr = teamChosen;
			} else if (Array.isArray(teamChosen)) {
				//parse team
				teamStr = this.packTeam(teamChosen);
			} else if (typeof teamChosen === 'object' && teamChosen.maxPokemon && teamChosen.pokemon) {
				// generate random team
				const team: PokeSet[] = [];
				const hasSpecies: Record<string, boolean> = {};
				if (teamChosen.essentialPokemon) {
					for (const poke of teamChosen.essentialPokemon) {
						team.push(poke);
						hasSpecies[poke.species] = true;
					}
				}
				const pokes = Sugar.shuffle(teamChosen.pokemon);
				for (let i = 0; team.length < teamChosen.maxPokemon; i++) {
					if (!hasSpecies[pokes[i].species]) {
						team.push(pokes[i]);
						hasSpecies[pokes[i].species] = true;
					}
				}
				if (Config.debug.debug) debug('Packed Team: ' + JSON.stringify(team));
				teamStr = this.packTeam(team);
			} else {
				error('invalid team data type: ' + JSON.stringify(teamChosen));
				return false;
			}
			return teamStr;
		} catch (e: any) {
			error(e.stack);
			return false;
		}
	}

	hasTeam(format: string): boolean {
		const formatId = toId(format);
		if (this.teams[formatId]) return true;
		return false;
	}

	private getPokeSets(team: Team): PokeSet[] {
		if (typeof team === 'string') return this.fastUnpackTeam(team);
		if (!Array.isArray(team)) return [...(team.essentialPokemon || []), ...team.pokemon];
		return team;
	}

	teamOverview(team: Team): string {
		const pokes = this.getPokeSets(team).map((p) => p.species);
		if (!pokes.length) return '(empty)';
		return pokes.join(', ');
	}

	/* Pack Team function - from Pokemon-Showdown-Client */

	packTeam(team?: PokeSet[]): string {
		if (!team) return '';
		let buf = '';
		for (let i = 0; i < team.length; i++) {
			const set = team[i];
			if (buf) buf += ']';
			// name
			buf += set.name || set.species;
			// species
			let id = toId(set.species || set.name);
			buf += '|' + (toId(set.name || set.species) === id ? '' : id);
			// item
			buf += '|' + toId(set.item);
			// ability
			let template: SpeciesData | null = null;
			try {
				template = DataDownloader.getPokedex()[toId(set.species || set.name)];
			} catch (e: any) {
				errlog(e.stack);
			}
			if (!template) return '';
			const abilities = template.abilities;
			id = toId(set.ability);
			if (abilities) {
				if (abilities['0'] && id === toId(abilities['0'])) {
					buf += '|';
				} else if (abilities['1'] && id === toId(abilities['1'])) {
					buf += '|1';
				} else if (abilities['H'] && id === toId(abilities['H'])) {
					buf += '|H';
				} else {
					buf += '|' + id;
				}
			} else {
				buf += '|' + id;
			}
			// moves
			buf += '|' + set.moves.map(toId).join(',');
			// nature
			buf += '|' + set.nature;
			// evs
			let evs = '|';
			if (set.evs) {
				evs =
					'|' +
					(set.evs['hp'] || '') +
					',' +
					(set.evs['atk'] || '') +
					',' +
					(set.evs['def'] || '') +
					',' +
					(set.evs['spa'] || '') +
					',' +
					(set.evs['spd'] || '') +
					',' +
					(set.evs['spe'] || '');
			}
			if (evs === '|,,,,,') {
				buf += '|';
			} else {
				buf += evs;
			}
			// gender
			if (set.gender && set.gender !== template.gender) {
				buf += '|' + set.gender;
			} else {
				buf += '|';
			}
			// ivs
			let ivs = '|';
			const setIvs = set.ivs;
			if (setIvs) {
				Stats.map((stat) => setIvs[stat])
					.map((v) => (isUndefinedOrEquals(v, 31) ? '' : v))
					.join(',');
				ivs =
					'|' +
					Stats.map((stat) => setIvs[stat])
						.map((v) => (isUndefinedOrEquals(v, 31) ? '' : v))
						.join(',');
			}
			if (ivs === '|,,,,,') {
				buf += '|';
			} else {
				buf += ivs;
			}
			// shiny
			if (set.shiny) {
				buf += '|S';
			} else {
				buf += '|';
			}
			// level
			if (set.level && set.level !== 100) {
				buf += '|' + set.level;
			} else {
				buf += '|';
			}
			// happiness
			if (!isUndefinedOrEquals(set.happiness, 255)) {
				buf += '|' + set.happiness;
			} else {
				buf += '|';
			}

			if (set.pokeball || set.hpType || set.gigantamax || !isUndefinedOrEquals(set.dynamaxLevel, 10) || set.teraType) {
				buf += ',' + (set.hpType || '');
				buf += ',' + toId(set.pokeball);
				buf += ',' + (set.gigantamax ? 'G' : '');
				buf += ',' + (!isUndefinedOrEquals(set.dynamaxLevel, 10) ? set.dynamaxLevel : '');
				buf += ',' + (set.teraType || '');
			}
		}
		return buf;
	}

	teamToJSON(text: string): any[] {
		const lines = text.split('\n');
		const team = [];
		let curSet: PokeSet | null = null;
		for (let i = 0; i < lines.length; i++) {
			let line = lines[i].trim();
			if (line === '' || line === '---') {
				curSet = null;
			} else if (!curSet) {
				curSet = { name: '', species: '', gender: '', item: '', ability: '', nature: '', moves: [] };
				team.push(curSet);
				const [newLine, item] = splitLast(line, ' @ ');
				if (item) {
					curSet.item = toId(item) === 'noitem' ? '' : item;
					line = newLine;
				}
				if (line.endsWith(' (M)') || line.endsWith(' (F)')) {
					const [newLine, gender] = splitLast(line, ' (');
					curSet.gender = gender.split(')')[0];
					line = newLine;
				}
				if (line.endsWith(')') && line.includes(' (')) {
					const [name, species] = splitLast(line, ' (');
					curSet.species = species.split(')')[0];
					curSet.name = name;
				} else {
					curSet.species = line;
					curSet.name = line;
				}
			} else if (line.startsWith('Trait: ')) {
				line = line.substring('Trait: '.length);
				curSet.ability = line;
			} else if (line.startsWith('Ability: ')) {
				line = line.substring('Ability: '.length);
				curSet.ability = line;
			} else if (line === 'Shiny: Yes') {
				curSet.shiny = true;
			} else if (line.startsWith('Level: ')) {
				line = line.substring('Level: '.length);
				curSet.level = parseInt(line);
			} else if (line.startsWith('Happiness: ')) {
				line = line.substring('Happiness: '.length);
				curSet.happiness = parseInt(line);
			} else if (line.startsWith('EVs: ')) {
				line = line.substring('EVs: '.length);
				const evLines = line.split('/');
				curSet.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
				for (let j = 0; j < evLines.length; j++) {
					const evLine = evLines[j].trim();
					const [statvalStr, statidStr] = evLine.split(' ', 2);
					if (!statidStr) continue;
					const statid = BattleStatIDs[statidStr];
					const statval = parseInt(statvalStr);
					if (!statid) continue;
					curSet.evs[statid] = statval;
				}
			} else if (line.startsWith('IVs: ')) {
				line = line.substring('IVs: '.length);
				const ivLines = line.split(' / ');
				curSet.ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
				for (let j = 0; j < ivLines.length; j++) {
					const ivLine = ivLines[j];
					const [statvalStr, statidStr] = ivLine.split(' ', 2);
					if (!statidStr) continue;
					const statid = BattleStatIDs[statidStr];
					const statval = parseInt(statvalStr);
					if (!statid) continue;
					curSet.ivs[statid] = statval;
				}
			} else if (line.match(/^[A-Za-z]+ (N|n)ature/)) {
				line = line.replace(' Nature', ' nature').split(' nature')[0];
				curSet.nature = line;
			} else if (line.startsWith('-') || line.startsWith('~')) {
				line = line.substring(1).trimStart();
				if (line.startsWith('Hidden Power [')) {
					const hptype = line.split('[')[1].split(']')[0];
					line = 'Hidden Power ' + hptype;
					if (!curSet.ivs) {
						curSet.ivs = { ...typechart[hptype].HPivs };
					}
				}
				if (line === 'Frustration') {
					curSet.happiness = 0;
				}
				curSet.moves.push(line);
			}
		}
		return team;
	}

	fastUnpackTeam(buf?: string): PokeSet[] {
		if (!buf) return [];

		const team: PokeSet[] = [];
		let i = 0,
			j = 0;

		while (true) {
			const set: PokeSet = {
				name: '',
				species: '',
				item: '',
				ability: '',
				moves: [],
				nature: '',
				gender: '',
				level: 100,
				happiness: 0,
			};
			team.push(set);

			// name
			j = buf.indexOf('|', i);
			set.name = buf.substring(i, j);
			i = j + 1;

			// species
			j = buf.indexOf('|', i);
			set.species = buf.substring(i, j) || set.name;
			i = j + 1;

			// item
			j = buf.indexOf('|', i);
			set.item = buf.substring(i, j);
			i = j + 1;

			// ability
			j = buf.indexOf('|', i);
			const ability: string = buf.substring(i, j) || '0';
			const template = getPokemon(set.species);
			set.ability = { ...(template?.abilities || {}) }[ability] || ability;
			i = j + 1;

			// moves
			j = buf.indexOf('|', i);
			set.moves = buf.substring(i, j).split(',');
			i = j + 1;

			// nature
			j = buf.indexOf('|', i);
			set.nature = buf.substring(i, j);
			i = j + 1;

			// evs
			j = buf.indexOf('|', i);
			if (j !== i) {
				const evs = buf.substring(i, j).split(',');
				set.evs = {
					hp: Number(evs[0]) || 0,
					atk: Number(evs[1]) || 0,
					def: Number(evs[2]) || 0,
					spa: Number(evs[3]) || 0,
					spd: Number(evs[4]) || 0,
					spe: Number(evs[5]) || 0,
				};
			}
			i = j + 1;

			// gender
			j = buf.indexOf('|', i);
			if (i !== j) set.gender = buf.substring(i, j);
			i = j + 1;

			// ivs
			j = buf.indexOf('|', i);
			if (j !== i) {
				const ivs = buf.substring(i, j).split(',');
				set.ivs = {
					hp: ivs[0] === '' ? 31 : Number(ivs[0]),
					atk: ivs[1] === '' ? 31 : Number(ivs[1]),
					def: ivs[2] === '' ? 31 : Number(ivs[2]),
					spa: ivs[3] === '' ? 31 : Number(ivs[3]),
					spd: ivs[4] === '' ? 31 : Number(ivs[4]),
					spe: ivs[5] === '' ? 31 : Number(ivs[5]),
				};
			}
			i = j + 1;

			// shiny
			j = buf.indexOf('|', i);
			if (i !== j) set.shiny = true;
			i = j + 1;

			// level
			j = buf.indexOf('|', i);
			if (i !== j) set.level = parseInt(buf.substring(i, j), 10);
			i = j + 1;

			// happiness
			j = buf.indexOf(']', i);
			if (j < 0) {
				if (buf.substring(i)) {
					set.happiness = Number(buf.substring(i));
				}
				break;
			}
			if (i !== j) set.happiness = Number(buf.substring(i, j));
			i = j + 1;
		}
		return team;
	}

	exportTeam(team?: string | PokeSet[]): string {
		if (!team) return '';
		if (typeof team === 'string') {
			if (team.indexOf('\n') >= 0) return team;
			team = this.fastUnpackTeam(team);
		}
		let text = '';
		for (let i = 0; i < team.length; i++) {
			const curSet = team[i];
			if (curSet.name !== curSet.species) {
				text += '' + curSet.name + ' (' + (getPokemon(curSet.species)?.name || curSet.species) + ')';
			} else {
				text += '' + (getPokemon(curSet.species)?.name || curSet.species);
			}
			if (curSet.gender === 'M') text += ' (M)';
			if (curSet.gender === 'F') text += ' (F)';
			if (curSet.item) {
				curSet.item = getItem(curSet.item)?.name || curSet.item;
				text += ' @ ' + curSet.item;
			}
			text += '\n';
			if (curSet.ability) {
				text += 'Ability: ' + curSet.ability + '\n';
			}
			if (curSet.level && curSet.level !== 100) {
				text += 'Level: ' + curSet.level + '\n';
			}
			if (curSet.shiny) {
				text += 'Shiny: Yes\n';
			}
			if (typeof curSet.happiness === 'number' && curSet.happiness !== 255) {
				text += 'Happiness: ' + curSet.happiness + '\n';
			}
			let first = true;
			const { evs } = curSet;
			if (evs) {
				Stats.forEach((j) => {
					if (!evs[j]) return;
					if (first) {
						text += 'EVs: ';
						first = false;
					} else {
						text += ' / ';
					}
					text += '' + evs[j] + ' ' + BattleStatNames[j];
				});
			}
			if (!first) {
				text += '\n';
			}
			if (curSet.nature) {
				text += '' + curSet.nature + ' Nature' + '\n';
			}
			first = true;
			const { ivs } = curSet;
			if (ivs) {
				let defaultIvs = true;
				let hpType: string | null = null;
				for (let j = 0; j < curSet.moves.length; j++) {
					const move = curSet.moves[j];
					if (move.substr(0, 13) === 'Hidden Power ' && move.substr(0, 14) !== 'Hidden Power [') {
						hpType = move.substr(13);
						if (!hpType || !typechart[hpType]?.HPivs) {
							continue;
						}
						if (Stats.some((stat) => (ivs[stat] ?? 31) !== (typechart[hpType as string].HPivs?.[stat] || 31))) {
							defaultIvs = false;
						}
					}
				}
				if (defaultIvs && !hpType) {
					if (Stats.some((stat) => !isUndefinedOrEquals(ivs[stat], 31))) {
						defaultIvs = false;
					}
				}
				if (!defaultIvs) {
					Stats.forEach((stat) => {
						const iv = ivs[stat];
						if (!iv || isNaN(iv) || iv === 31) return;
						if (first) {
							text += 'IVs: ';
							first = false;
						} else {
							text += ' / ';
						}
						text += '' + iv + ' ' + BattleStatNames[stat];
					});
				}
			}
			if (!first) {
				text += '\n';
			}
			for (let j = 0; j < curSet.moves.length; j++) {
				let move = curSet.moves[j];
				if (move.substr(0, 13) === 'Hidden Power ') {
					move = move.substr(0, 13) + '[' + move.substr(13) + ']';
				}
				text += '- ' + (getMove(move)?.name || move) + '\n';
			}
			text += '\n';
		}
		return text;
	}
}
