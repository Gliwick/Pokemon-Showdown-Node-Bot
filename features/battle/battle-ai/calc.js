/*
 * Pokemon Showdown Bot - Damage calculator
*/

var typechart = require('./typechart.js');

const CurrentGen = 8;

var Pokemon = exports.Pokemon = (function () {
	function Pokemon (template, properties) {
		if (!template || typeof template !== 'object') throw new Error('Invalid pokemon template');
		this.template = template;
		if (properties.helpers && properties.helpers.template) {
			this.template = Object.assign({}, template);
			for (let attr in properties.helpers.template) {
				this.template[attr] = properties.helpers.template[attr];
			}
		}

		this.name = this.template.species;
		this.species = this.template.species;
		this.gender = false;
		this.item = null;
		this.stats = {};
		this.evs = {};
		this.ivs = {};
		this.dvs = {};
		this.nature = null;
		this.ability = null;
		this.level = 100;
		this.shiny = false;
		this.happiness = 255;
		this.status = false;
		this.hp = 100;

		for (var i in properties) {
			if (typeof this[i] === 'undefined' || typeof this[i] === 'function') continue;
			if (i in {'helpers':1, 'template':1}) continue;
			this[i] = properties[i];
		}
	}

	Pokemon.prototype.getEV = function (ev, gen) {
		return this.evs[ev] || (gen <= 2 ? 252 : 84);
	};

	Pokemon.prototype.getIV = function (iv) {
		return this.ivs[iv] || 31;
	};

	Pokemon.prototype.getDV = function (dv) {
		return this.dvs[dv] || 15;
	};

	Pokemon.prototype.getBaseStat = function (stat) {
		if (this.template && this.template.baseStats) {
			if (this.template.species === 'Aegislash' && this.hasAbility('stancechange') && stat in {'atk':1, 'spa':1}) return (this.gen >= 8 ? 140 : 150);
			else return this.template.baseStats[stat] || 0;
		} else return 0;
	};

	Pokemon.prototype.getStat = function (stat, gen) {
		if (this.stats[stat]) {
			return this.stats[stat];
		}

		if (!gen) gen = CurrentGen;
		if (gen <= 2) {
			if (stat === 'hp') {
				return Math.floor(((this.getBaseStat(stat) + this.getDV(stat)) * 2 + Math.floor((Math.sqrt(65024) + 1) / 4)) * this.level / 100) + 10 + this.level;
			} else {
				return Math.floor(((this.getBaseStat(stat) + this.getDV(stat)) * 2 + Math.floor((Math.sqrt(65024) + 1) / 4)) * this.level / 100) + 5;
			}
		} else {
			if (stat === 'hp') {
				return Math.floor((2 * this.getBaseStat(stat) + this.getIV(stat) + this.getEV(stat, gen) / 4) * this.level / 100 + this.level + 10);
			} else {
				return Math.floor(Math.floor((2 * this.getBaseStat(stat) + this.getIV(stat) + this.getEV(stat, gen) / 4) * this.level / 100 + 5) * (this.nature ? (this.nature.value || 1) : 1));
			}
		}
	};

	Pokemon.prototype.getStats = function (gen) {
		if (!gen) gen = CurrentGen;
		let stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
		let res = {};
		for (var i = 0; i < stats.length; i++) {
			res[stats[i]] = this.getStat(stats[i], gen);
		}
		return res;
	};

	Pokemon.prototype.getMaxStats = function (gen) {
		if (!gen) gen = CurrentGen;
		let stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
		let res = {};
		for (var i = 0; i < stats.length; i++) {
			if (this.stats[stats[i]]) {
				res[stats[i]] = this.stats[stats[i]];
				continue;
			}
			if (gen <= 2) {
				if (stats[i] === 'hp') {
					res[stats[i]] = Math.floor(((this.getBaseStat(stats[i]) + 15) * 2 + Math.floor((Math.sqrt(65024) + 1) / 4)) * this.level / 100) + 10 + this.level;
				} else {
					res[stats[i]] = Math.floor(((this.getBaseStat(stats[i]) + 15) * 2 + Math.floor((Math.sqrt(65024) + 1) / 4)) * this.level / 100) + 5;
				}
			} else {
				if (stats[i] === 'hp') {
					res[stats[i]] = Math.floor((2 * this.getBaseStat(stats[i]) + 31 + 252 / 4) * this.level / 100 + this.level + 10);
				} else {
					res[stats[i]] = Math.floor(Math.floor((2 * this.getBaseStat(stats[i]) + 31 + 252 / 4) * this.level / 100 + 5) * 11 / 10.0);
				}
			}
		}
		return res;
	};

	Pokemon.prototype.getUninvestedStats = function (gen) {
		if (!gen) gen = CurrentGen;
		let stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
		let res = {};
		for (var i = 0; i < stats.length; i++) {
			if (this.stats[stats[i]]) {
				res[stats[i]] = this.stats[stats[i]];
				continue;
			}
			if (gen <= 2) {
				if (stats[i] === 'hp') {
					res[stats[i]] = Math.floor(((this.getBaseStat(stats[i]) + 15) * 2 + Math.floor((Math.sqrt(65024) + 1) / 4)) * this.level / 100) + 10 + this.level;
				} else {
					res[stats[i]] = Math.floor(((this.getBaseStat(stats[i]) + 15) * 2 + Math.floor((Math.sqrt(65024) + 1) / 4)) * this.level / 100) + 5;
				}
			} else {
				if (stats[i] === 'hp') {
					res[stats[i]] = Math.floor((2 * this.getBaseStat(stats[i]) + 31 + 0 / 4) * this.level / 100 + this.level + 10);
				} else {
					res[stats[i]] = Math.floor((2 * this.getBaseStat(stats[i]) + 31 + 0 / 4) * this.level / 100 + 5);
				}
			}
		}
		return res;
	};

	Pokemon.prototype.getBoostedStat = function (stat, statValue, boosts) {
		if (boosts[stat]) {
			let muxOff = 1 + (0.5) * Math.abs(boosts[stat]);
			if (boosts[stat] < 0) muxOff = 1 / muxOff;
			statValue = Math.floor(statValue * muxOff);
		}
		return statValue;
	};

	Pokemon.prototype.getTypes = function (conditions) {
		let types = this.template.types;
		if (conditions && conditions.volatiles) {
			if (conditions.volatiles.typechange && conditions.volatiles.typechange[0]) types = conditions.volatiles.typechange[0].split('/');
			if (conditions.volatiles.typeadd) {
				types = types.slice();
				types.push(conditions.volatiles.typeadd);
			}
		}
		return types;
	}

	Pokemon.prototype.hasType = function (type_s, conditions) {
		let pokemonTypes = this.getTypes(conditions);
		if (typeof type_s === 'string') return pokemonTypes.includes(type_s);

		for (let type of type_s) {
			if (pokemonTypes.includes(type)) return true;
		}
		return false;
	}

	Pokemon.prototype.hasAbility = function (ability) {
		return (this.ability && !this.supressedAbility && (this.ability.id === ability || (typeof ability !== 'string' && this.ability.id in ability)));
	}

	Pokemon.prototype.hasItem = function (item) {
		return (this.item && (this.item.id === item || (typeof item !== 'string' && this.item.id in item)) && !this.hasAbility('klutz'));
	}

	Pokemon.prototype.isGrounded = function (conditions) {
		return !(this.hasType('Flying', conditions) || this.hasAbility('levitate') || this.hasItem('airballoon'));
	}

	Pokemon.prototype.getSpe = function (battle, conditions, moves, ignoreBoost, randomBattle) {
		let gen = battle.gen || CurrentGen;
		if ('spe' in this.evs && ('spe' in this.ivs || 'spe' in this.dvs)) return this.getStat('spe', gen);

		let gconditions = battle.conditions;
		let spe = 0;
		if (this.hasAbility('stall') || moves.includes('gyroball') || moves.includes('trickroom')) {
			spe = this.getUninvestedStats(gen)['spe'];
		} else if (randomBattle) {
			spe = this.getStat('spe', gen);
		} else if ((this.template.baseStats && this.template.baseStats.spe >= 70) || this.hasItem('choicescarf')) {
			spe = this.getMaxStats(gen)['spe'];
		} else {
			spe = this.getUninvestedStats(gen)['spe'];
		}
		spe = Math.floor(spe);
		if (conditions['tailwind']) spe *= 2;
		if (conditions.volatiles['unburden']) spe *= 2;
		if (gconditions.weather && !gconditions.supressedWeather) {
			if (toId(gconditions.weather) in {'desolateland':1, 'sunnyday':1} && this.hasAbility('chlorophyll')) spe *= 2;
			if (toId(gconditions.weather) in {'primordealsea':1, 'raindance':1} && this.hasAbility('swiftswim')) spe *= 2;
			if (toId(gconditions.weather) === 'sandstorm' && this.hasAbility('sandrush')) spe *= 2;
			if (toId(gconditions.weather) === 'hail' && this.hasAbility('slushrush')) spe *= 2;
		}
		if (gconditions['electricterrain'] && this.hasAbility('surgesurfer')) spe = Math.floor(spe * 2);
		if (this.hasAbility('slowstart')) spe = Math.floor(spe * 0.5);
		if (this.hasItem('choicescarf')) spe = Math.floor(spe * 1.5);
		if (this.hasItem({'ironball':1, 'machobrace':1})) spe = Math.floor(spe * 0.5);
		if (this.status === 'par') {
			if (this.hasAbility('quickfeet')) {
				spe = Math.floor(spe * 1.5);
			} else {
				if (gen < 7) spe = Math.floor(spe * 0.25);
				else spe = Math.floor(spe * 0.5);
			}
		}
		if (!ignoreBoost) spe = this.getBoostedStat('spe', spe, conditions.boosts);
		return spe;
	};

	return Pokemon;
})();

var Conditions = exports.Conditions = (function () {
	function Conditions (data) {
		if (typeof data !== 'object') throw new Error('Invalid conditions data');
		this.volatiles = {};
		this.boosts = {};
		this.side = {};
		this.inmediate = {};
		for (var i in data) {
			if (typeof this[i] === 'undefined' || typeof this[i] === 'function') continue;
			this[i] = data[i];
		}
	}

	return Conditions;
})();

var getRolls = exports.getRolls = function (n, pmin, pmax) {
	if (n === 0) return [0];

	if (!pmin) pmin = 0.85;
	if (!pmax) pmax = 1;
	let rolls = [];
	for (var m = pmin; m <= pmax; m += 0.01) {
		rolls.push(Math.floor(m * n) || 1);
	}
	return rolls;
};

var Damage = exports.Damage = (function () {
	function Damage (hp, rolls) {
		this.rolls = rolls || [];
		this.hp = hp || 1;
		this.percents = [];
		for (var i = 0; i < this.rolls.length; i++) {
			if (hp === 0) {
				this.percents.push(100);
			} else {
				this.percents.push(this.rolls[i] * 100 / hp);
			}
		}
	}

	Damage.prototype.getChance = function (p) {
		if (!this.percents || this.percents.length) return 0;
		if (!this.hp || this.hp <= 0) return 100;
		let s = 0;
		for (var i = 0; i < this.percents.length; i++) {
			if (this.percents[i] >= p) s++;
		}
		return (s * 100 / this.percents.length);
	};

	Damage.prototype.getMax = function () {
		return this.percents[0] || 0;
	};

	Damage.prototype.getMin = function () {
		return this.percents[0] || 0;
	};

	Damage.prototype.getAvg = function () {
		if (!this.percents.length) return 0;

		let sum = 0;
		for (var i = 0; i < this.percents.length; i++) {
			sum += this.percents[i];
		}
		return (sum / this.percents.length);
	};

	return Damage;
})();

exports.getHazardsDamage = function (poke, conditions, gen, gconditions) {
	if ((gen >= 3 && poke.hasAbility('magicguard')) || poke.hasItem('heavydutyboots')) return 0;

	let side = conditions.side;
	if (poke.template.species === 'Shedinja' && (side['stealthrock'] || side['spikes'] || side['gmaxsteelsurge'])) return 100;

	let inverse = !!gconditions['inversebattle'];
	let dmg = 0;

	if (side['stealthrock']) {
		dmg += (100 * typechart.getMultipleEff('Rock', poke.getTypes(conditions), gen, inverse)) / 8.0;
	}
	if (side['spikes']) {
		if (gconditions['gravity'] || !poke.isGrounded(conditions)) dmg += (100 * side['spikes']) / 24.0;
	}
	if (side['gmaxsteelsurge']) {
		dmg += (100 * typechart.getMultipleEff('Steel', poke.getTypes(conditions), gen, inverse)) / 8.0;
	}

	return dmg;
};

/*
 * Damage calculator function
 *
 * Arguments:
 *
 *  - pokeA, pokeB (Pokemon)
 *  - move (move template)
 *
 * Optional arguments:
 *
 *  - conditionsA, conditionsB (Conditions)
 *  - gconditions (Global conditions)
 *  - gen (6 by default)
*/

exports.calculate = function (pokeA, pokeB, move, conditionsA, conditionsB, gconditions, gen) {
	if (!gen) gen = CurrentGen;
	if (!gconditions) gconditions = {};
	if (!conditionsA) conditionsA = {};
	if (!conditionsB) conditionsB = {};
	gconditions.supressedWeather = (pokeA.hasAbility({'airlock':1, 'cloudnine':1}) || pokeB.hasAbility({'airlock':1, 'cloudnine':1}));
	let supressedWeather = gconditions.supressedWeather;

	let statsA = pokeA.getStats(gen), statsB = pokeB.getStats(gen);
	let speA = pokeA.getSpe({conditions: gconditions, gen: gen}, conditionsA, [move.id], true, gen);
	let speB = pokeB.getSpe({conditions: gconditions, gen: gen}, conditionsB, [], true, gen);

	let atk, def, bp, atkStat, defStat;
	let cat, defcat;

	/******************************
	* Attack and Defense Stats
	*******************************/
	if (gen > 3) {
		if (move.category === 'Special') {
			atk = statsA.spa;
			atkStat = 'spa';
		} else if (move.category === 'Physical') {
			atk = statsA.atk;
			atkStat = 'atk';
		} else {
			return new Damage(statsB.hp);
		}

		cat = defcat = move.category;
		if (move.defensiveCategory) defcat = move.defensiveCategory;

		if (defcat === 'Special') {
			def = statsB.spd;
			defStat = 'spd';
		} else if (defcat === 'Physical') {
			def = statsB.def;
			defStat = 'def';
		} else {
			return new Damage(statsB.hp);
		}

		// custom attacking stat
		if (move.id === 'foulplay') atk = statsB.atk;
		if (move.id === 'bodypress') {
			atk = statsA.def;
			atkStat = 'def';
		}

		if (move.id in {'photongeyser':1, 'lightthatburststhesky':1} && statsA.atk > statsA.spa) {
			atk = statsA.atk;
			atkStat = 'atk';
			def = statsB.def;
			defStat = 'def';
		}
	} else {
		let specialTypes = {Fire: 1, Water: 1, Grass: 1, Ice: 1, Electric: 1, Dark: 1, Psychic: 1, Dragon: 1};
		if (move.type && move.type in specialTypes) {
			cat = defcat = 'Special';
			atk = statsA.spa;
			atkStat = 'spa';
		} else {
			cat = defcat = 'Physical';
			atk = statsA.atk;
			atkStat = 'atk';
		}
		if (move.defensiveCategory) defcat = move.defensiveCategory;
		if (defcat === 'Special') {
			def = statsA.spd;
			defStat = 'spd';
		} else {
			def = statsA.def;
			defStat = 'def';
		}
	}

	if (cat === 'Physical' && pokeA.status === 'brn') {
		if (gen < 3 || !pokeA.hasAbility('guts')) atk = Math.floor(atk * 0.5);
	}

	/******************************
	* Inmunity (0 damage)
	* Types (effectiveness)
	*******************************/

	let typesMux = 1;
	let moveType = move.type || 'Normal';
	let movePriority = move.priority;
	let immune = false;

	switch (move.id) {
		case 'aurawheel':
			if (pokeA.template.species === 'Morpeko-Hangry') moveType = 'Dark';
			break;
		case 'judgment':
			if (pokeA.item && pokeA.item.onPlate) moveType = pokeA.item.onPlate;
			else moveType = 'Normal';
			break;
		case 'multiattack':
			if (pokeA.item && pokeA.item.onMemory) moveType = pokeA.item.onMemory;
			else moveType = 'Normal';
			break;
		case 'naturalgift':
			if (pokeA.item && pokeA.item.naturalGift && pokeA.item.naturalGift.type) moveType = pokeA.item.naturalGift.type;
			else moveType = 'Normal';
			break;
		case 'revelationdance':
			moveType = pokeA.getTypes(conditionsA)[0];
			break;
		case 'technoblast':
			if (pokeA.item && pokeA.item.onDrive) moveType = pokeA.item.onDrive;
			else moveType = 'Normal';
			break;
		case 'weatherball':
			if (gconditions.weather === 'primordialsea' || gconditions.weather === 'raindance') moveType = 'Water';
			else if (gconditions.weather === 'desolateland' || gconditions.weather === 'sunnyday') moveType = 'Fire';
			else if (gconditions.weather === 'sandstorm') moveType = 'Rock';
			else if (gconditions.weather === 'hail') moveType = 'Ice';
			else moveType = 'Normal';
			if (moveType !== 'Normal') bp = Math.floor(bp * 2);
			break;
	}

	if (gen >= 3 && pokeA.ability && !pokeA.supressedAbility) {
		switch (pokeA.ability.id) {
			case 'normalize':
				if (moveType === move.type) moveType = 'Normal';
				break;
			case 'aerilate':
				if (moveType === 'Normal') moveType = 'Flying';
				break;
			case 'pixilate':
				if (moveType === 'Normal') moveType = 'Fairy';
				break;
			case 'refrigerate':
				if (moveType === 'Normal') moveType = 'Ice';
				break;
			case 'galvanize':
				if (moveType === 'Normal') moveType = 'Electric';
				break;
			case 'liquidvoice':
				if (move.flags && move.flags['sound']) moveType = 'Water';
				break;
			case 'blaze':
				if (moveType === 'Fire' && pokeA.hp <= (100 / 3)) atk = Math.floor(atk * 1.5);
				break;
			case 'defeatist':
				if (pokeA.hp < 50 && cat === 'Physical') atk = Math.floor(atk * 0.5);
				break;
			case 'guts':
				if (pokeA.status && pokeA.status !== 'frz' && cat === 'Physical') atk = Math.floor(atk * 1.5);
				break;
			case 'hugepower':
			case 'purepower':
				if (cat === 'Physical') atk = Math.floor(atk * 2);
				break;
			case 'hustle':
			case 'gorillatactics':
				if (cat === 'Physical') atk = Math.floor(atk * 1.5);
				break;
			case 'solarpower':
				if (!supressedWeather && gconditions.weather in {'desolateland':1, 'sunnyday':1}) {
					if (cat === 'Special') atk = Math.floor(atk * 1.5);
				}
				break;
			case 'overgrow':
				if (moveType === 'Grass' && pokeA.hp <= (100 / 3.0)) atk = Math.floor(atk * 1.5);
				break;
			case 'swarm':
				if (moveType === 'Bug' && pokeA.hp <= (100 / 3.0)) atk = Math.floor(atk * 1.5);
				break;
			case 'torrent':
				if (moveType === 'Water' && pokeA.hp <= (100 / 3.0)) atk = Math.floor(atk * 1.5);
				break;
			case 'triage':
				if (move.flags && move.flags['heal']) movePriority += 3;
				break;
			case 'galewings':
				if (moveType === 'Flying' && (this.gen <= 6 || pokeA.hp >= 100)) movePriority += 1;
				break;
		}
	}

	if (gen >= 3 && pokeB.ability && (!pokeA.ability || !(pokeA.ability.id in {'moldbreaker': 1, 'turboblaze': 1, 'teravolt': 1})) && !move.ignoreAbility) {
		switch (pokeA.ability.id) {
			case 'marvelscale':
				if (pokeA.status && defStat === 'def') def = Math.floor(def * 1.5);
				break;
			case 'furcoat':
				if (defStat === 'def') def = Math.floor(def * 2);
				break;
			case 'icescales':
				if (defStat === 'spd') def = Math.floor(def * 2);
				break;
		}
	}

	let eff;
	let defTypes = pokeB.getTypes(conditionsB).slice();

	for (var t = 0; t < defTypes.length; t++) {
		eff = typechart.getEffectiveness(moveType, defTypes[t], gen);
		if (!eff && defTypes[t] === 'Ghost') {
			if (conditionsB.volatiles['foresight'] || move.id === 'struggle') eff = 1;
			if (gen >= 3 && pokeA.ability && pokeA.hasAbility('scrappy')) eff = 1;
		}
		if (!eff && defTypes[t] === 'Flying') {
			if (gconditions['gravity'] || move.id === 'thousandarrows') eff = 1;
		}
		if (gconditions['inversebattle']) {
			if (eff === 0) eff = 2;
			else eff = 1 / eff;
		}
		if (move.id === 'freezedry' && defTypes[t] === 'Water') eff = 2;
		typesMux *= eff;
	}

	if (gen >= 3 && pokeB.ability && !pokeB.supressedAbility && !pokeA.hasAbility({'moldbreaker':1, 'teravolt':1, 'turboblaze':1, 'neutralizinggas':1}) && !move.ignoreAbility) {
		switch (pokeB.ability.id) {
			case 'dryskin':
			case 'stormdrain':
			case 'waterabsorb':
				if (moveType === 'Water') immune = true;
				break;
			case 'flashfire':
				if (moveType === 'Fire') immune = true;
				break;
			case 'levitate':
				if (moveType === 'Ground' && move.id !== 'thousandarrows') immune = true;
				break;
			case 'lightningrod':
			case 'motordrive':
			case 'voltabsorb':
				if (moveType === 'Electric') immune = true;
				break;
			case 'sapsipper':
				if (moveType === 'Grass') immune = true;
				break;
			case 'thickfat':
				if (moveType === 'Ice' || moveType === 'Fire') atk = Math.floor(atk * 0.5);
				break;
			case 'soundproof':
				if (move.flags && move.flags['sound']) immune = true;
				break;
			case 'bulletproof':
				if (move.flags && move.flags['bullet']) immune = true;
				break;
			case 'dazzling':
			case 'queenlymajesty':
				if (movePriority > 0) immune = true;
				break;
			case 'wonderguard':
				if (typesMux < 2) typesMux = 0;
				break;
		}
	}

	if (immune || typesMux === 0) return new Damage(statsB.hp);

	/******************************
	* Base power
	*******************************/

	bp = move.basePower || 0;

	switch (move.id) {
		case 'frustration':
			bp = Math.floor(((255 - pokeA.happiness) * 2) / 5) || 1;
			break;
		case 'return':
		case 'pikapapow':
		case 'veeveevolley':
			bp = Math.floor((pokeA.happiness * 2) / 5) || 1;
			break;
		case 'fling':
			if (pokeA.item && pokeA.item.fling) bp = pokeA.item.fling.basePower || 0;
			else bp = 0;
			break;
		case 'naturalgift':
			if (pokeA.item && pokeA.item.naturalGift && pokeA.item.naturalGift.basePower) bp = pokeA.item.naturalGift.basePower;
			else bp = 0;
			break;
		case 'grassknot':
		case 'lowkick':
			if (conditionsB.volatiles['dynamax']) {
				bp = 0;
			} else if (pokeB.template.weightkg) {
				if (pokeB.template.weightkg >= 200) {
					bp = 120;
				} else if (pokeB.template.weightkg >= 100) {
					bp = 100;
				} else if (pokeB.template.weightkg >= 50) {
					bp = 80;
				} else if (pokeB.template.weightkg >= 25) {
					bp = 60;
				} else if (pokeB.template.weightkg >= 10) {
					bp = 40;
				} else {
					bp = 20;
				}
			} else {
				bp = 20;
			}
			break;
		case 'heavyslam':
		case 'heatcrash':
			if (conditionsB.volatiles['dynamax']) {
				bp = 0;
			} else if (pokeA.template.weightkg && pokeB.template.weightkg) {
				if (pokeA.template.weightkg / pokeB.template.weightkg > 5) {
					bp = 120;
				} else if (pokeA.template.weightkg / pokeB.template.weightkg > 4) {
					bp = 100;
				} else if (pokeA.template.weightkg / pokeB.template.weightkg > 3) {
					bp = 80;
				} else if (pokeA.template.weightkg / pokeB.template.weightkg > 2) {
					bp = 60;
				} else {
					bp = 40;
				}
			} else {
				bp = 40;
			}
			break;
		case 'gyroball':
			bp = (Math.floor(25 * speB / speA) || 1);
			if (bp > 150) bp = 150;
			break;
		case 'electroball':
			if (speA, speB) {
				if (speA / speB >= 4) {
					bp = 150;
				} else if (speA / speB >= 3) {
					bp = 120;
				} else if (speA / speB >= 2) {
					bp = 80;
				} else if (speA / speB >= 1) {
					bp = 60;
				} else {
					bp = 40;
				}
			} else bp = 40;
			break;
		case 'reversal':
		case 'flail':
			if (statsA.hp >= 68.75) {
				bp = 20;
			} else if (statsA.hp >= 35.42) {
				bp = 40;
			} else if (statsA.hp >= 20.83) {
				bp = 80;
			} else if (statsA.hp >= 10.42) {
				bp = 100;
			} else if (statsA.hp >= 4.17) {
				bp = 150;
			} else {
				bp = 200;
			}
			break;
		case 'wringout':
		case 'crushgrip':
			bp = (Math.floor(120 * (pokeB.hp / 100)) || 1);
			if (bp > 120) bp = 120;
			break;
		case 'punishment':
			bp = 60;
			for (var stat in conditionsB.boosts) {
				if (conditionsB.boosts[stat] > 0) bp += (20 * conditionsB.boosts[stat]);
			}
			break;
		case 'beatup':
			bp = Math.floor(pokeA.template.baseStats.atk / 10) + 5;
		case 'trumpcard':
		case 'present':
			bp = 40;
			break;
		case 'magnitude':
			bp = 10;
			break;
	}

	if (!bp) {
		if (move.damage === 'level') return new Damage(statsB.hp, [pokeA.level]);
		if (typeof move.damage === 'number') return new Damage(statsB.hp, [move.damage]);
		if (move.id === 'endeavor') new Damage(statsB.hp, [Math.max(0, statsB.hp * (pokeB.hp / 100.0) - statsA.hp * (pokeA.hp / 100.0))]);
		if (move.id === 'psywave') new Damage(statsB.hp, getRolls(pokeA.level, 0.5, 1.5));
		return new Damage(statsB.hp);
	}

	switch (move.id) {
		case 'smellingsalts':
			if (pokeB.status === 'par') bp = Math.floor(bp * 2);
			break;
		case 'wakeupslap':
			if (pokeB.status === 'slp') bp = Math.floor(bp * 2);
			break;
		case 'dreameater':
			if (pokeB.status !== 'slp') bp = 0;
			break;
		case 'venoshock':
			if (pokeB.status in {'psn':1, 'tox':1}) bp = Math.floor(bp * 2);
			break;
		case 'hex':
			if (pokeB.status) bp = Math.floor(bp * 2);
			break;
		case 'brine':
			if (pokeB.hp < 50) bp = Math.floor(bp * 2);
			break;
		case 'facade':
			if (pokeA.status && pokeA.status !== 'slp' && pokeA.status !== 'frz') bp = Math.floor(bp * 2);
			break;
		case 'knockoff':
			if (pokeB.item && !pokeB.onTakeItem) bp = Math.floor(bp * 1.5);
			break;
		case 'acrobatics':
			if (!pokeA.item || !pokeA.item.id || pokeA.item.id in {'':1, 'pokeball':1, 'flyinggem':1}) bp = Math.floor(bp * 2);
			break;
		case 'retaliate':
			if (conditionsA.side.faintedLastTurn) bp = Math.floor(bp * 2);
			break;
		case 'payback':
			if ((!gconditions['trickroom'] && speA < speB) || (gconditions['trickroom'] && speA > speB)) bp = Math.floor(bp * 2);
			break;
		case 'avalanche':
		case 'revenge':
		case 'boltbeak':
		case 'fishiousrend':
			bp = Math.floor(bp * 2);
			break;
		case 'behemothblade':
		case 'behemothbash':
		case 'dynamaxcannon':
			if (conditionsB.volatiles['dynamax']) bp = Math.floor(bp * 2);
			break;
		case 'solarbeam':
		case 'solarblade':
			if (toId(gconditions.weather) in {'primordialsea':1, 'raindance':1, 'sandstorm':1, 'hail':1}) bp = Math.floor(bp * 0.5);
			break;
		case 'hyperspacefury':
			if (pokeA.template.species !== 'Hoopa-Unbound') bp = 0;
			break;
		case 'aurawheel':
			if (!pokeA.template.species.startsWith('Morpeko')) bp = 0;
			break;
		case 'waterspout':
		case 'eruption':
			bp *= (pokeA.hp / 100.0);
			break;
		case 'storedpower':
		case 'powertrip':
			for (var stat in conditionsA.boosts) {
				if (conditionsA.boosts[stat] > 0) bp += (20 * conditionsA.boosts[stat]);
			}
			break;
		case 'triplekick':
			if (!(conditionsA.boosts.accuracy < 0 || conditionsA.boosts.evasion > 0)) bp = 60;
			break;
		case 'gravapple':
			if (gconditions['gravity']) bp = Math.floor(bp * 1.5);
			break;
	}

	if (gen >= 3 && pokeA.ability && !pokeA.supressedAbility && !pokeB.hasAbility('neutralizinggas')) {
		switch (pokeA.ability.id) {
			case 'technician':
				if (bp <= 60) bp = Math.floor(bp * 1.5);
				break;
			case 'toxicboost':
				if (cat === 'Physical' && pokeA.status in {'psn':1, 'tox':1}) bp = Math.floor(bp * 1.5);
				break;
			case 'toughclaws':
				if (move.flags && move.flags['contact']) bp = Math.floor(bp * 1.3);
				break;
			case 'normalize':
				if (moveType === 'Normal') bp = Math.floor(bp * 1.2);
				break;
			case 'aerilate':
			case 'pixilate':
			case 'refrigerate':
			case 'galvanize':
				if (move.type === 'Normal') bp = Math.floor(bp * 1.2);
				break;
			case 'darkaura':
				if (move.type === 'Dark') {
					if (pokeB.hasAbility('aurabreak')) bp = Math.floor(bp * 0.75);
					else bp = Math.floor(bp * 1.33);
				}
				break;
			case 'fairyaura':
				if (move.type === 'Fairy') {
					if (pokeB.hasAbility('aurabreak')) bp = Math.floor(bp * 0.75);
					else bp = Math.floor(bp * 1.33);
				}
				break;
			case 'steelworker':
			case 'steelyspirit':
				if (move.type === 'Steel') bp = Math.floor(bp * 1.5);
				break;
			case 'waterbubble':
				if (move.type === 'Water') bp = Math.floor(bp * 2);
				break;
			case 'flareboost':
				if (cat === 'Special' && pokeA.status === 'brn') bp = Math.floor(bp * 1.5);
				break;
			case 'ironfist':
				if (move.flags && move.flags['punch']) bp = Math.floor(bp * 1.2);
				break;
			case 'megalauncher':
				if (move.flags && move.flags['pulse']) bp = Math.floor(bp * 1.5);
				break;
			case 'reckless':
				if (move.recoil || move.hasCustomRecoil) bp = Math.floor(bp * 1.2);
				break;
			case 'rivalry':
				if (!(pokeA.gender === 'N' || pokeB.gender === 'N')) {
					if (pokeA.gender === pokeB.gender) {
						bp = Math.floor(bp * 1.25);
					} else {
						bp = Math.floor(bp * 0.75);
					}
				}
				break;
			case 'sandforce':
				if (!supressedWeather && gconditions.weather === 'sandstorm' && moveType in {'Rock':1, 'Ground':1, 'Steel':1}) bp = Math.floor(bp * 1.3);
				break;
			case 'sheerforce':
				if (move.secondaries) bp = Math.floor(bp * 1.3);
				break;
			case 'strongjaw':
				if (move.flags && move.flags['bite']) bp = Math.floor(bp * 1.5);
				break;
			case 'analytic':
				if ((!gconditions['trickroom'] && speA < speB) || (gconditions['trickroom'] && speA > speB)) bp = Math.floor(bp * 1.3);
				break;
			case 'tintedlens':
				if (typesMux < 1) bp = Math.floor(bp * 2);
				break;
			case 'neuroforce':
				if (typesMux > 1) bp = Math.floor(bp * 1.25);
				break;
			case 'punkrock':
				if (move.flags && move.flags['sound']) bp = Math.floor(bp * 1.3);
				break;
		}
	}

	if (gen >= 3 && pokeB.ability && !pokeB.supressedAbility && !pokeA.hasAbility({'moldbreaker':1, 'teravolt':1, 'turboblaze':1, 'neutralizinggas':1}) && !move.ignoreAbility) {
		switch (pokeB.ability.id) {
			case 'fluffy':
				if (moveType === 'Fire') bp = Math.floor(bp * 2);
				if (move.flags && move.flags['contact']) bp = Math.floor(bp * 0.5);
				break;
			case 'darkaura':
				if (move.type === 'Dark') {
					if (pokeA.hasAbility('aurabreak')) bp = Math.floor(bp * 0.75);
					else bp = Math.floor(bp * 1.33);
				}
				break;
			case 'fairyaura':
				if (move.type === 'Fairy') {
					if (pokeA.hasAbility('aurabreak')) bp = Math.floor(bp * 0.75);
					else bp = Math.floor(bp * 1.33);
				}
				break;
			case 'dryskin':
				if (moveType === 'Fire') bp = Math.floor(bp * 1.25);
				break;
			case 'heatproof':
			case 'waterbubble':
				if (moveType === 'Fire') bp = Math.floor(bp * 0.5);
				break;
			case 'filter':
			case 'solidrock':
			case 'peismarmor':
				if (typesMux > 1) bp = Math.floor(bp * 0.75);
				break;
			case 'multiscale':
			case 'shadowshield':
				if (pokeB.hp >= 100) bp = Math.floor(bp * 0.5);
				break;
		}
	}

	if (pokeA.item) {
		switch (pokeA.item.id) {
			case 'lightball':
				atk = Math.floor(atk * 2);
			case 'thickclub':
				if (atkStat === 'atk') atk = Math.floor(atk * 2);
			case 'deepseatooth':
				if (atkStat === 'spa') atk = Math.floor(atk * 2);
			case 'choiceband':
				if (atkStat === 'atk') atk = Math.floor(atk * 1.5);
				break;
			case 'choicespecs':
				if (atkStat === 'spa') atk = Math.floor(atk * 1.5);
				break;
			case 'souldew':
			case 'adamantorb':
			case 'lustrousorb':
			case 'griseousorb':
				if (pokeA.template.types.indexOf(moveType) >= 0) bp = Math.floor(bp * 1.2);
				break;
			case 'silkscarf':
				if (moveType === 'Normal') bp = Math.floor(bp * 1.2);
				break;
			case 'expertbelt':
				if (typesMux > 1) bp = Math.floor(bp * 1.2);
				break;
		}
		if (pokeA.item.isGem && pokeA.item.name.substr(0, -4) === moveType) bp = Math.floor(bp * (gen >= 6 ? 1.3 : 1.5));
		if (pokeA.item.onPlate && pokeA.item.onPlate === moveType) bp = Math.floor(bp * 1.2);
	}

	if (pokeB.item) {
		if (pokeB.item.onSourceModifyDamage && pokeB.item.naturalGift && move.type === pokeB.item.naturalGift.type) {
			if (pokeB.hasAbility('ripen')) bp = Math.floor(bp * 0.25);
			else bp = Math.floor(bp * 0.5);
		}
		switch (pokeB.item.id) {
			case 'metalpowder':
				if (defStat === 'def') def = Math.floor(def * 2);
				break;
			case 'deepseascale':
				if (defStat === 'spd') def = Math.floor(def * 2);
				break;
			case 'eviolite':
				def = Math.floor(def * 1.5);
				break;
			case 'assaultvest':
				if (defStat === 'spd') def = Math.floor(def * 1.5);
				break;
			case 'airballoon':
				if (moveType === 'Ground') modifier = 0;
				break;
		}
	}

	/******************************
	* Modifiers
	*******************************/

	let modifier = 1;

	if (pokeA.item && pokeA.item.id === 'lifeorb') modifier *= 1.3;

	/* STAB */
	if (pokeA.hasType(moveType, conditionsA) >= 0 || pokeA.hasAbility({'libero':1, 'protean':1})) {
		if (gen >= 3 && pokeA.hasAbility('adaptability')) modifier *= 2;
		else modifier *= 1.5;
	}

	/* Weather */
	if (gconditions.weather && !supressedWeather) {
		if (move.type === 'Water' && (toId(gconditions.weather) in {'primordialsea':1, 'raindance':1})) modifier *= 1.5;
		if (move.type === 'Fire' && (toId(gconditions.weather) in {'desolateland':1, 'sunnyday':1})) modifier *= 1.5;

		if (gconditions.weather === 'desolateland' && move.type === 'Water') modifier = 0;
		if (gconditions.weather === 'primordialsea' && move.type === 'Fire') modifier = 0;

		if (gconditions.weather === 'sunnyday' && move.type === 'Water') modifier *= 0.5;
		if (gconditions.weather === 'raindance' && move.type === 'Fire') modifier *= 0.5;
	}

	if (gen >= 4 && defTypes.indexOf('Rock') >= 0 && gconditions.weather === 'sandstorm') {
		if (defStat === 'spd') def = Math.floor(def * 1.5);
	}

	/* Boosting */

	if (conditionsA.boosts && !pokeB.hasAbility('unaware')) {
		if (!pokeB.ability || pokeB.ability.id !== 'unaware') {
			if (move.id === 'foulplay') atk = pokeB.getBoostedStat(atkStat, atk, conditionsB.boosts);
			else atk = pokeA.getBoostedStat(atkStat, atk, conditionsA.boosts);
		}
	}

	if (conditionsB.boosts[defStat]) {
		if (!conditionsA.inmediate['crit'] && !move.willCrit && !pokeA.hasItem('leek') && !pokeA.hasItem('luckypunch') && !pokeA.hasItem('stick') && !move.ignoreDefensive && !pokeA.hasAbility('unaware')) {
			def = pokeB.getBoostedStat(defStat, def, conditionsB.boosts)
		}
	}

	/* Inmediate */

	if (conditionsA.inmediate['crit'] || move.willCrit || pokeA.hasItem('leek') || pokeA.hasItem('luckypunch') || pokeA.hasItem('stick')) {
		if (gen > 5) modifier *= 1.5;
		else modifier *= 2;
	}

	if (conditionsA.inmediate['helpinghand']) modifier *= 1.5;

	/* Side */

	const screenModifier = (gconditions['gametype'] in {'doubles':1, 'triples':1} ? 0.66 : 0.5);
	if (!(move.id in {'brickbreak':1, 'psychicfangs':1}) && !pokeA.hasAbility('infiltrator')) {
		if (conditionsB.volatiles['reflect'] && cat === 'Physical') modifier *= 0.5; // Gen 1
		if ((conditionsB.side['reflect'] || conditionsB.side['auroraveil']) && cat === 'Physical') modifier *= screenModifier;
		if ((conditionsB.side['lightscreen'] || conditionsB.side['auroraveil']) && cat === 'Special') modifier *= screenModifier;
	}

	if (conditionsB.volatiles['magnetrise'] && moveType === 'Ground') modifier = 0;

	/* Field */

	const terrainBoost = (gen >= 8 ? 1.3 : 1.5);
	if (pokeA.isGrounded(conditionsA)) {
		if (gconditions['electricterrain'] && moveType === 'Electric') bp = Math.floor(bp * terrainBoost);
		if (gconditions['grassyterrain'] && moveType === 'Grass') bp = Math.floor(bp * terrainBoost);
		if (gconditions['psychicterrain'] && moveType === 'Psychic') bp = Math.floor(bp * terrainBoost);
	}
	if (pokeB.isGrounded(conditionsB)) {
		if (gconditions['grassyterrain'] && move.id in {'bulldoze':1, 'earthquake':1, 'magnitude':1}) bp = Math.floor(bp * 0.5);
		if (gconditions['psychicterrain'] && movePriority > 0) modifier = 0;
		if (gconditions['mistyterrain'] && moveType === 'Dragon') bp = Math.floor(bp * 0.5);
	}

	if (gconditions['gametype'] in {'doubles':1, 'triples':1}) {
		if (move.target.startsWith('allAdjacent')) modifier *= 0.75;
	}

	/******************************
	* Damage
	*******************************/

	let dmg = 0;
	if (bp > 0) dmg = Math.floor((((((2 * pokeA.level / 5.0) + 2) * bp * atk / def) / 50.0) + 2) * modifier * typesMux) || 1;

	if (move.multihit) {
		if (typeof move.multihit === 'number' && move.id !== 'triplekick') dmg *= move.multihit;
		if (move.multihit === [2, 5]) {
			if (pokeA.hasAbility('skilllink')) dmg *= 5;
			// multihit rolls more important than damage rolls
			else return new Damage(statsB.hp, [2 * dmg, 2 * dmg, 3 * dmg, 3 * dmg, 4 * dmg, 5 * dmg]);
		}
	} else if (move.id === 'beatup') {
		dmg *= 6;
	} else if (pokeA.hasAbility('parentalbond') && !pokeB.hasAbility('neutralizinggas')) {
		if (!move.selfdestruct && !move.multihit && !(move.flags && move.flags['charge']) && !(move.spreadHit && gconditions['gametype'] in {'doubles':1, 'triples':1}) && !move.isZ && !move.isMax) {
			let secondHitMultiplier = 1;
			if (move.id === 'acidspray') {
				secondHitMultiplier = 2;
			} else if (move.id in {'appleacid':1, 'chargebeam':1, 'fierydance':1, 'firelash':1, 'gravapple':1, 'poweruppunch':1, 'strongarm':1}) {
				secondHitMultiplier = 1.5;
			} else if (move.id === 'superpower') {
				secondHitMultiplier = 0.66;
			} else if (move.id in {'dracometeor':1, 'fleurcannon':1, 'leafstorm':1, 'overheat':1, 'psychoboost':1}) {
				secondHitMultiplier = 0.5;
			} else {
				secondHitMultiplier = 1;
			}
			dmg = Math.floor(dmg * (1 + (gen >= 7 ? 0.25 : 0.5) * secondHitMultiplier));
		}
	}

	return new Damage(statsB.hp, getRolls(dmg));
};
