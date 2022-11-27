/*
 * Pokemon Showdown Bot - Damage calculator
*/

var TypeChart = require('./typechart.ts');

const CurrentGen = 9;

var Pokemon = exports.Pokemon = (function () {
	function Pokemon(template, properties) {
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
		this.nature = {};
		this.ability = null;
		this.level = 100;
		this.shiny = false;
		this.happiness = null;
		this.status = false;
		this.hp = 100;

		for (var i in properties) {
			if (typeof this[i] === 'undefined' || typeof this[i] === 'function') continue;
			if (i in { 'helpers': 1, 'template': 1 }) continue;
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
			if (this.template.species === 'Aegislash' && this.hasAbility('stancechange') && stat in { 'atk': 1, 'spa': 1 }) return (this.gen >= 8 ? 140 : 150);
			else return this.template.baseStats[stat] || 0;
		} else {
			return 90;
		}
	};

	Pokemon.prototype.getStat = function (stat, gen) {
		if (this.stats[stat]) return this.stats[stat];
		if (stat === 'hp' && this.getBaseStat(stat) === 1) return 1;

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
				return Math.floor(Math.floor((2 * this.getBaseStat(stat) + this.getIV(stat) + this.getEV(stat, gen) / 4) * this.level / 100 + 5) * (this.nature[stat] || 1));
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

	Pokemon.prototype.getBoostedStat = function (stat, statValue, boosts) {
		if (boosts[stat]) {
			let muxOff = 1 + (0.5) * Math.abs(boosts[stat]);
			if (boosts[stat] < 0) muxOff = 1 / muxOff;
			statValue = Math.floor(statValue * muxOff);
		}
		return statValue;
	};

	Pokemon.prototype.getTypes = function (conditions) {
		let types = [...this.template.types];
		if (conditions && conditions.volatiles) {
			if (conditions.volatiles.terastallize) return [conditions.volatiles.terastallize];
			if (conditions.volatiles.typechange && conditions.volatiles.typechange[0]) types = conditions.volatiles.typechange[0].split('/');
			if (conditions.volatiles.typeadd) {
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

	Pokemon.prototype.getFullSpe = function (battle, conditions, ignoreBoost) {
		let gen = battle.gen || CurrentGen;

		let spe = Math.floor(this.getStat('spe', gen));
		if (!ignoreBoost) spe = this.getBoostedStat('spe', spe, conditions.boosts);

		if (this.status && this.hasAbility('quickfeet')) {
			spe = Math.floor(spe * 1.5);
		} else if (this.status === 'par') {
			spe = Math.floor(spe * (gen < 7 ? 0.25 : 0.5));
		}
		if (this.hasAbility('slowstart')) spe = Math.floor(spe * 0.5);
		if (this.hasItem({ 'ironball': 1, 'machobrace': 1 })) spe = Math.floor(spe * 0.5);
		if (this.hasItem('choicescarf')) spe = Math.floor(spe * 1.5);
		if (this.hasItem('quickpowder') && this.template.species === 'Ditto') spe = Math.floor(spe * 2);
		if (conditions['tailwind']) spe *= 2;
		if (conditions.volatiles['unburden']) spe *= 2;

		let gconditions = battle.conditions;
		if (gconditions.weather && !gconditions.supressedWeather) {
			if (toId(gconditions.weather) in { 'desolateland': 1, 'sunnyday': 1 } && this.hasAbility('chlorophyll')) spe *= 2;
			if (toId(gconditions.weather) in { 'primordealsea': 1, 'raindance': 1 } && this.hasAbility('swiftswim')) spe *= 2;
			if (toId(gconditions.weather) === 'sandstorm' && this.hasAbility('sandrush')) spe *= 2;
			if (toId(gconditions.weather) === 'hail' && this.hasAbility('slushrush')) spe *= 2;
		}
		if (gconditions['electricterrain'] && this.hasAbility('surgesurfer')) spe = Math.floor(spe * 2);

		return spe;
	};

	return Pokemon;
})();

var Conditions = exports.Conditions = (function () {
	function Conditions(data) {
		if (typeof data !== 'object') throw new Error('Invalid conditions data');
		this.volatiles = {};
		this.boosts = {};
		this.side = {};
		this.immediate = {};
		for (var i in data) {
			if (typeof this[i] === 'undefined' || typeof this[i] === 'function') continue;
			this[i] = { ...data[i] };
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
	function Damage(hp, rolls) {
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
		this.percents.sort();
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
		return this.percents[Math.ceil(this.percents.length / 2) - 1];
	};

	return Damage;
})();

exports.getHazardsDamage = function (poke, conditions, gconditions, gen, battleId) {
	if ((gen >= 3 && poke.hasAbility('magicguard')) || poke.hasItem('heavydutyboots')) return 0;

	let side = conditions.side;
	if (poke.template.species === 'Shedinja' && (side['stealthrock'] || side['spikes'] || side['gmaxsteelsurge'])) return 100;

	let inverse = !!gconditions['inversebattle'];
	let dmg = 0;

	if (side['stealthrock']) {
		dmg += (100 * TypeChart.getMultipleEff('Rock', poke.getTypes(conditions), gen, false, !!gconditions.inversebattle, battleId)) / 8.0;
	}
	if (side['spikes']) {
		if (gconditions['gravity'] || !poke.isGrounded(conditions)) dmg += (100 * side['spikes']) / 24.0;
	}
	if (side['gmaxsteelsurge']) {
		dmg += (100 * TypeChart.getMultipleEff('Steel', poke.getTypes(conditions), gen, false, !!gconditions.inversebattle, battleId)) / 8.0;
	}

	return dmg;
};

var getMoveType = exports.getMoveType = function (poke, move, conditions, gconditions, gen) {
	switch (move.id) {
		case 'aurawheel':
			if (poke.template.species === 'Morpeko-Hangry') return 'Dark';
			return move.type;
		case 'judgment':
			return poke.item?.onPlate || move.type;
		case 'multiattack':
			return poke.item?.onMemory || move.type;
		case 'naturalgift':
			return poke.item?.naturalGift?.type || move.type;
		case 'revelationdance':
			return poke.getTypes(conditions)[0];
		case 'struggle':
			return move.type;
		case 'technoblast':
			return poke.item?.onDrive || move.type;
		case 'weatherball':
			if (gconditions.weather in { 'primordialsea': 1, 'raindance': 1 }) return 'Water';
			if (gconditions.weather in { 'desolateland': 1, 'sunnyday': 1 }) return 'Fire';
			if (gconditions.weather === 'sandstorm') return 'Rock';
			if (gconditions.weather === 'hail') return 'Ice';
			return move.type;
		case 'terrainpulse':
			if (gconditions['electricterrain']) return 'Electric';
			if (gconditions['grassyterrain']) return 'Grass';
			if (gconditions['mistyterrain']) return 'Fairy';
			if (gconditions['psychicterrain']) return 'Psychic';
			return move.type;
		case 'terablast':
			return conditions.volatiles.terastallize || move.type;
	}

	if (gen >= 3 && poke.ability && !poke.supressedAbility) {
		switch (poke.ability.id) {
			case 'normalize':
				return 'Normal';
			case 'aerilate':
				if (move.type === 'Normal') return 'Flying';
			case 'pixilate':
				if (move.type === 'Normal') return 'Fairy';
			case 'refrigerate':
				if (move.type === 'Normal') return 'Ice';
			case 'galvanize':
				if (move.type === 'Normal') return 'Electric';
			case 'liquidvoice':
				if (move.flags && move.flags['sound']) return 'Water';
		}
	}

	return move.type;
}

var getDamage = function (level, bp, atk, def, modifier, typesMux) {
	if (bp === 0) return 0;
	return Math.floor((Math.floor(Math.floor((Math.floor(2 * level / 5.0) + 2) * bp * atk / def) / 50.0) + 2) * modifier * typesMux) || 1;
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

exports.calculate = function (attacker, defender, move, globalConditions, battle, transformation) {
	const attackerPoke = attacker.poke;
	const attackerConditions = new Conditions(attacker.conditions || {});
	const defenderPoke = defender.poke;
	const defenderConditions = new Conditions(defender.conditions || {});

	if (typeof transformation === 'object' && transformation?.terastallize) {
		attackerConditions.volatiles.terastallize = transformation.terastallize;
	}

	const gen = battle.gen || CurrentGen;
	const battleId = battle.id;

	if (!globalConditions) globalConditions = {};
	globalConditions.supressedWeather = (attackerPoke.hasAbility({ 'airlock': 1, 'cloudnine': 1 }) || defenderPoke.hasAbility({ 'airlock': 1, 'cloudnine': 1 }));
	let supressedWeather = globalConditions.supressedWeather;

	let statsA = attackerPoke.getStats(gen), statsB = defenderPoke.getStats(gen);
	let speA = attackerPoke.getFullSpe({ conditions: globalConditions, gen: gen }, attackerConditions, false);
	let speB = defenderPoke.getFullSpe({ conditions: globalConditions, gen: gen }, defenderConditions, false);

	let atk, def, atkStat, defStat;
	let cat, defcat;

	/******************************
	* Attack and Defense Stats
	*******************************/

	if (move.isMax && move.basePower <= 10 && attackerPoke.template.baseStats.spa > attackerPoke.template.baseStats.atk) {
		move = Object.assign({}, move);
		move.category = 'Special';
	}

	if (gen > 3) {
		cat = move.category;
	} else {
		const specialTypes = { Fire: 1, Water: 1, Grass: 1, Ice: 1, Electric: 1, Dark: 1, Psychic: 1, Dragon: 1 };
		cat = (move.type && move.type in specialTypes ? 'Special' : 'Physical');
	}

	if (cat === 'Special') {
		atkStat = 'spa';
	} else if (cat === 'Physical') {
		atkStat = 'atk';
	} else {
		return new Damage(statsB.hp);
	}

	defcat = (move.defensiveCategory ? move.defensiveCategory : cat);
	if (defcat === 'Special') {
		defStat = 'spd';
	} else if (defcat === 'Physical') {
		defStat = 'def';
	} else {
		return new Damage(statsB.hp);
	}

	// custom attacking stat
	if (move.id === 'bodypress') atkStat = 'def';
	if ((move.id in { 'photongeyser': 1, 'lightthatburststhesky': 1, 'terablast': 1 } && statsA.atk > statsA.spa) || (move.id === 'shellsidearm' && statsA.atk / statsB.def > statsA.spa / statsB.spd)) {
		atkStat = 'atk';
		defStat = 'def';
		if (move.id === 'shellsidearm') {
			move = Object.assign({}, move);
			move.flags = Object.assign({}, move.flags);
			move.flags['contact'] = true;
		}
	}

	atk = statsA[atkStat];
	def = statsB[defStat];
	if (move.id === 'foulplay') atk = statsB.atk;

	let moveType = getMoveType(attackerPoke, move, attackerConditions, globalConditions, gen) || 'Normal';
	let movePriority = move.priority;

	if (move.id === 'grassyglide' && globalConditions['grassyterrain'] && attackerPoke.isGrounded(attackerConditions)) movePriority++;

	if (gen >= 3 && attackerPoke.ability && !attackerPoke.supressedAbility) {
		switch (attackerPoke.ability.id) {
			case 'blaze':
				if (moveType === 'Fire' && attackerPoke.hp <= (100 / 3)) atk = Math.floor(atk * 1.5);
				break;
			case 'defeatist':
				if (attackerPoke.hp < 50 && cat === 'Physical') atk = Math.floor(atk * 0.5);
				break;
			case 'guts':
				if (attackerPoke.status && attackerPoke.status !== 'frz' && cat === 'Physical') atk = Math.floor(atk * 1.5);
				break;
			case 'hugepower':
			case 'purepower':
				if (atkStat === 'atk') atk = Math.floor(atk * 2);
				break;
			case 'hustle':
			case 'gorillatactics':
				if (atkStat === 'atk') atk = Math.floor(atk * 1.5);
				break;
			case 'solarpower':
				if (!supressedWeather && globalConditions.weather in { 'desolateland': 1, 'sunnyday': 1 }) {
					if (cat === 'Special') atk = Math.floor(atk * 1.5);
				}
				break;
			case 'overgrow':
				if (moveType === 'Grass' && attackerPoke.hp <= (100 / 3.0)) atk = Math.floor(atk * 1.5);
				break;
			case 'swarm':
				if (moveType === 'Bug' && attackerPoke.hp <= (100 / 3.0)) atk = Math.floor(atk * 1.5);
				break;
			case 'torrent':
				if (moveType === 'Water' && attackerPoke.hp <= (100 / 3.0)) atk = Math.floor(atk * 1.5);
				break;
			case 'triage':
				if (move.flags && move.flags['heal']) movePriority += 3;
				break;
			case 'galewings':
				if (moveType === 'Flying' && (this.gen <= 6 || attackerPoke.hp >= 100)) movePriority++;
				break;
		}
	}

	if (gen >= 3 && defenderPoke.ability && (!attackerPoke.ability || !(attackerPoke.ability.id in { 'moldbreaker': 1, 'turboblaze': 1, 'teravolt': 1 })) && !move.ignoreAbility) {
		switch (defenderPoke.ability.id) {
			case 'marvelscale':
				if (attackerPoke.status && defStat === 'def') def = Math.floor(def * 1.5);
				break;
			case 'furcoat':
				if (defStat === 'def') def = Math.floor(def * 2);
				break;
			case 'icescales':
				if (defStat === 'spd') def = Math.floor(def * 2);
				break;
		}
	}

	/******************************
	* Types (effectiveness)
	* Immunity (0 damage)
	*******************************/

	let notImmune = false;
	if (move.id === 'struggle') notImmune = true;
	if (moveType in { 'Fighting': 1, 'Normal': 1 } && (defenderConditions.volatiles['foresight'] || attackerPoke.hasAbility('scrappy'))) notImmune = true;
	if (moveType === 'Ground' && (move.id === 'thousandarrows' || globalConditions['gravity'])) notImmune = true;
	let defTypes = defenderPoke.getTypes(defenderConditions).slice();
	let typesMux = TypeChart.getMultipleEff(moveType, defTypes, gen, notImmune, !!globalConditions.inversebattle, battleId);
	if (move.id === 'flyingpress') typesMux *= TypeChart.getMultipleEff('Flying', defTypes, gen, notImmune, !!globalConditions.inversebattle, battleId);
	if (move.id === 'freezedry' && defTypes.indexOf('Water') >= 0 && !globalConditions.inversebattle) typesMux *= (2 / TypeChart.getEffectiveness(moveType, 'Water', gen, !!globalConditions.inversebattle, battleId));

	let immune = false;

	if (gen <= 2 && move.drain && defenderConditions.volatiles['substitute']) immune = true;
	if (!defenderPoke.isGrounded(defenderConditions) && moveType === 'Ground' && !notImmune) immune = true;

	if (gen >= 3 && defenderPoke.ability && !defenderPoke.supressedAbility && !attackerPoke.hasAbility({ 'moldbreaker': 1, 'teravolt': 1, 'turboblaze': 1, 'neutralizinggas': 1 }) && !move.ignoreAbility) {
		switch (defenderPoke.ability.id) {
			case 'dryskin':
			case 'stormdrain':
			case 'waterabsorb':
				if (moveType === 'Water') immune = true;
				break;
			case 'flashfire':
				if (moveType === 'Fire') immune = true;
				break;
			case 'lightningrod':
			case 'motordrive':
			case 'voltabsorb':
				if (moveType === 'Electric') immune = true;
				break;
			case 'sapsipper':
				if (moveType === 'Grass') immune = true;
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
				if (typesMux < 2) immune = true;
				break;
		}
	}

	if (immune || typesMux === 0) return new Damage(statsB.hp);

	/******************************
	* Base power
	*******************************/

	let bp = move.basePower || 0;

	if (cat === 'Physical' && attackerPoke.status === 'brn') {
		if (gen < 3) atk = Math.floor(atk * 0.5);
		else if (!attackerPoke.hasAbility('guts')) bp = Math.floor(bp * 0.5);
	}

	if (move.isMax && bp <= 10) {
		bp = (moveType in { 'Fighting': 1, 'Poison': 1 } ? 90 : 130);
	}

	switch (move.id) {
		// undetermined bp
		case 'frustration':
			if (typeof attackerPoke.happiness !== 'number') bp = 102;
			else bp = Math.floor(((255 - attackerPoke.happiness) * 2) / 5) || 1;
			break;
		case 'return':
		case 'pikapapow':
		case 'veeveevolley':
			if (typeof attackerPoke.happiness !== 'number') bp = 102;
			else bp = Math.floor((attackerPoke.happiness * 2) / 5) || 1;
			break;
		case 'fling':
			if (attackerPoke.item && attackerPoke.item.fling) bp = attackerPoke.item.fling.basePower || 0;
			else bp = 0;
			break;
		case 'naturalgift':
			if (attackerPoke.item && attackerPoke.item.naturalGift && attackerPoke.item.naturalGift.basePower) bp = attackerPoke.item.naturalGift.basePower;
			else bp = 0;
			break;
		case 'grassknot':
		case 'lowkick':
			if (defenderConditions.volatiles['dynamax']) {
				bp = 0;
			} else if (defenderPoke.template.weightkg) {
				if (defenderPoke.template.weightkg >= 200) {
					bp = 120;
				} else if (defenderPoke.template.weightkg >= 100) {
					bp = 100;
				} else if (defenderPoke.template.weightkg >= 50) {
					bp = 80;
				} else if (defenderPoke.template.weightkg >= 25) {
					bp = 60;
				} else if (defenderPoke.template.weightkg >= 10) {
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
			if (defenderConditions.volatiles['dynamax']) {
				bp = 0;
			} else if (attackerPoke.template.weightkg && defenderPoke.template.weightkg) {
				if (attackerPoke.template.weightkg / defenderPoke.template.weightkg > 5) {
					bp = 120;
				} else if (attackerPoke.template.weightkg / defenderPoke.template.weightkg > 4) {
					bp = 100;
				} else if (attackerPoke.template.weightkg / defenderPoke.template.weightkg > 3) {
					bp = 80;
				} else if (attackerPoke.template.weightkg / defenderPoke.template.weightkg > 2) {
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
			bp = (Math.floor(120 * (defenderPoke.hp / 100)) || 1);
			if (bp > 120) bp = 120;
			break;
		case 'punishment':
			bp = 60;
			for (var stat in defenderConditions.boosts) {
				if (defenderConditions.boosts[stat] > 0) bp += (20 * defenderConditions.boosts[stat]);
			}
			break;
		case 'beatup':
			bp = Math.floor(attackerPoke.template.baseStats.atk / 10) + 5;
		case 'trumpcard':
		case 'present':
			bp = 40;
			break;
		case 'magnitude':
			bp = 10;
			break;

		// altered bp
		case 'smellingsalts':
			if (defenderPoke.status === 'par') bp *= 2;
			break;
		case 'wakeupslap':
			if (defenderPoke.status === 'slp') bp *= 2;
			break;
		case 'dreameater':
			if (defenderPoke.status !== 'slp') bp = 0;
			break;
		case 'snore':
			if (attackerPoke.status !== 'slp') bp = 0;
			break;
		case 'venoshock':
			if (defenderPoke.status in { 'psn': 1, 'tox': 1 }) bp *= 2;
			break;
		case 'hex':
			if (defenderPoke.status) bp *= 2;
			break;
		case 'brine':
			if (defenderPoke.hp <= 50) bp *= 2;
			break;
		case 'facade':
			if (attackerPoke.status && !(attackerPoke.status in { 'slp': 1, 'frz': 1 })) bp *= 2;
			break;
		case 'knockoff':
			if (defenderPoke.item && !defenderPoke.onTakeItem) bp = Math.floor(bp * 1.5);
			break;
		case 'acrobatics':
			if (!attackerPoke.item || !attackerPoke.item.id || attackerPoke.item.id === 'flyinggem') bp *= 2;
			break;
		case 'poltergeist':
			if (!defenderPoke.item || !defenderPoke.item.id) bp = 0;
			break;
		case 'retaliate':
			if (attackerConditions.side.faintedLastTurn) bp *= 2;
			break;
		case 'payback':
			if ((!globalConditions['trickroom'] && speA < speB) || (globalConditions['trickroom'] && speA > speB)) bp *= 2;
			break;
		case 'avalanche':
		case 'revenge':
		case 'boltbeak':
		case 'fishiousrend':
			bp *= 2;
			break;
		case 'behemothblade':
		case 'behemothbash':
		case 'dynamaxcannon':
			if (defenderConditions.volatiles['dynamax']) bp *= 2;
			break;
		case 'weatherball':
			if (globalConditions.weather) bp *= 2;
			break;
		case 'solarbeam':
		case 'solarblade':
			if (toId(globalConditions.weather) in { 'primordialsea': 1, 'raindance': 1, 'sandstorm': 1, 'hail': 1 }) bp = Math.floor(bp * 0.5);
			break;
		case 'hyperspacefury':
			if (attackerPoke.template.species !== 'Hoopa-Unbound') bp = 0;
			break;
		case 'aurawheel':
			if (!attackerPoke.template.species.startsWith('Morpeko')) bp = 0;
			break;
		case 'waterspout':
		case 'eruption':
			bp *= (attackerPoke.hp / 100.0);
			break;
		case 'storedpower':
		case 'powertrip':
			for (var stat in attackerConditions.boosts) {
				if (attackerConditions.boosts[stat] > 0) bp += (20 * attackerConditions.boosts[stat]);
			}
			break;
		case 'gravapple':
			if (globalConditions['gravity']) bp = Math.floor(bp * 1.5);
			break;
		case 'terrainpulse':
			if (attackerPoke.isGrounded(attackerConditions)) {
				for (gcondition in globalConditions) {
					if (gcondition.endsWith('terrain')) bp *= 2;
				}
			}
			break;
		case 'steelroller':
			let terrainActive = false;
			for (gcondition in globalConditions) {
				if (gcondition.endsWith('terrain')) terrainActive = true;
			}
			if (!terrainActive) bp = 0;
			break;
		case 'risingvoltage':
			if (globalConditions['electricterrain'] && defenderPoke.isGrounded(defenderConditions)) bp *= 2;
			break;
		case 'expandingforce':
			if (globalConditions['psychicterrain'] && attackerPoke.isGrounded(attackerConditions)) bp = Math.floor(bp * 1.5);
			break;
		case 'mistyexplosion':
			if (globalConditions['mistyterrain'] && attackerPoke.isGrounded(attackerConditions)) bp = Math.floor(bp * 1.5);
			break;
	}

	if (!bp) {
		if (move.damage === 'level') return new Damage(statsB.hp, [attackerPoke.level]);
		if (typeof move.damage === 'number') return new Damage(statsB.hp, [move.damage]);
		if (move.id === 'endeavor') new Damage(statsB.hp, [Math.max(0, statsB.hp * (defenderPoke.hp / 100.0) - statsA.hp * (attackerPoke.hp / 100.0))]);
		if (move.id === 'psywave') new Damage(statsB.hp, getRolls(attackerPoke.level, 0.5, 1.5));
		return new Damage(statsB.hp);
	}

	if (gen >= 3 && attackerPoke.ability && !attackerPoke.supressedAbility && !defenderPoke.hasAbility('neutralizinggas')) {
		switch (attackerPoke.ability.id) {
			case 'technician':
				if (bp <= 60) bp = Math.floor(bp * 1.5);
				break;
			case 'toxicboost':
				if (cat === 'Physical' && attackerPoke.status in { 'psn': 1, 'tox': 1 }) bp = Math.floor(bp * 1.5);
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
					if (defenderPoke.hasAbility('aurabreak')) bp = Math.floor(bp * 0.75);
					else bp = Math.floor(bp * 1.33);
				}
				break;
			case 'fairyaura':
				if (move.type === 'Fairy') {
					if (defenderPoke.hasAbility('aurabreak')) bp = Math.floor(bp * 0.75);
					else bp = Math.floor(bp * 1.33);
				}
				break;
			case 'steelworker':
			case 'steelyspirit':
				if (move.type === 'Steel') bp = Math.floor(bp * 1.5);
				break;
			case 'waterbubble':
				if (move.type === 'Water') bp *= 2;
				break;
			case 'flareboost':
				if (cat === 'Special' && attackerPoke.status === 'brn') bp = Math.floor(bp * 1.5);
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
				if (!(attackerPoke.gender === 'N' || defenderPoke.gender === 'N')) {
					if (attackerPoke.gender === defenderPoke.gender) {
						bp = Math.floor(bp * 1.25);
					} else {
						bp = Math.floor(bp * 0.75);
					}
				}
				break;
			case 'sandforce':
				if (!supressedWeather && globalConditions.weather === 'sandstorm' && moveType in { 'Rock': 1, 'Ground': 1, 'Steel': 1 }) bp = Math.floor(bp * 1.3);
				break;
			case 'sheerforce':
				if (move.secondaries) bp = Math.floor(bp * 1.3);
				break;
			case 'strongjaw':
				if (move.flags && move.flags['bite']) bp = Math.floor(bp * 1.5);
				break;
			case 'analytic':
				if ((!globalConditions['trickroom'] && speA < speB) || (globalConditions['trickroom'] && speA > speB)) bp = Math.floor(bp * 1.3);
				break;
			case 'tintedlens':
				if (typesMux < 1) bp *= 2;
				break;
			case 'neuroforce':
				if (typesMux > 1) bp = Math.floor(bp * 1.25);
				break;
			case 'punkrock':
				if (move.flags && move.flags['sound']) bp = Math.floor(bp * 1.3);
				break;
		}
	}

	if (gen >= 3 && defenderPoke.ability && !defenderPoke.supressedAbility && !attackerPoke.hasAbility('neutralizinggas')) {
		switch (defenderPoke.ability.id) {
			case 'prismarmor':
				if (typesMux > 1) bp = Math.floor(bp * 0.75);
				break;
			case 'shadowshield':
				if (defenderPoke.hp >= 100) bp = Math.floor(bp * 0.5);
				break;
		}
		if (!attackerPoke.hasAbility({ 'moldbreaker': 1, 'teravolt': 1, 'turboblaze': 1 }) && !move.ignoreAbility) {
			switch (defenderPoke.ability.id) {
				case 'fluffy':
					if (moveType === 'Fire') bp *= 2;
					if (move.flags && move.flags['contact']) bp = Math.floor(bp * 0.5);
					break;
				case 'darkaura':
					if (move.type === 'Dark') {
						if (attackerPoke.hasAbility('aurabreak')) bp = Math.floor(bp * 0.75);
						else bp = Math.floor(bp * 1.33);
					}
					break;
				case 'fairyaura':
					if (move.type === 'Fairy') {
						if (attackerPoke.hasAbility('aurabreak')) bp = Math.floor(bp * 0.75);
						else bp = Math.floor(bp * 1.33);
					}
					break;
				case 'dryskin':
					if (moveType === 'Fire') bp = Math.floor(bp * 1.25);
					break;
				case 'thickfat':
					if (moveType in { 'Ice': 1, 'Fire': 1 }) atk = Math.floor(atk * 0.5);
					break;
				case 'heatproof':
				case 'waterbubble':
					if (moveType === 'Fire') bp = Math.floor(bp * 0.5);
					break;
				case 'filter':
				case 'solidrock':
					if (typesMux > 1) bp = Math.floor(bp * 0.75);
					break;
				case 'multiscale':
					if (defenderPoke.hp >= 100) bp = Math.floor(bp * 0.5);
					break;
				case 'punkrock':
					if (move.flags && move.flags['sound']) bp = Math.floor(bp * 0.5);
					break;
			}
		}
	}

	if (attackerPoke.item) {
		switch (attackerPoke.item.id) {
			case 'lightball':
				if (attackerPoke.template.species.startsWith('Pikachu')) atk = Math.floor(atk * 2);
			case 'thickclub':
				if (atkStat === 'atk' && attackerPoke.template.species === 'Clamperl') atk = Math.floor(atk * 2);
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
				if (attackerPoke.template.types.indexOf(moveType) >= 0) bp = Math.floor(bp * 1.2);
				break;
			case 'silkscarf':
				if (moveType === 'Normal') bp = Math.floor(bp * 1.2);
				break;
			case 'expertbelt':
				if (typesMux > 1) bp = Math.floor(bp * 1.2);
				break;
		}
		if (attackerPoke.item.isGem && attackerPoke.item.name.startsWith(moveType)) bp = Math.floor(bp * (gen >= 6 ? 1.3 : 1.5));
		if (attackerPoke.item.onPlate === moveType) bp = Math.floor(bp * 1.2);
	}

	if (defenderPoke.item) {
		if (defenderPoke.item.onSourceModifyDamage && defenderPoke.item.naturalGift && defenderPoke.item.naturalGift.type === move.type && !attackerPoke.hasAbility('unnerve')) {
			if (defenderPoke.hasAbility('ripen')) bp = Math.floor(bp * 0.25);
			else bp = Math.floor(bp * 0.5);
		}
		switch (defenderPoke.item.id) {
			case 'metalpowder':
				if (defStat === 'def' && attackerPoke.template.species === 'Ditto') def = Math.floor(def * 2);
				break;
			case 'deepseascale':
				if (defStat === 'spd' && attackerPoke.template.species === 'Clamperl') def = Math.floor(def * 2);
				break;
			case 'eviolite':
				if (attackerPoke.evos) def = Math.floor(def * 1.5);
				break;
			case 'assaultvest':
				if (defStat === 'spd') def = Math.floor(def * 1.5);
				break;
		}
	}

	/******************************
	* Modifiers
	*******************************/

	let modifier = 1;

	if (attackerPoke.item && attackerPoke.item.id === 'lifeorb') modifier *= 1.3;

	/* STAB */
	let stab;
	if (attackerConditions.volatiles.terastallize) {
		let originalStab = (attackerPoke.template.types.includes(moveType) >= 0 || attackerPoke.hasAbility({ 'libero': 1, 'protean': 1 }));
		let teraStab = (move.type === attackerConditions.volatiles.terastallize);
		if (originalStab && teraStab) {
			debug('applying double stab from terastallization');
			stab = 2;
		} else if (originalStab || teraStab) {
			stab = 1.5;
		}
	} else {
		if (attackerPoke.hasType(moveType, attackerConditions) >= 0 || attackerPoke.hasAbility({ 'libero': 1, 'protean': 1 })) {
			stab = 1.5;
		}
	}
	if (stab) {
		if (gen >= 3 && attackerPoke.hasAbility('adaptability')) stab *= (4.0 / 3.0);
		modifier *= stab;
	}

	/* Weather */
	if (globalConditions.weather && !supressedWeather) {
		if (move.type === 'Water' && (toId(globalConditions.weather) in { 'primordialsea': 1, 'raindance': 1 })) modifier *= 1.5;
		if (move.type === 'Fire' && (toId(globalConditions.weather) in { 'desolateland': 1, 'sunnyday': 1 })) modifier *= 1.5;

		if (globalConditions.weather === 'desolateland' && move.type === 'Water') modifier = 0;
		if (globalConditions.weather === 'primordialsea' && move.type === 'Fire') modifier = 0;

		if (globalConditions.weather === 'sunnyday' && move.type === 'Water') modifier *= 0.5;
		if (globalConditions.weather === 'raindance' && move.type === 'Fire') modifier *= 0.5;
	}

	if (gen >= 4 && defTypes.indexOf('Rock') >= 0 && globalConditions.weather === 'sandstorm') {
		if (defStat === 'spd') def = Math.floor(def * 1.5);
	}

	/* Boosting */

	if (attackerConditions.boosts && !defenderPoke.hasAbility('unaware')) {
		if (move.id === 'foulplay') atk = defenderPoke.getBoostedStat(atkStat, atk, defenderConditions.boosts);
		else atk = attackerPoke.getBoostedStat(atkStat, atk, attackerConditions.boosts);
	}

	let willCrit = attackerConditions.immediate['crit'] || move.willCrit || attackerPoke.hasItem({ 'leek': 1, 'luckypunch': 1, 'stick': 1 });

	if (defenderConditions.boosts[defStat]) {
		if (!willCrit && !move.ignoreDefensive && !attackerPoke.hasAbility('unaware')) {
			def = defenderPoke.getBoostedStat(defStat, def, defenderConditions.boosts)
		}
	}

	/* immediate */

	if (willCrit) {
		modifier *= (gen > 5 ? 1.5 : 2);
	}

	if (attackerConditions.immediate['helpinghand']) modifier *= 1.5;

	/* Side */

	const screenModifier = (globalConditions['gametype'] in { 'doubles': 1, 'triples': 1 } ? 0.66 : 0.5);
	if (!(move.id in { 'brickbreak': 1, 'psychicfangs': 1 }) && !attackerPoke.hasAbility('infiltrator')) {
		if (defenderConditions.volatiles['reflect'] && cat === 'Physical') modifier *= 0.5; // Gen 1
		if ((defenderConditions.side['reflect'] || defenderConditions.side['auroraveil']) && cat === 'Physical') modifier *= screenModifier;
		if ((defenderConditions.side['lightscreen'] || defenderConditions.side['auroraveil']) && cat === 'Special') modifier *= screenModifier;
	}

	if (defenderConditions.volatiles['magnetrise'] && moveType === 'Ground') modifier = 0;

	/* Field */

	const terrainBoost = (gen >= 8 ? 1.3 : 1.5);
	if (attackerPoke.isGrounded(attackerConditions)) {
		if (globalConditions['electricterrain'] && moveType === 'Electric') bp = Math.floor(bp * terrainBoost);
		if (globalConditions['grassyterrain'] && moveType === 'Grass') bp = Math.floor(bp * terrainBoost);
		if (globalConditions['psychicterrain'] && moveType === 'Psychic') bp = Math.floor(bp * terrainBoost);
	}
	if (defenderPoke.isGrounded(defenderConditions)) {
		if (globalConditions['grassyterrain'] && move.id in { 'bulldoze': 1, 'earthquake': 1, 'magnitude': 1 }) bp = Math.floor(bp * 0.5);
		if (globalConditions['psychicterrain'] && movePriority > 0) modifier = 0;
		if (globalConditions['mistyterrain'] && moveType === 'Dragon') bp = Math.floor(bp * 0.5);
	}

	if (globalConditions['gametype'] in { 'doubles': 1, 'triples': 1 }) {
		if (move.target.startsWith('allAdjacent')) modifier *= 0.75;
	}

	/******************************
	* Damage
	*******************************/

	let hitsBP = [bp];
	if (move.id in { 'tripleaxel': 1, 'triplekick': 1 }) {
		if (this.gen === 2) hitsBP = [bp, bp, bp];
		else hitsBP = [bp, 2 * bp, 3 * bp];
	} else if (move.multihit) {
		let numberOfHits = (typeof move.multihit === 'number' ? move.multihit : (move.multihit[1] || 1));
		for (let hit = 1; hit < numberOfHits; hit++) {
			hitsBP.push(bp);
		}
	} else if (move.id === 'beatup') {
		hitsBP = [bp, bp, bp, bp, bp, bp];
	} else if (attackerPoke.hasAbility('parentalbond') && !defenderPoke.hasAbility('neutralizinggas')) {
		if (!move.multihit && !move.selfdestruct && !move.multihit && !(move.flags && move.flags['charge']) && !(move.spreadHit && globalConditions['gametype'] in { 'doubles': 1, 'triples': 1 }) && !move.isZ && !move.isMax) {
			let secondHitMultiplier = 1;
			if (move.id === 'acidspray' && !defenderPoke.hasAbility({ 'clearbody': 1, 'fullmetalbody': 1, 'mirrorarmor': 1, 'whitesmoke': 1 })) {
				if (!defenderPoke.hasAbility('contrary')) secondHitMultiplier = 2;
				else secondHitMultiplier = 0.5;
			} else if (move.id in { 'chargebeam': 1, 'fierydance': 1, 'poweruppunch': 1 } || (move.category === 'Physical' && defenderPoke.hasAbility('weakarmor'))) {
				secondHitMultiplier = 1.5;
			} else if (move.id in { 'appleacid': 1, 'firelash': 1, 'gravapple': 1 } && !defenderPoke.hasAbility({ 'clearbody': 1, 'fullmetalbody': 1, 'mirrorarmor': 1, 'whitesmoke': 1 })) {
				if (!defenderPoke.hasAbility('contrary')) secondHitMultiplier = 1.5;
				else secondHitMultiplier = 0.66;
			} else if (move.id === 'superpower') {
				secondHitMultiplier = 0.66;
			} else if (move.id in { 'dracometeor': 1, 'fleurcannon': 1, 'leafstorm': 1, 'overheat': 1, 'psychoboost': 1 }) {
				secondHitMultiplier = 0.5;
			} else {
				secondHitMultiplier = 1;
			}
			hitsBP = [bp, ((gen >= 7 ? 0.25 : 0.5) * secondHitMultiplier) * bp];
		}
	}

	let multihitRolls = [];
	if (move.multihit && typeof move.multihit !== 'number' && !(attackerPoke.hasAbility('skilllink') && !defenderPoke.hasAbility('neutralizinggas'))) {
		if (move.multihit[0] === 2 && move.multihit[1] === 5) {
			multihitRolls = (this.gen >= 5 ? [2, 2, 3, 3, 4, 5] : [2, 2, 2, 3, 3, 3, 4, 5]);
		} else {
			multihitRolls = [move.multihit[0]];
			for (let numberOfHits = move.multihit[0]; numberOfHits < move.multihit[1]; numberOfHits++) {
				multihitRolls.push(numberOfHits);
			}
		}
	}
	if (multihitRolls.length) {
		for (let i = 0; i < multihitRolls.length; i++) {
			let rollDmg = 0;
			for (let hitNumber = 0; hitNumber < multihitRolls[i]; hitNumber++) {
				rollDmg += getDamage(attackerPoke.level, hitsBP[hitNumber], atk, def, modifier, typesMux);
			}
			multihitRolls[i] = rollDmg;
		}
		// multihit rolls more important than damage rolls
		return new Damage(statsB.hp, multihitRolls);
	}

	let dmg = 0;
	for (let hitBP of hitsBP) {
		dmg += getDamage(attackerPoke.level, hitBP, atk, def, modifier, typesMux);
	}

	return new Damage(statsB.hp, getRolls(dmg));
};
