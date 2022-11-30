const teamsDataFile = AppOptions.data + 'teams.json';

export class TeamBuilder {
	teams = {};
	staticTeams = {};
	dynTeams = {};

	writing: boolean = false;
	writePending: boolean = false;

	constructor() { };

	loadTeamList(reloading?: boolean) {
		try {
			if (reloading) Tools.uncacheTree('./features/battle/teams.js');
			this.staticTeams = require('./teams.js').teams;
			if (!fs.existsSync(teamsDataFile)) {
				this.dynTeams = {};
			} else {
				this.dynTeams = JSON.parse(fs.readFileSync(teamsDataFile).toString());
			}
			this.mergeTeams();
			return true;
		} catch (e) {
			error('failed to load teams: ' + sys.inspect(e));
			return false;
		}
	};

	mergeTeams() {
		if (this.teams) delete this.teams;
		this.teams = {};
		Object.merge(this.teams, this.staticTeams);
		for (let i in this.dynTeams) {
			const team = this.dynTeams[i];
			if (!this.teams[team.format]) this.teams[team.format] = [];
			this.teams[team.format].push(team.packed);
		}
	};

	addTeam(name, format, packed) {
		if (this.dynTeams[name]) return false;
		this.dynTeams[name] = {
			format: format,
			packed: packed
		};
		this.mergeTeams();
		this.saveTeams();
		return true;
	};

	removeTeam(name) {
		if (!this.dynTeams[name]) return false;
		delete this.dynTeams[name];
		this.mergeTeams();
		this.saveTeams();
		return true;
	};

	saveTeams() {
		const data = JSON.stringify(this.dynTeams);
		const finishWriting = function () {
			this.writing = false;
			if (this.writePending) {
				this.writePending = false;
				this.saveTeams();
			}
		};
		if (this.writing) {
			this.writePending = true;
			return;
		}
		fs.writeFile(teamsDataFile + '.0', data, function () {
			// rename is atomic on POSIX, but will throw an error on Windows
			fs.rename(teamsDataFile + '.0', teamsDataFile, function (err) {
				if (err) {
					// This should only happen on Windows.
					fs.writeFile(teamsDataFile, data, finishWriting);
					return;
				}
				finishWriting();
			});
		});
	};

	getTeam(format) {
		const formatId = toId(format);
		const teamStuff = this.teams[formatId];
		if (!teamStuff || !teamStuff.length) return false;
		const teamChosen = teamStuff[Math.floor(Math.random() * teamStuff.length)]; //choose team
		let teamStr = '';
		try {
			if (typeof teamChosen === 'string') {
				//already parsed
				teamStr = teamChosen;
			} else if (typeof teamChosen === 'object') {
				if (teamChosen.maxPokemon && teamChosen.pokemon) {
					//generate random team
					const team = [];
					const hasSpecies: { [key: string]: boolean } = {};
					if (teamChosen.essentialPokemon) {
						for (let poke of teamChosen.essentialPokemon) {
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
					if (Config.debug.debug) debug("Packed Team: " + JSON.stringify(team));
					teamStr = this.packTeam(team);
				} else if (teamChosen.length) {
					//parse team
					teamStr = this.packTeam(teamChosen);
				} else {
					error("invalid team data type: " + JSON.stringify(teamChosen));
					return false;
				}
			} else {
				error("invalid team data type: " + JSON.stringify(teamChosen));
				return false;
			}
			return teamStr;
		} catch (e) {
			error(e.stack);
		}
	};

	hasTeam(format) {
		const formatId = toId(format);
		if (this.teams[formatId]) return true;
		return false;
	};

	/* Pack Team function - from Pokemon-Showdown-Client */

	packTeam(team) {
		return Tools.packTeam(team);
	}
};