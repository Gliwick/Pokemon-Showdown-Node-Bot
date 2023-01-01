import { existsSync, readFileSync, rename, writeFile } from 'fs';
import { inspect } from 'util';

import { debug, error } from '../../log';
import { PokeSet, toId } from '../../tools';

const TEAMS_DATA_FILE = AppOptions.data + 'teams.json';

interface RandomTeam {
	maxPokemon: number;
	pokemon: PokeSet[];
	essentialPokemon?: PokeSet[];
}

type Team = string | PokeSet[] | RandomTeam;

export class TeamBuilder {
	teams: Record<string, Team[]> = {};
	staticTeams: Record<string, Team[]> = {};
	dynTeams: Record<string, { format: string; packed: string }> = {};

	writing = false;
	writePending = false;

	loadTeamList(reloading?: boolean): boolean {
		try {
			if (reloading) Tools.uncacheTree('./features/battle/teams.js');
			this.staticTeams = require('./teams.js').teams;
			if (!existsSync(TEAMS_DATA_FILE)) {
				this.dynTeams = {};
			} else {
				this.dynTeams = JSON.parse(readFileSync(TEAMS_DATA_FILE).toString());
			}
			this.mergeTeams();
			return true;
		} catch (e) {
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
				const team = [];
				const hasSpecies: Record<string, boolean> = {};
				if (teamChosen.essentialPokemon) {
					for (const poke of teamChosen.essentialPokemon) {
						team.push(poke);
						hasSpecies[poke.species] = true;
					}
				}
				const pokes = teamChosen.pokemon.randomize();
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

	/* Pack Team function - from Pokemon-Showdown-Client */

	packTeam(team?: PokeSet[]): string {
		return Tools.packTeam(team);
	}

	private getPokeSets(team: Team): PokeSet[] {
		if (typeof team === 'string') return Tools.fastUnpackTeam(team);
		if (!Array.isArray(team)) return [...(team.essentialPokemon || []), ...team.pokemon];
		return team;
	}

	teamOverview(team: Team): string {
		const pokes = this.getPokeSets(team).map((p) => p.species);
		if (!pokes.length) return '(empty)';
		return pokes.join(', ');
	}
}
