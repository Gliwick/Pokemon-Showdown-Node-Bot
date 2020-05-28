/*
	Battle data
*/

const DATA_DIR = './../../../data/';
const BAT_DATA_DIR = './../data/';
const MODS_DATA_DIR = BAT_DATA_DIR + 'mods/';

const CurrentGen = 8;

exports.getEffect = function (effect, gen) {
	if (!effect || typeof effect === 'string') {
		var name = (effect || '').trim();
		if (name.substr(0, 5) === 'item:') {
			return exports.getItem(name.substr(5), gen);
		} else if (name.substr(0, 8) === 'ability:') {
			return exports.getAbility(name.substr(8), gen);
		} else if (name.substr(0, 5) === 'move:') {
			return exports.getMove(name.substr(5), gen);
		}

		var id = toId(name);
		effect = {};

		var pMove = exports.getMove(id, gen);
		var pAbility = exports.getAbility(id, gen);
		var pItem = exports.getItem(id, gen);
		var statuses = require(BAT_DATA_DIR + "statuses.js").BattleStatuses;

		if (id && statuses && statuses[id]) {
			effect = statuses[id];
			effect.exists = true;
		} else if (id && pMove.effect) {
			effect = pMove.effect;
			effect.exists = true;
		} else if (id && pAbility.effect) {
			effect = pAbility.effect;
			effect.exists = true;
		} else if (id && pItem.effect) {
			effect = pItem.effect;
			effect.exists = true;
		} else if (id === 'recoil') {
			effect = {
				effectType: 'Recoil'
			};
			effect.exists = true;
		} else if (id === 'drain') {
			effect = {
				effectType: 'Drain'
			};
			effect.exists = true;
		}
		if (!effect.id) effect.id = id;
		if (!effect.name) effect.name = Tools.escapeHTML(name);
		if (!effect.category) effect.category = 'Effect';
		if (!effect.effectType) effect.effectType = 'Effect';
	}
	return effect;
};

exports.getPokemon = exports.getTemplate = function (poke, gen, battleId) {
	if (!gen || gen > CurrentGen || gen < 1) gen = CurrentGen;
	poke = toId(poke);
	var pokemon = {};
	var temp;
	try {
		temp = DataDownloader.getPokedex()[poke];
		for (var attr in temp) pokemon[attr] = temp[attr];
	} catch (e) {}
	for (var i = CurrentGen - 1; i >= gen; i--) {
		try {
			temp = require(BAT_DATA_DIR + "gen" + i + "/pokedex.js").BattlePokedex[poke];
			if (!temp) continue;
		} catch (e) {
			continue;
		}
		if (!temp.inherit) {
			for (var i in pokemon) delete pokemon[i];
		}
		for (var attr in temp) pokemon[attr] = temp[attr];
	}

	let formatId = battleId ? battleId.split('-')[1] : '';
	let formatMod = Config.formatMods[formatId];
	if (formatMod) {
		temp = null;
		try {
			temp = require(MODS_DATA_DIR + formatMod + "/pokedex.js").BattlePokedex[poke];
		} catch (e) {}
		if (temp) {
			if (!temp.inherit) {
				for (var i in pokemon) delete pokemon[i];
			}
			for (var attr in temp) pokemon[attr] = temp[attr];
		}
	}

	if (!pokemon.species) pokemon.species = pokemon.name;

	if (!pokemon.name) {
		return {
			num: 0,
			name: poke,
			species: poke,
			types: ["Normal"],
			baseStats: {hp: 90, atk: 90, def: 90, spa: 90, spd: 90, spe: 90},
			abilities: {0: "No Ability"},
			heightm: 0,
			weightkg: 0,
			unknown: true,
		};
	}
	return pokemon;
};

exports.getMove = function (move, gen, battleId) {
	if (!gen || gen > CurrentGen || gen < 1) gen = CurrentGen;
	move = toId(move);
	if (move.indexOf("hiddenpower") === 0) {
		move = move.replace(/[0-9]/g, "");
	}
	var moveData = {};
	var temp;
	try {
		temp = DataDownloader.getMovedex()[move];
		for (var i in temp) moveData[i] = temp[i];
		moveData.id = move;
	} catch (e) {}
	for (var i = CurrentGen - 1; i >= gen; i--) {
		try {
			temp = require(BAT_DATA_DIR + "gen" + i + "/moves.js").BattleMovedex[move];
			if (!temp) continue;
		} catch (e) {
			continue;
		}
		if (!temp.inherit) {
			for (var i in moveData) delete moveData[i];
		}
		for (var i in temp) moveData[i] = temp[i];
	}

	let formatId = battleId ? battleId.split('-')[1] : '';
	let formatMod = Config.formatMods[formatId];
	if (formatMod) {
		temp = null;
		try {
			temp = require(MODS_DATA_DIR + formatMod + "/moves.js").BattleMovedex[move];
		} catch (e) {}
		if (temp) {
			if (!temp.inherit) {
				for (var i in moveData) delete moveData[i];
			}
			for (var attr in temp) moveData[attr] = temp[attr];
		}
	}

	if (!moveData.name) {
		moveData = {
			num: 0,
			accuracy: 100,
			basePower: 90,
			category: 'Physical',
			id: move,
			name: move,
			pp: 10,
			priority: 0,
			flags: {protect: 1},
			effectType: 'Move',
			type: 'Normal',
		};


		const typeAliases = {
			'Bug': ['bug'],
			'Dark': ['dark'],
			'Dragon': ['dragon'],
			'Electric': ['electr', 'thunder'],
			'Fairy': ['fairy'],
			'Fighting': ['fight'],
			'Fire': ['fire', 'flame', 'flare', 'heat'],
			'Flying': ['fly', 'sky'],
			'Ghost': ['ghost', 'shadow'],
			'Grass': ['grass', 'leaf', 'petal', 'seed'],
			'Ground': ['ground', 'earth', 'mud'],
			'Ice': ['ice', 'freeze'],
			'Normal': ['normal'],
			'Poison': ['poison', 'sludge', 'toxic', 'veno'],
			'Psychic': ['psy'],
			'Rock': ['rock', 'stone'],
			'Steel': ['steel', 'iron', 'metal'],
			'Water': ['water', 'aqua', 'bubble', 'hydro'],
		};
		for (let moveType in typeAliases) {
			for (typeAlias of typeAliases[moveType]) {
				if (move.indexOf(typeAlias) >= 0) {
					moveData.type = typeAlias;
					break;
				}
			}
		}
		const specialTypes = {Fairy: 1, Fire: 1, Water: 1, Grass: 1, Ice: 1, Electric: 1, Dark: 1, Psychic: 1, Dragon: 1};
		if (moveData.type in specialTypes) moveData.category = 'Special';
		if (moveData.category ==='Physical' && !(moveData.type in {'Ground':1, 'Rock':1})) moveData.flags.contact = 1;
	}

	if (!moveData.effectType) moveData.effectType = 'Move';
	return moveData;
};

exports.getItem = function (item, gen, battleId) {
	if (!gen || gen > CurrentGen || gen < 1) gen = CurrentGen;
	item = toId(item);
	var itemData = {};
	var temp;
	try {
		temp = DataDownloader.getItems()[item];
		for (var i in temp) itemData[i] = temp[i];
		itemData.id = item;
	} catch (e) {}
	for (var i = CurrentGen - 1; i >= gen; i--) {
		try {
			temp = require(BAT_DATA_DIR + "gen" + i + "/items.js").BattleItems[item];
			if (!temp) continue;
		} catch (e) {
			continue;
		}
		if (!temp.inherit) {
			for (var i in itemData) delete itemData[i];
		}
		for (var i in temp) itemData[i] = temp[i];
	}

	let formatId = battleId ? battleId.split('-')[1] : '';
	let formatMod = Config.formatMods[formatId];
	if (formatMod) {
		temp = null;
		try {
			temp = require(MODS_DATA_DIR + formatMod + "/items.js").BattleItems[move];
		} catch (e) {}
		if (temp) {
			if (!temp.inherit) {
				for (var i in itemData) delete itemData[i];
			}
			for (var attr in temp) itemData[attr] = temp[attr];
		}
	}

	if (!itemData.id) {
		return {
			id: item,
			name: item,
			spritenum: 0,
			num: 0,
			gen: CurrentGen,
			category: "Effect",
			effectType: "Item",
		};
	}
	if (!itemData.category) itemData.category = 'Effect';
	if (!itemData.effectType) itemData.effectType = 'Item';
	return itemData;
};

exports.getAbility = function (ab, gen, battleId) {
	if (!gen || gen > CurrentGen || gen < 1) gen = CurrentGen;
	ab = toId(ab);
	var ability = {};
	var temp;
	try {
		temp = DataDownloader.getAbilities()[ab];
		for (var i in temp) ability[i] = temp[i];
		ability.id = ab;
	} catch (e) {}
	for (var i = CurrentGen - 1; i >= gen; i--) {
		try {
			temp = require(BAT_DATA_DIR + "gen" + i + "/abilities.js").BattleAbilities[ab];
			if (!temp) continue;
		} catch (e) {
			continue;
		}
		if (!temp.inherit) {
			for (var i in ability) delete ability[i];
		}
		for (var i in temp) ability[i] = temp[i];
	}

	let formatId = battleId ? battleId.split('-')[1] : '';
	let formatMod = Config.formatMods[formatId];
	if (formatMod) {
		temp = null;
		try {
			temp = require(MODS_DATA_DIR + formatMod + "/abilities.js").BattleAbilities[move];
		} catch (e) {}
		if (temp) {
			if (!temp.inherit) {
				for (var i in ability) delete ability[i];
			}
			for (var attr in temp) ability[attr] = temp[attr];
		}
	}

	if (!ability.id) {
		return {
			id: ab,
			name: ab,
			rating: 0,
			num: 0,
			category: "Effect",
			effectType: "Ability",
		};
	}
	if (!ability.category) ability.category = 'Effect';
	if (!ability.effectType) ability.effectType = 'Ability';
	return ability;
};

var Move = exports.Move = (function () {
	function Move (template) {
		if (!template || typeof template !== "object") throw new Error("Invalid move template");
		this.template = template;
		this.name = this.template.name;
		this.id = this.template.id;
		this.pp = Math.floor(this.template.pp * 1.6);
		this.disabled = false;
		this.helpers = {};
	}

	Move.prototype.restorePP = function (pp) {
		if (pp) {
			this.pp += pp;
		} else {
			this.pp = Math.floor(this.template.pp * 1.6);
		}
	};

	return Move;
})();

exports.Pokemon = (function () {
	function Pokemon (template, properties) {
		if (!template || typeof template !== "object") throw new Error("Invalid pokemon template");

		this.template = template;
		this.species = this.template.species;
		this.name = this.template.species;

		this.transformed = false;
		this.transformPrev = null;

		this.gender = false;
		this.level = 100;
		this.shiny = false;

		this.item = "&unknown";
		this.itemEffect = '';
		this.prevItem = null;
		this.prevItemEffect = '';

		this.ability = "&unknown";
		this.supressedAbility = false;
		this.baseAbility = "&unknown";
		this.abilityStack = [];

		this.moves = [];

		this.active = false;
		this.slot = -1;

		this.hp = 100;
		this.fainted = false;
		this.status = false;
		this.volatiles = {};
		this.boosts = {};

		this.passing = false;
		this.prepared = null;

		this.helpers = {};

		for (var i in properties) {
			if (typeof this[i] === "undefined" || typeof this[i] === "function") continue;
			if (i === "template") continue;
			this[i] = properties[i];
		}
	}

	Pokemon.prototype.addVolatile = function (volatile) {
		volatile = toId(volatile);
		this.volatiles[volatile] = true;
	};

	Pokemon.prototype.removeVolatile = function (volatile) {
		volatile = toId(volatile);
		if (this.volatiles[volatile]) delete this.volatiles[volatile];
	};

	Pokemon.prototype.removeAllVolatiles = function () {
		for (var i in this.volatiles) delete this.volatiles[i];
	};

	Pokemon.prototype.addBoost = function (stat, n) {
		if (!this.boosts[stat]) this.boosts[stat] = 0;
		this.boosts[stat] += n;
	};

	Pokemon.prototype.setBoost = function (stat, n) {
		this.boosts[stat] = n;
	};

	Pokemon.prototype.invertAllBoosts = function () {
		for (var i in this.boosts) {
			this.boosts[i] = this.boosts[i] * (-1);
		}
	};

	Pokemon.prototype.removeAllBoosts = function () {
		for (var i in this.boosts) delete this.boosts[i];
	};

	Pokemon.prototype.markAbility = function (id, isNotBase) {
		this.ability = exports.getAbility(id);
		if ((!this.baseAbility || this.baseAbility === "&unknown") && !isNotBase) {
			this.baseAbility = this.ability;
			this.abilityStack.push(this.ability.id);
		} else if (isNotBase && this.baseAbility && this.baseAbility !== "&unknown") {
			if (this.ability.id === this.baseAbility.id) {
				if (this.abilityStack[this.abilityStack.length - 1] === this.ability.id) {
					this.abilityStack.pop();
				}
				if (this.abilityStack[this.abilityStack.length - 1]) {
					this.baseAbility = exports.getAbility(this.abilityStack[this.abilityStack.length - 1]);
				} else {
					this.baseAbility = "&unknown";
				}
			}
		}
	};

	Pokemon.prototype.prepareMove = function (move, target) {
		this.prepared = {
			move: move,
			target: target
		};
	};

	Pokemon.prototype.markMove = function (id, deduct) {
		id = toId(id);
		var move = null;
		for (var i = 0; i < this.moves.length; i++) {
			if (this.moves[i].id === id) {
				move = this.moves[i];
			}
		}
		if (move && deduct) {
			move.pp += deduct;
		}
		return move;
	};

	Pokemon.prototype.transformInto = function (pokemon) {
		this.transformPrev = {
			template: this.template,
			species: this.species,
			shiny: this.shiny,
			moves: this.moves,
			ability: this.ability,
			baseAbility: this.baseAbility,
			abilityStack: this.abilityStack
		};
		this.species = pokemon.species;
		this.template = pokemon.template;
		this.shiny = pokemon.shiny;
		this.ability = pokemon.shiny;
		this.baseAbility = pokemon.shiny;
		this.abilityStack = pokemon.abilityStack.slice();
		this.moves = [];
		var mv;
		for (var i = 0; i < pokemon.moves.length; i++) {
			mv = new Move(pokemon.moves[i].template);
			mv.pp = 5;
			this.moves.push(mv);
		}
		this.transformed = true;
		this.removeAllBoosts();
		for (var i in pokemon.boosts) this.boosts[i] = pokemon.boosts[i];
		this.addVolatile('transform');
		this.addVolatile('formechange');
		this.volatiles.formechange = (pokemon.volatiles.formechange ? pokemon.volatiles.formechange : pokemon.species);
	};

	Pokemon.prototype.unTransform = function () {
		this.transformed = false;
		if (this.transformPrev) {
			this.template = this.transformPrev.template;
			this.species = this.transformPrev.species;
			this.shiny = this.transformPrev.shiny;
			this.moves = this.transformPrev.moves;
			this.ability = this.transformPrev.ability;
			this.baseAbility = this.transformPrev.baseAbility;
			this.abilityStack = this.transformPrev.abilityStack;
		}
		this.transformPrev = null;
	};

	return Pokemon;
})();

exports.Player = (function () {
	function Player (id, name, avatar) {
		this.id = id || "p0";
		this.name = name || "";
		this.userid = toId(name);
		this.avatar = avatar || 0;
		this.active = [];
		this.side = {};
		this.pokemon = [];
		this.teamPv = [];
	}

	Player.prototype.setName = function (name) {
		this.name = name;
		this.userid = toId(name);
	};

	Player.prototype.removeSideCondition = function (condition) {
		condition = toId(condition);
		if (this.side[condition]) delete this.side[condition];
	};

	Player.prototype.addSideCondition = function (condition) {
		condition = toId(condition);
		if (!this.side[condition]) this.side[condition] = 0;
		this.side[condition]++;
	};

	return Player;
})();

exports.getFormatsData = function (gen) {
	if (!gen || gen > CurrentGen || gen < 1) gen = CurrentGen;
	try {
		return require(BAT_DATA_DIR + "gen" + gen + "/formats-data.js").BattleFormatsData;
	} catch (e) {
		try {
			return DataDownloader.getFormatsData();
		} catch (ex) {
			return null;
		}
	}
};
