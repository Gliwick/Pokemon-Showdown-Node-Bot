import { existsSync, readFileSync, rename, writeFile } from 'fs';
import { Array as Sugar } from 'sugar';
import { inspect } from 'util';

import { typechart } from '../../data/typechart';
import { SparseStatsTable, StatID, StatsTable } from '../../data/types-dex';
import { debug, error } from '../../log';
import { emptyIfDefault, isUndefinedOrEquals, splitLast, toId, uncacheTree } from '../../tools';
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
	name?: string;
	species: string;
	item?: string;
	ability?: string;
	moves: string[];
	nature?: string;
	evs?: StatsTable;
	gender?: string;
	ivs?: SparseStatsTable;
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
		const buf: string[] = [];
		for (let i = 0; i < team.length; i++) {
			const set = team[i];

			const name = set.name || set.species;
			const species = toId(set.species || set.name);
			const template = getPokemon(species || name);
			const ability =
				Object.entries(template?.abilities || {})
					.filter(([, ab]) => toId(set.ability) === toId(ab))
					.map(([key]) => key)[0] || toId(set.ability);
			const evs = Stats.map((stat) => (set.evs || {})[stat] || '');
			const ivs = Stats.map((stat) => (set.ivs || {})[stat]).map((v) => emptyIfDefault(v, 31));
			const misc: string[] = [
				set.hpType || '',
				toId(set.pokeball),
				set.gigantamax ? 'G' : '',
				emptyIfDefault(set.dynamaxLevel, 10),
				set.teraType || '',
			];

			const bufSet: string[] = [
				name,
				emptyIfDefault(species, name),
				toId(set.item),
				emptyIfDefault(ability, '0'),
				set.moves.map(toId).join(','),
				set.nature || '',
				evs.join('') ? evs.join(',') : '',
				emptyIfDefault(set.gender, template?.gender),
				ivs.join('') ? ivs.join(',') : '',
				set.shiny ? 'S' : '',
				emptyIfDefault(set.level, 100),
				emptyIfDefault(set.happiness, 255) + (misc.join('') ? ',' + misc.join(',') : ''),
			];
			buf.push(bufSet.join('|'));
		}
		return buf.join(']');
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
				curSet = { name: '', species: '', gender: '', item: '', ability: '', nature: '', moves: [], teraType: 'Normal' };
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
				const template = getPokemon(curSet.species);
				if (template) curSet.teraType = template.types[0];
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
			} else if (line.startsWith('Tera Type: ')) {
				line = line.substring('Tera Type: '.length);
				curSet.teraType = line;
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

	private unpackStats(buf: string, defaultValue: number): StatsTable {
		const stats = buf.split(',');
		return {
			hp: stats[0] ? Number(stats[0]) : defaultValue,
			atk: stats[1] ? Number(stats[1]) : defaultValue,
			def: stats[2] ? Number(stats[2]) : defaultValue,
			spa: stats[3] ? Number(stats[3]) : defaultValue,
			spd: stats[4] ? Number(stats[4]) : defaultValue,
			spe: stats[5] ? Number(stats[5]) : defaultValue,
		};
	}

	fastUnpackTeam(buf?: string): PokeSet[] {
		if (!buf) return [];

		const team: PokeSet[] = [];
		for (const bufSet of buf.split(']')) {
			const [name, species, item, ability, moves, nature, evs, gender, ivs, shiny, level, misc] = bufSet.split('|');
			const [happiness, hpType, pokeball, gigantamax, dynamaxLevel, teraType] = misc.split(',', 6);
			const template = getPokemon(species || name);
			const set: PokeSet = {
				name,
				species: species || name,
				item,
				ability: { ...(template?.abilities || {}) }[ability || '0'] || ability,
				moves: moves.split(','),
				nature,
				evs: this.unpackStats(evs, 0),
				gender,
				ivs: this.unpackStats(ivs, 31),
				shiny: !!shiny,
				level: level ? parseInt(level, 10) : 100,
				happiness: happiness ? Number(happiness) : 255,
				hpType,
				pokeball,
				gigantamax: !!gigantamax,
				dynamaxLevel: dynamaxLevel ? Number(happiness) : 10,
				teraType: teraType || template?.types[0] || 'Normal',
			};
			team.push(set);
		}
		return team;
	}

	exportTeam(team?: string | PokeSet[]): string {
		if (!team) return '';
		if (typeof team === 'string') {
			if (team.includes('\n')) return team;
			team = this.fastUnpackTeam(team);
		}
		const lines: string[] = [];
		for (let i = 0; i < team.length; i++) {
			const set: PokeSet = team[i];
			const name =
				set.name !== set.species
					? set.name + ' (' + (getPokemon(set.species)?.name || set.species) + ')'
					: getPokemon(set.species)?.name || set.species;
			const firstLine = [name];
			if (set.gender === 'M' || set.gender === 'F') firstLine.push('(' + set.gender + ')');
			if (set.item) {
				firstLine.push('@');
				firstLine.push(getItem(set.item)?.name || set.item);
			}
			lines.push(firstLine.join(' '));

			if (set.ability) {
				lines.push('Ability: ' + set.ability);
			}
			if (set.level && set.level !== 100) {
				lines.push('Level: ' + set.level);
			}
			if (set.shiny) {
				lines.push('Shiny: Yes');
			}
			if (set.teraType) {
				lines.push('Tera Type: ' + set.teraType);
			}
			if (typeof set.happiness === 'number' && set.happiness !== 255) {
				lines.push('Happiness: ' + set.happiness);
			}

			const { evs, ivs } = set;
			if (evs) {
				const evsStr = (Stats.map((stat) => [stat, evs[stat]]) as [StatID, number][])
					.filter(([, ev]) => !!ev && !isNaN(ev))
					.map(([stat, ev]) => ev + ' ' + BattleStatNames[stat])
					.join(' / ');
				if (evsStr) lines.push('EVs: ' + evsStr);
			}
			if (set.nature) {
				lines.push('' + set.nature + ' Nature');
			}
			if (ivs) {
				const hiddenPower = set.moves.filter((m) => m.startsWith('Hidden Power ') && !m.startsWith('Hidden Power ['))[0];
				const hpType = hiddenPower && hiddenPower.substring('Hidden Power '.length);
				const defaultIvs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31, ...((hpType && typechart[hpType]?.HPivs) || {}) };
				const ivsStr = (Stats.map((stat) => [stat, ivs[stat]]) as [StatID, number][])
					.filter(([stat, iv]) => !isNaN(iv) && !isUndefinedOrEquals(iv, defaultIvs[stat]))
					.map(([stat, iv]) => iv + ' ' + BattleStatNames[stat])
					.join(' / ');
				if (ivsStr) lines.push('IVs: ' + ivsStr);
			}

			set.moves
				.map((m) => {
					if (m.startsWith('Hidden Power ')) {
						return 'Hidden Power [' + m.substring('Hidden Power '.length) + ']';
					}
					return m;
				})
				.map((m) => '- ' + getMove(m)?.name || m)
				.forEach((line) => lines.push(line));

			lines.push('');
		}
		return lines.join('\n');
	}
}
