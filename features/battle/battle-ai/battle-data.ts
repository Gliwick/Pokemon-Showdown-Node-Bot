/*
	Battle data
*/

import { BattleStatuses } from "../data/statuses";

const BATTLE_DATA_DIR = './../data/';
const MODS_DATA_DIR = BATTLE_DATA_DIR + 'mods/';

export const CurrentGen = 9;

export type PokemonType = 'Bug' | 'Dark' | 'Dragon' | 'Electric' | 'Fairy' | 'Fighting' | 'Fire' | 'Flying' | 'Ghost' | 'Grass' | 'Ground' | 'Ice' | 'Normal' | 'Poison' | 'Psychic' | 'Rock' | 'Steel' | 'Water' | '???';

export function getEffect(effect, gen) {
	if (!effect || typeof effect === 'string') {
		const name = (effect || '').trim();
		if (name.substr(0, 5) === 'item:') {
			return getItem(name.substr(5), gen);
		} else if (name.substr(0, 8) === 'ability:') {
			return getAbility(name.substr(8), gen);
		} else if (name.substr(0, 5) === 'move:') {
			return getMove(name.substr(5), gen);
		}

		const id = toId(name);
		effect = {};

		const pMove = getMove(id, gen);
		const pAbility = getAbility(id, gen);
		const pItem = getItem(id, gen);
		const statuses = BattleStatuses;

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

export function getPokemon(poke, gen: number = CurrentGen, battleId?: string) {
	if (gen > CurrentGen || gen < 1) gen = CurrentGen;
	poke = toId(poke);
	const pokemon = {};
	let temp;
	try {
		temp = DataDownloader.getPokedex()[poke];
		for (let attr in temp) pokemon[attr] = temp[attr];
	} catch (e) { }
	for (let i = CurrentGen - 1; i >= gen; i--) {
		try {
			temp = require(BATTLE_DATA_DIR + "gen" + i + "/pokedex.js").BattlePokedex[poke];
			if (!temp) continue;
		} catch (e) {
			continue;
		}
		if (!temp.inherit) {
			for (let i in pokemon) delete pokemon[i];
		}
		for (let attr in temp) pokemon[attr] = temp[attr];
	}

	let formatId = battleId ? battleId.split('-')[1] : '';
	let formatMod = Config.formatMods[formatId];
	if (formatMod) {
		temp = null;
		try {
			temp = require(MODS_DATA_DIR + formatMod + "/pokedex.js").BattlePokedex[poke];
		} catch (e) { }
		if (temp) {
			if (!temp.inherit) {
				for (let i in pokemon) delete pokemon[i];
			}
			for (let attr in temp) pokemon[attr] = temp[attr];
		}
	}

	if (!pokemon.name && !pokemon.species) {
		return {
			num: 0,
			name: poke,
			species: poke,
			types: ["Normal"],
			baseStats: { hp: 90, atk: 90, def: 90, spa: 90, spd: 90, spe: 90 },
			abilities: { 0: "No Ability" },
			heightm: 0,
			weightkg: 0,
			unknown: true,
		};
	}

	if (!pokemon.name) pokemon.name = pokemon.species;
	if (!pokemon.species) pokemon.species = pokemon.name;
	return pokemon;
};

export const getTemplate = getPokemon;

export function getMove(move, gen: number = CurrentGen, battleId?: string) {
	if (gen > CurrentGen || gen < 1) gen = CurrentGen;
	move = toId(move);
	if (move.indexOf("hiddenpower") === 0) {
		move = move.replace(/[0-9]/g, "");
	}
	let moveData = {};
	let temp;
	try {
		temp = DataDownloader.getMovedex()[move];
		for (let i in temp) moveData[i] = temp[i];
		moveData.id = move;
	} catch (e) { }
	for (let i = CurrentGen - 1; i >= gen; i--) {
		try {
			temp = require(BATTLE_DATA_DIR + "gen" + i + "/moves.js").BattleMovedex[move];
			if (!temp) continue;
		} catch (e) {
			continue;
		}
		if (!temp.inherit) {
			for (let i in moveData) delete moveData[i];
		}
		for (let i in temp) moveData[i] = temp[i];
	}

	let formatId = battleId ? battleId.split('-')[1] : '';
	let formatMod = Config.formatMods[formatId];
	if (formatMod) {
		temp = null;
		try {
			temp = require(MODS_DATA_DIR + formatMod + "/moves.js").BattleMovedex[move];
		} catch (e) { }
		if (temp) {
			if (!temp.inherit) {
				for (let i in moveData) delete moveData[i];
			}
			for (let attr in temp) moveData[attr] = temp[attr];
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
			flags: { protect: 1 },
			effectType: 'Move',
			type: 'Normal',
		};


		const specialTypes = ['Fire', 'Water', 'Grass', 'Ice', 'Electric', 'Dark', 'Psychic', 'Dragon'];
		if (specialTypes.includes(moveData.type)) moveData.category = 'Special';
		if (moveData.category === 'Physical' && !['Ground', 'Rock'].includes(moveData.type)) moveData.flags.contact = 1;
	}

	if (!moveData.effectType) moveData.effectType = 'Move';
	return moveData;
};

const TypeAliases: { [key in PokemonType]?: string[] } = {
	'Bug': ['bug'],
	'Dark': ['dark'],
	'Dragon': ['dragon'],
	'Electric': ['electr', 'thunder'],
	'Fairy': ['fairy'],
	'Fighting': ['fight'],
	'Fire': ['fire', 'flame', 'flare', 'heat'],
	'Flying': ['fly', 'sky', 'wing'],
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

function evaluateMoveType(name: string): PokemonType {
	let moveType: PokemonType;
	for (moveType in TypeAliases) {
		if (name.indexOf(moveType) >= 0) {
			return moveType;
		}
	}

	for (moveType in TypeAliases) {
		for (let typeAlias of (TypeAliases[moveType] || [])) {
			if (name.indexOf(typeAlias) >= 0) {
				return moveType;
			}
		}
	}

	return 'Normal';
}

export function getItem(item, gen: number = CurrentGen, battleId?: string) {
	if (gen > CurrentGen || gen < 1) gen = CurrentGen;
	item = toId(item);
	const itemData = {};
	let temp;
	try {
		temp = DataDownloader.getItems()[item];
		for (let i in temp) itemData[i] = temp[i];
		itemData.id = item;
	} catch (e) { }
	for (let i = CurrentGen - 1; i >= gen; i--) {
		try {
			temp = require(BATTLE_DATA_DIR + "gen" + i + "/items.js").BattleItems[item];
			if (!temp) continue;
		} catch (e) {
			continue;
		}
		if (!temp.inherit) {
			for (let i in itemData) delete itemData[i];
		}
		for (let i in temp) itemData[i] = temp[i];
	}

	let formatId = battleId ? battleId.split('-')[1] : '';
	let formatMod = Config.formatMods[formatId];
	if (formatMod) {
		temp = null;
		try {
			temp = require(MODS_DATA_DIR + formatMod + "/items.js").BattleItems[move];
		} catch (e) { }
		if (temp) {
			if (!temp.inherit) {
				for (let i in itemData) delete itemData[i];
			}
			for (let attr in temp) itemData[attr] = temp[attr];
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

export function getAbility(ab, gen: number = CurrentGen, battleId?: string) {
	if (gen > CurrentGen || gen < 1) gen = CurrentGen;
	ab = toId(ab);
	const ability = {};
	let temp;
	try {
		temp = DataDownloader.getAbilities()[ab];
		for (let i in temp) ability[i] = temp[i];
		ability.id = ab;
	} catch (e) { }
	for (let i = CurrentGen - 1; i >= gen; i--) {
		try {
			temp = require(BATTLE_DATA_DIR + "gen" + i + "/abilities.js").BattleAbilities[ab];
			if (!temp) continue;
		} catch (e) {
			continue;
		}
		if (!temp.inherit) {
			for (let i in ability) delete ability[i];
		}
		for (let i in temp) ability[i] = temp[i];
	}

	let formatId = battleId ? battleId.split('-')[1] : '';
	let formatMod = Config.formatMods[formatId];
	if (formatMod) {
		temp = null;
		try {
			temp = require(MODS_DATA_DIR + formatMod + "/abilities.js").BattleAbilities[move];
		} catch (e) { }
		if (temp) {
			if (!temp.inherit) {
				for (let i in ability) delete ability[i];
			}
			for (let attr in temp) ability[attr] = temp[attr];
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

export class Move {
	template;
	name: string;
	id: string;
	pp: number;
	disabled: boolean = false;
	helpers = {};

	constructor(template) {
		if (!template || typeof template !== "object") throw new Error("Invalid move template");
		this.template = template;
		this.name = this.template.name;
		this.id = this.template.id;
		this.pp = Math.floor(this.template.pp * 1.6);
	}

	restorePP(pp) {
		if (pp) {
			this.pp += pp;
		} else {
			this.pp = Math.floor(this.template.pp * 1.6);
		}
	};
};

export type Gender = "M" | "F" | "N";

export class Pokemon {
	template;
	species;
	name;

	transformed: boolean = false;
	transformPrev = null;

	gender: Gender | null = null;
	level: number = 100;
	shiny: boolean = false;

	item: string = "&unknown";
	itemEffect = '';
	prevItem = null;
	prevItemEffect = '';

	ability: string = "&unknown";
	supressedAbility: boolean = false;
	baseAbility: string = "&unknown";
	abilityStack = [];

	moves = [];

	active: boolean = false;
	slot: number = -1;

	hp: number = 100;
	fainted: boolean = false;
	status: string | null = null;
	volatiles = {};
	boosts = {};

	passing: boolean = false;
	prepared = null;

	helpers = {};

	constructor(template, properties) {
		if (!template || typeof template !== "object") throw new Error("Invalid pokemon template");

		this.template = template;
		this.species = this.template.species;
		this.name = this.template.species;

		for (let i in properties) {
			if (typeof this[i] === "undefined" || typeof this[i] === "function") continue;
			if (i === "template") continue;
			this[i] = properties[i];
		}
	}

	addVolatile = function (volatile) {
		volatile = toId(volatile);
		this.volatiles[volatile] = true;
	};

	removeVolatile = function (volatile) {
		volatile = toId(volatile);
		if (this.volatiles[volatile]) delete this.volatiles[volatile];
	};

	removeAllVolatiles = function () {
		for (let i in this.volatiles) delete this.volatiles[i];
	};

	addBoost = function (stat, n) {
		if (!this.boosts[stat]) this.boosts[stat] = 0;
		this.boosts[stat] += n;
	};

	setBoost = function (stat, n) {
		this.boosts[stat] = n;
	};

	invertAllBoosts = function () {
		for (let i in this.boosts) {
			this.boosts[i] = this.boosts[i] * (-1);
		}
	};

	removeAllBoosts = function () {
		for (let i in this.boosts) delete this.boosts[i];
	};

	markAbility = function (id, isNotBase) {
		this.ability = getAbility(id);
		if ((!this.baseAbility || this.baseAbility === "&unknown") && !isNotBase) {
			this.baseAbility = this.ability;
			this.abilityStack.push(this.ability.id);
		} else if (isNotBase && this.baseAbility && this.baseAbility !== "&unknown") {
			if (this.ability.id === this.baseAbility.id) {
				if (this.abilityStack[this.abilityStack.length - 1] === this.ability.id) {
					this.abilityStack.pop();
				}
				if (this.abilityStack[this.abilityStack.length - 1]) {
					this.baseAbility = getAbility(this.abilityStack[this.abilityStack.length - 1]);
				} else {
					this.baseAbility = "&unknown";
				}
			}
		}
	};

	prepareMove = function (move, target) {
		this.prepared = {
			move: move,
			target: target
		};
	};

	markMove = function (id, deduct) {
		id = toId(id);
		let move = null;
		for (let i = 0; i < this.moves.length; i++) {
			if (this.moves[i].id === id) {
				move = this.moves[i];
			}
		}
		if (move && deduct) {
			move.pp += deduct;
		}
		return move;
	};

	transformInto = function (pokemon) {
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
		let mv;
		for (let i = 0; i < pokemon.moves.length; i++) {
			mv = new Move(pokemon.moves[i].template);
			mv.pp = 5;
			this.moves.push(mv);
		}
		this.transformed = true;
		this.removeAllBoosts();
		for (let stat in pokemon.boosts) this.boosts[stat] = pokemon.boosts[stat];
		this.addVolatile('transform');
		this.addVolatile('formechange');
		this.volatiles.formechange = (pokemon.volatiles.formechange ? pokemon.volatiles.formechange : pokemon.species);
	};

	unTransform = function () {
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
};

export class Player {
	id: string;
	name: string;
	userid: string;
	avatar;
	active = [];
	side = {};
	pokemon = [];
	teamPv = [];

	constructor(id, name?: string, avatar?: any) {
		this.id = id || "p0";
		this.name = name || "";
		this.userid = toId(name);
		this.avatar = avatar || 0;
	}

	setName = function (name) {
		this.name = name;
		this.userid = toId(name);
	};

	removeSideCondition = function (condition) {
		condition = toId(condition);
		if (this.side[condition]) delete this.side[condition];
	};

	addSideCondition = function (condition) {
		condition = toId(condition);
		if (!this.side[condition]) this.side[condition] = 0;
		this.side[condition]++;
	};
};

export function getFormatsData(poke, gen: number = CurrentGen, battleId?: string) {
	if (gen > CurrentGen || gen < 1) gen = CurrentGen;
	poke = toId(poke);
	const formatsData = {};
	let temp;
	try {
		temp = DataDownloader.getFormatsData()[poke];
		for (let attr in temp) formatsData[attr] = temp[attr];
	} catch (e) { }
	for (let gen = CurrentGen - 1; gen >= gen; gen--) {
		try {
			temp = require(BATTLE_DATA_DIR + "gen" + gen + "/formats-data.js").BattleFormatsData[poke];
			if (!temp) continue;
		} catch (e) {
			continue;
		}
		if (!temp.inherit) {
			for (let attr in formatsData) delete formatsData[attr];
		}
		for (let attr in temp) formatsData[attr] = temp[attr];
	}

	let formatId = battleId ? battleId.split('-')[1] : '';
	let formatMod = Config.formatMods[formatId];
	if (formatMod) {
		temp = null;
		try {
			temp = require(MODS_DATA_DIR + formatMod + "/formats-data.js.js").BattleFormatsData[poke];
		} catch (e) { }
		if (temp) {
			if (!temp.inherit) {
				for (let attr in formatsData) delete formatsData[attr];
			}
			for (let attr in temp) formatsData[attr] = temp[attr];
		}
	}

	return formatsData;
};
