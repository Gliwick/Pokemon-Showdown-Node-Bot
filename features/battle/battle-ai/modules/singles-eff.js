/*
 * Default module for singles
 *
 */

exports.id = 'singles-eff';

var TypeChart = require('./../typechart.js');
var Calc = require('./../calc.js');
var Data = require('./../battle-data.js');

var Pokemon = Calc.Pokemon;
var Conditions = Calc.Conditions;

const singleTurnMoves = {'protect':1, 'detect':1, 'kingsshield':1, 'quickguard':1, 'spikyshield':1, 'wideguard':1, 'banefulbunker':1, 'obstruct':1, 'maxguard':1, 'endure':1};

function supposeActiveFoe (battle) {
	let target = battle.foe.active[0];
	let pokeA = battle.getCalcRequestPokemon(0, true);
	let pokeBId = target.name + '|' + target.species;
	let pokeB = new Pokemon(target.template, {
		level: target.level,
		gender: target.gender,
		shiny: target.shiny,
		evs: {},
		helpers: (battle.helpers.foe[pokeBId] || {}),
	});
	pokeB.hp = target.hp;
	pokeB.status = target.status;
	let hackmonsBattle = (battle.id.indexOf('hackmon') >= 0);
	if (battle.gen >= 3 && !target.supressedAbility) {
		if (!target.ability || target.ability === '&unknown') {
			if (!hackmonsBattle && pokeB.template.abilities) {
				let abilities = Object.values(pokeB.template.abilities);
				abilities.sort((a, b) => Data.getAbility(b, battle.gen, battle.id).rating - Data.getAbility(a, battle.gen, battle.id).rating);
				pokeB.ability = Data.getAbility(abilities[0], battle.gen, battle.id);
			} else {
				pokeB.ability = null;
			}
		} else {
			pokeB.ability = target.ability;
		}
	}
	if (!target.item || target.item === '&unknown') {
		let itemId = null;
		if (battle.gen >= 2 && !hackmonsBattle) {
			if (pokeB.template.requiredItem) {
				itemId = pokeB.template.requiredItem;
			} else if (pokeB.template.requiredItems) {
				itemId = pokeB.template.requiredItems[0];
			} else if ((pokeB.template.nfe || pokeB.template.evos) && !(pokeB.template.species in {'Cubone':1, "Farfetch'd-Galar":1, 'Pikachu':1})) {
				if (battle.gen === 7 && pokeB.template.species === 'Eevee') itemId = 'eeviumz';
				else pokeB.item = itemId = 'eviolite';
			} else {
				pokeB.item = null;
				if (pokeB.ability) {
					switch (pokeB.ability.id) {
						case 'drizzle':
							itemId = 'damprock';
							break;
						case 'drought':
							itemId = 'heatrock';
							break;
					}
				}
				switch (pokeB.template.species) {
					case 'Pikachu':
						if (battle.id.indexOf('nfe') < 0) itemId = 'lightball';
						break;
					case "Farfetch'd":
					case "Farfetch'd-Galar":
					case "Sirfetch'd":
						itemId = (battle.gen >= 8 ? 'leek' : 'stick');
						break;
					case 'Cubone':
					case 'Marowak':
					case 'Marowak-Alola':
						itemId = 'thickclub';
						break;
					case 'Ditto':
						itemId = 'choicescarf';
						break;
					case 'Unown':
						itemId = 'choicespecs';
						break;
					case 'Kommo-o':
						if (battle.gen === 7 && battle.id.indexOf('gen7uu') < 0) itemId = 'kommoniumz';
						break;
				}
			}
		}
		if (itemId) pokeB.item = Data.getItem(itemId, battle.gen, battle.id);
	} else {
		pokeB.item = target.item;
	}
	return pokeB;
}

function hasAbility (poke, ability) {
	return poke.hasAbility(ability);
}

function hasItem (poke, item) {
	return poke.hasItem(item);
}

function weatherSupressed (pokeA, pokeB) {
	return (!hasAbility(pokeA, 'neutralizinggas') && !hasAbility(pokeB, 'neutralizinggas') && (hasAbility(pokeA, {'airlock':1, 'cloudnine':1}) || hasAbility(pokeB, {'airlock':1, 'cloudnine':1})));
}

function evaluatePokemon (battle, sideId) {
	if (!battle.foe.active[0] || battle.foe.active[0].fainted) return {t: 0, d: 0};

	let pokeA = battle.getCalcRequestPokemon(sideId, (sideId < battle.self.active.length));
	let pokeB = supposeActiveFoe(battle);
	let conditionsA, conditionsB;
	conditionsB = new Conditions({
		side: Object.assign({}, battle.foe.side),
		volatiles: Object.assign({}, battle.foe.active[0].volatiles),
		boosts:  Object.assign({}, battle.foe.active[0].boosts),
	});
	if (sideId < battle.self.active.length) {
		conditionsA = new Conditions({
			side: battle.self.side,
			volatiles: battle.self.active[0].volatiles,
			boosts: battle.self.active[0].boosts,
		});
	} else {
		conditionsA = new Conditions({
			side: Object.assign({}, battle.self.side),
			volatiles: {},
			boosts: {},
		});

		if (hasAbility(pokeA, 'intimidate')) {
			if (hasAbility(pokeB, 'mirrorarmor')) {
				conditionsA.boosts.atk = -1;
			} else if (!hasAbility(pokeB, {'clearbody':1, 'whitesmoke':1, 'fullmetalbody':1})) {
				if (!conditionsB.boosts.atk) conditionsB.boosts.atk = 0;
				if (hasAbility(pokeB, {'contrary':1, 'defiant':1})) conditionsB.boosts.atk = 1;
				else conditionsB.boosts.atk = -1;
				if (hasAbility(pokeB, 'competitive')) conditionsB.boosts.spa = (conditionsB.boosts.spa ? conditionsB.boosts.spa + 2 : 2);
			}
		}
		if (hasAbility(pokeA, 'download')) {
			if (pokeB.template.baseStats.spd <= pokeB.template.baseStats.def) conditionsA.boosts.spa = 1;
			else conditionsA.boosts.atk = 1;
		}
		if (hasAbility(pokeA, 'intrepidsword')) conditionsA.boosts.atk = 1;
		if (hasAbility(pokeA, 'dauntlessshield')) conditionsA.boosts.def = 1;
		if (hasAbility(pokeA, 'screencleaner')) {
			conditionsA.side['lightscreen'] = false;
			conditionsA.side['reflect'] = false;
			conditionsA.side['auroraveil'] = false;
			conditionsB.side['lightscreen'] = false;
			conditionsB.side['reflect'] = false;
			conditionsB.side['auroraveil'] = false;
		}

		if (hasItem(pokeA, 'electricseed') && battle.conditions['electricterrain']) conditionsA.boosts.def = 1;
		if (hasItem(pokeA, 'grassyseed') && battle.conditions['grassyterrain']) conditionsA.boosts.def = 1;
		if (hasItem(pokeA, 'mistyseed') && battle.conditions['mistyterrain']) conditionsA.boosts.spd = 1;
		if (hasItem(pokeA, 'psychicseed') && battle.conditions['psychicterrain']) conditionsA.boosts.spd = 1;
		if (hasItem(pokeA, 'roomservice') && battle.conditions['trickroom']) conditionsA.boosts.spe = -1;

		if (conditionsA.side['toxicspikes'] && !pokeA.status && !hasAbility(pokeA, 'immunity') && !hasItem(pokeA, 'heavydutyboots') && pokeA.hasType(['Poison', 'Steel']) && !pokeA.isGrounded(conditionsA)) {
			pokeA = Object.assign({}, pokeA);
			pokeA.status = (conditionsA.side['toxicspikes'] >= 2 ? 'tox' : 'psn');
		}

		if (conditionsA.side['stickyweb'] && !hasItem(pokeA, 'heavydutyboots') && !pokeA.isGrounded(conditionsA)) {
			if (hasAbility(pokeA, 'mirrorarmor')) {
				if (!hasAbility(pokeB, {'clearbody':1, 'whitesmoke':1, 'fullmetalbody':1})) {
					if (!conditionsB.boosts.spe) conditionsB.boosts.spe = 0;
					if (hasAbility(pokeB, {'contrary':1})) conditionsB.boosts.spe = 1;
					else conditionsB.boosts.spe = -1;
					if (hasAbility(pokeB, {'defiant':1})) conditionsB.boosts.atk = (conditionsB.boosts.atk ? conditionsB.boosts.atk + 2 : 2);
					if (hasAbility(pokeB, {'competitive':1})) conditionsB.boosts.spa = (conditionsB.boosts.spa ? conditionsB.boosts.spa + 2 : 2);
				}
			} else if (!hasAbility(pokeA, {'clearbody':1, 'whitesmoke':1, 'fullmetalbody':1})) {
				if (hasAbility(pokeA, 'contrary')) conditionsA.boosts.spe = 1;
				else conditionsA.boosts.spe = -1;
				if (hasAbility(pokeA, 'defiant')) conditionsA.boosts.atk = 2;
				if (hasAbility(pokeA, 'competitive')) conditionsA.boosts.spa = 2;
			}
		}
	}

	if (sideId !== 0 && hasAbility(pokeA, {'imposter':1}) && !conditionsB.volatiles['substitute']) {
		let hpA = pokeA.hp;
		let statusA = pokeA.hp;
		let supressedA = pokeA.supressedAbility;
		let itemA = pokeA.item;
		pokeA = supposeActiveFoe(battle);
		pokeA.hp = hpA;
		pokeA.status = statusA;
		pokeA.supressedAbility = supressedA;
		pokeA.item = itemA;
	} else if (sideId !== 0 && hasAbility(pokeA, {'trace':1})) {
		pokeA.ability = pokeB.ability;
	}
	let supressedWeather = weatherSupressed(pokeA, pokeB);
	let res = {t: 0, d: 0};
	let t = 0;

	let movesB = battle.foe.active[0].moves;
	if (pokeB.template.requiredMove && battle.id.indexOf('hackmon') < 0) {
		movesB = movesB.slice();
		movesB.push(requiredMove);
	}

	/* Calculate t - types mux */
	let physicalB = false;
	let types = {};
	for (let move of movesB) {
		if (move.id === 'struggle') continue;
		if (conditionsB.volatiles['taunt'] && move.id === 'naturepower') continue;
		if (conditionsB.volatiles['torment'] && battle.foe.active[0].helpers.lastMove && battle.foe.active[0].helpers.lastMove === move.id) continue;
		if (((pokeB.item && pokeB.item.id.startsWith('choice')) || conditionsB.volatiles['encore']) && battle.foe.active[0].helpers.lastMove && battle.foe.active[0].helpers.lastMove !== move.id) continue;
		if (move.id in {'solarbeam':1, 'solarblade':1} && !supressedWeather && !(toId(battle.conditions.weather) in {'desolateland':1, 'sunnyday':1})) continue;
		if (move.id === 'naturepower') {
			move = Data.getMove('triattack', battle.gen, battle.id);
			if (battle.conditions['electricterrain']) move = Data.getMove('thunderbolt', battle.gen, battle.id);
			if (battle.conditions['grassyterrain']) move = Data.getMove('energyball', battle.gen, battle.id);
			if (battle.conditions['mistyterrain']) move = Data.getMove('moonblast', battle.gen, battle.id);
			if (battle.conditions['psychicterrain']) move = Data.getMove('psychic', battle.gen, battle.id);
		}
		if (move.category === 'Physical' && move.id !== 'foulplay') physicalB = true;

		if (move.category !== 'Status' && !(move.id in {'nuzzle':1, 'rapidspin':1})) {
			const ateAbilities = {'aerilate': 'Flying', 'pixilate': 'Fairy', 'refrigerate': 'Ice', 'galvanize': 'Electric'};
			if (move.id === 'hiddenpower') {
				types['Hidden'] = 1;
			} else if (move.id === 'naturalgift' && pokeB.item && pokeB.item.naturalGift && pokeB.item.naturalGift.type) {
				types[pokeB.item.naturalGift.type] = 1;
			} else if (move.id === 'judgment' && pokeB.item && pokeB.item.onPlate) {
				types[pokeB.item.onPlate] = 1;
			} else if (move.id === 'technoblast' && pokeB.item && pokeB.item.onDrive) {
				types[pokeB.item.onDrive] = 1;
			} else if (move.id === 'multiattack' && pokeB.item && pokeB.item.onMemory) {
				types[pokeB.item.onMemory] = 1;
			} else if (move.id === 'revelationdance') {
				types[pokeB.getTypes(conditionsB)[0]] = 1;
			} else if (hasAbility(pokeB, {'normalize':1})) {
				types['Normal'] = 1;
			} else if (move.type === 'Normal' && hasAbility(pokeB, ateAbilities)) {
				types[ateAbilities[pokeB.ability]] = 1;
			} else if (move.flags && move.flags['sound'] && hasAbility(pokeB, {'liquidvoice':1})) {
				types['Water'] = 1;
			} else if (move.id === 'weatherball') {
				if (toId(battle.conditions.weather) in {'primordialsea':1, 'raindance':1}) types['Water'] = 1;
				else if (toId(battle.conditions.weather) in {'desolateland':1, 'sunnyday':1}) types['Fire'] = 1;
				else if (toId(battle.conditions.weather) === 'sandstorm') types['Rock'] = 1;
				else if (toId(battle.conditions.weather) === 'hail') types['Ice'] = 1;
				else if (conditionsA.volatiles['foresight'] || hasAbility(pokeB, 'scrappy')) types['Normal*'] = 1;
				else types['Normal'] = 1;
			} else if (move.type in {'Fighting':1, 'Normal':1} && (conditionsA.volatiles['foresight'] || hasAbility(pokeB, 'scrappy'))) {
				types[move.type + '*'] = 1;
			} else if ((move.type === 'Ground' && battle.conditions['gravity']) || move.id === 'thousandarrows') {
				types['Ground*'] = 1;
			} else if (move.id === 'freezedry') {
				types['Ice*'] = 1;
			} else types[move.type] = 1;
			if (move.id === 'flyingpress') types['Flying'] = 1;
		}
		// 20% burn chance is enough to fear burn
		if (
			(move.id in {'blueflare':1, 'inferno':1, 'lavaplume':1, 'sacredfire':1, 'searingshot':1, 'scald':1, 'steameruption':1, 'willowisp':1}) ||
			(hasAbility(pokeB, 'serenegrace') && move.id in {'blazekick':1, 'ember':1, 'fireblast':1, 'firefang':1, 'firepunch':1, 'flamethrower':1, 'flamewheel':1, 'flareblitz':1, 'heatwave':1, 'pyroball':1, 'triattack':1}) ||
			(pokeB.status === 'brn' && move.id === 'psychoshift')
		) {
			if (move.category === 'Status') {
				types['Statusbrn'] = 1;
			} else {
				types[move.type + 'brn'] = 1;
			}
		}
	}
	if (movesB.length < 4) {
		if (!physicalB) physicalB = (pokeB.template.baseStats.atk >= pokeB.template.baseStats.spa);
		if (battle.id.indexOf('hackmonscup') >= 0 && battle.id.indexOf('camomon') < 0) {
			if (movesB.length === 0) types['Normal'] = 1;
		} else {
			for (let type of pokeB.getTypes(conditionsB)) {
				if (!types[type + '*']) types[type] = 1;
			}
		}
	}
	if (sideId !== 0 && hasAbility(pokeB, {'magnetpull':1})) types['Magnetpull'] = 1;
	if (sideId !== 0 && conditionsA.side['stealthrock']) types['Stealthrock'] = 1;

	const inverse = !!battle.conditions.inversebattle;
	const immunityAbilities = {
		'lightningrod': 'Electric', 'motordrive': 'Electric', 'voltabsorb': 'Electric',
		'flashfire': 'Fire',
		'sapsipper': 'Grass',
		'levitate': 'Ground',
		'dryskin': 'Water', 'stormdrain': 'Water', 'waterabsorb': 'Water',
		'magicbounce': 'Status',
	}
	const terrainBoost = (battle.gen >= 8 ? 1.3 : 1.5);
	const fieldBoost = {
		'raindance': ['Water', 1.5], 'primordealsea': ['Water', 1.5],
		'sunnyday': ['Fire', 1.5], 'desolateland': ['Fire', 1.5],
		'electricterrain': ['Electric', terrainBoost],
		'grassyterrain': ['Grass', terrainBoost],
		'psychicterrain': ['Psychic', terrainBoost],
	}
	const fieldWeaken = {
		'raindance': ['Fire', 0.5], 'primordealsea': ['Fire', 0],
		'sunnyday': ['Water', 0.5], 'desolateland': ['Water', 0],
		'mistyterrain': ['Dragon', 0.5],
		'grassyterrain': ['Ground', 0.5],
	}

	let mux, tmux;
	muxes = [];
	for (let type in types) {
		if ((type + '*') in types) continue;

		if (type.substr(-3) === 'brn') {
			mux = 1;
			let movesA = battle.request.side.pokemon[sideId].moves;
			if (!hasAbility(pokeA, 'guts')) {
				for (var i = 0; i < movesA.length; i++) {
					let move = Data.getMove(movesA[i], battle.gen, battle.id);
					if ((move.category === 'Physical' && !(move.id in {'flamecharge':1, 'nuzzle':1, 'rapidspin':1, 'uturn':1})) || move.id === 'photongeyser') mux = 2;
				}
			}

			if (pokeA.hasType('Fire', conditionsA) || pokeA.status || hasAbility(pokeA, {'comatose':1, 'mistysurge':1, 'waterbubble':1, 'waterveil':1}) || hasItem(pokeA, {'flameorb':1, 'lumberry':1, 'rawstberry':1})) mux = 0;

			if (!hasAbility(pokeB, {'moldbreaker':1, 'teravolt':1, 'turboblaze':1, 'neutralizinggas':1})) {
				if (hasAbility(pokeA, immunityAbilities) && type.startsWith(immunityAbilities[pokeA.ability.id])) mux = 0;
				if (type !== 'Statusbrn' && hasAbility(pokeA, 'shielddust')) mux = 0;
			}
			if (battle.conditions.weather && !supressedWeather) {
				if (toId(battle.conditions.weather) === 'desolateland' && type === 'Waterbrn') mux = 0;
				if (toId(battle.conditions.weather) === 'primordealsea' && type === 'Firebrn') mux = 0;
			}
			if (battle.conditions['mistyterrain'] && pokeA.isGrounded()) mux = 0;

			if (mux !== 0 && hasAbility(pokeA, {'flareboost':1, 'guts':1, 'marvelscale':1, 'quickfeet':1})) mux = -1;
			if (mux < 1.5 && hasAbility(pokeA, 'magicguard')) mux = 0;
			if (mux < 1.5 && hasAbility(pokeA, 'heatproof')) mux *= 0.5;

			if (mux !== 0 && pokeA.template.species === 'Shedinja') mux = 8;

			muxes.push(10 * mux);
			continue;
		}

		if (type === 'Magnetpull') {
			if (pokeA.hasType('Steel', conditionsA) && (battle.gen < 6 || !pokeA.hasType('Ghost', conditionsA)) && !pokeA.hasItem('shedshell')) muxes.push(20);
			continue;
		}

		if (type === 'Stealthrock') {
			mux = TypeChart.getMultipleEff('Rock', pokeA.getTypes(conditionsA), battle.gen, false, inverse, battle.id);
			if (hasAbility(pokeA, 'magicguard') || hasItem(pokeA, 'heavydutyboots')) {
				mux = 0;
			} else if (pokeA.template.species === 'Shedinja') {
				mux = 8;
			}
			muxes.push(Math.round(10 * mux));
			continue;
		}

		if (type === 'Hidden') {
			mux = 1;
			const hpTypes = ['Bug', 'Dark', 'Dragon', 'Electric', 'Fighting', 'Fire', 'Flying', 'Ghost', 'Grass', 'Ground', 'Ice', 'Poison', 'Psychic', 'Rock', 'Steel', 'Water'];
			for (let hpType of hpTypes) {
				let typesA = pokeA.getTypes(conditionsA);
				if (typesA.length < 2) continue;

				if (!hasAbility(pokeB, {'moldbreaker':1, 'teravolt':1, 'turboblaze':1, 'neutralizinggas':1})) {
					if (hasAbility(pokeA, 'wonderguard')) continue;
					if (hasAbility(pokeA, immunityAbilities)) continue;
				}
				if (battle.conditions.weather && !supressedWeather) {
					if (hpType === 'Water' && toId(battle.conditions.weather) === 'desolateland') continue;
					if (hpType === 'Fire' && toId(battle.conditions.weather) === 'primordealsea') continue;
				}
				if (hpType === 'Ground' && hasItem(pokeA, 'airballoon')) continue;

				let effectiveness = TypeChart.getMultipleEff(hpType, pokeA.getTypes(conditionsA), battle.gen, false, inverse, battle.id);
				if (hpType === 'Fire' && hasAbility(pokeA, 'fluffy')) effectiveness *= 2;
				if (hpType === 'Fire' && hasAbility(pokeA, 'dryskin')) effectiveness *= 1.25;
				if (effectiveness > 2) mux = Math.max(mux, effectiveness);
			}

			if (mux > 1) {
				if (hasAbility(pokeB, 'neuroforce')) mux *= 1.25;
				if (!hasAbility(pokeB, {'moldbreaker':1, 'teravolt':1, 'turboblaze':1, 'neutralizinggas':1}) && hasAbility(pokeA, {'filter':1, 'prismarmor':1, 'solidrock':1})) mux *= 0.75;
				if (hasItem(pokeB, 'expertbelt')) mux *= 1.2;
			}

			muxes.push(Math.round(10 * mux));
			continue;
		}

		const asterisk = (type.endsWith('*'));
		if (asterisk) type = type.substr(0, type.length - 1);

		let notImmune = false;
		if (asterisk && type in {'Fighting':1, 'Ground':1, 'Normal':1}) notImmune = true;

		let typesA = pokeA.getTypes(conditionsA);
		mux = TypeChart.getMultipleEff(type, typesA, battle.gen, notImmune, inverse, battle.id);
		if (asterisk && type === 'Ice' && !inverse && typesA.indexOf('Water') >= 0) mux *= 4;

		if (mux < 2 && !hasAbility(pokeB, {'moldbreaker':1, 'teravolt':1, 'turboblaze':1, 'neutralizinggas':1})) {
			if (hasAbility(pokeA, 'wonderguard')) mux = 0;
			if (hasAbility(pokeA, {'filter':1, 'prismarmor':1, 'solidrock':1})) mux *= 0.75;
		}
		if (mux > 1) {
			if (hasAbility(pokeB, 'neuroforce')) mux *= 1.25;
			if (!hasAbility(pokeB, {'moldbreaker':1, 'teravolt':1, 'turboblaze':1, 'neutralizinggas':1}) && hasAbility(pokeA, {'filter':1, 'prismarmor':1, 'solidrock':1})) mux *= 0.75;
		}
		if (mux < 1 && hasAbility(pokeB, 'tintedlens')) mux *= 2;
		if (pokeB.hasType(type, conditionsB) || hasAbility(pokeB, {'libero':1, 'protean':1})) {
			if (hasAbility(pokeB, 'adaptability')) mux *= 2;
			else mux *= 1.5;
		}

		if (!hasAbility(pokeB, {'moldbreaker':1, 'teravolt':1, 'turboblaze':1, 'neutralizinggas':1})) {
			if (hasAbility(pokeA, immunityAbilities) && type === immunityAbilities[pokeA.ability.id]) mux = 0;
			if (hasAbility(pokeA, {'heatproof':1, 'waterbubble':1, 'thickfat':1}) && type === 'Fire') mux *= 0.5;
			if (hasAbility(pokeA, 'thickfat') && type === 'Ice') mux *= 0.5;
			if (hasAbility(pokeA, 'dryskin') && type === 'Fire') mux *= 1.25;
			if (hasAbility(pokeA, 'fluffy') && type === 'Fire') mux *= 2;
		}

		let typeBoostAbilities = {
			'normalize': ['Normal', 1.2], 'aerilate': ['Flying', 1.2], 'pixilate': ['Fairy', 1.2], 'refrigerate': ['Ice', 1.2], 'galvanize': ['Electric', 1.2],
			'steelworker': ['Steel', 1.5], 'steelyspirit': ['Steel', 1.5], 'waterbubble': ['Water', 2],
		}
		if (hasAbility(pokeB, typeBoostAbilities) && type === typeBoostAbilities[pokeB.ability.id][0]) mux *= typeBoostAbilities[pokeB.ability.id][1];
		if (hasAbility(pokeB, 'sandforce') && type in {'Ground':1, 'Rock':1, 'Steel':1} && toId(battle.conditions.weather) === 'sandstorm') mux *= 1.3;

		if ((hasAbility(pokeA, 'darkaura') && type === 'Dark') || (hasAbility(pokeA, 'fairyaura') && type === 'Fairy') || (hasAbility(pokeB, 'darkaura') && type === 'Dark') || (hasAbility(pokeB, 'fairyaura') && type === 'Fairy')) {
			if (hasAbility(pokeA, 'aurabreak') || hasAbility(pokeB, 'aurabreak')) mux *= 0.75;
			else mux *= 1.33;
		}

		if (battle.conditions.weather && !supressedWeather) {
			weather = toId(battle.conditions.weather);
			if (weather in fieldBoost && fieldBoost[weather][0] === type) mux *= fieldBoost[weather][1];
			if (weather in fieldWeaken && fieldWeaken[weather][0] === type) mux *= fieldWeaken[weather][1];
		}
		for (var fieldCondition in battle.conditions) {
			if (pokeB.isGrounded(conditionsB) && fieldCondition in fieldBoost && fieldBoost[fieldCondition][0] === type) mux *= fieldBoost[fieldCondition][1];
			if (pokeA.isGrounded(conditionsA) && fieldCondition in fieldWeaken && fieldWeaken[fieldCondition][0] === type && (type !== 'Ground' || !asterisk)) mux *= fieldWeaken[fieldCondition][1];
		}

		if (pokeA.item && !hasAbility(pokeA, 'klutz')) {
			if (pokeA.item.onSourceModifyDamage && pokeA.item.naturalGift && type === pokeB.item.naturalGift.type) mux *= 0.5;
			if (pokeA.item.id === 'airballoon' && type === 'Ground') mux = 0;
		}

		if (!physicalB && pokeB.template.species in {'Chansey':1, 'Blissey':1}) mux *= 0.66;

		muxes.push(Math.round(10 * mux));
	}

	muxes.sort((a, b) => b - a);
	for (var i = 0; i < 2; i++) {
		if (i < muxes.length) t += muxes[i];
		else t += 10;
	}
	res.t = t;

	/* Calculate d - max damage */
	let moves = battle.request.side.pokemon[sideId].moves;
	if (sideId !== 0 && hasAbility(pokeA, 'imposter') && !conditionsB.volatiles['substitute']) moves = battle.foe.active[0].moves;
	let d = 0;
	for (var i = 0; i < moves.length; i++) {
		let move = Data.getMove(moves[i], battle.gen, battle.id);
		if (sideId === 0) {
			if (conditionsA.volatiles['taunt'] && move.id === 'naturepower') continue;
			if (conditionsA.volatiles['torment'] && battle.self.active[0].helpers.lastMove && battle.self.active[0].helpers.lastMove === move.id) continue;
			if (((pokeA.item && pokeA.item.id.startsWith('choice')) || conditionsA.volatiles['encore']) && battle.self.active[0].helpers.lastMove && battle.self.active[0].helpers.lastMove !== move.id) continue;
		}
		if (move.id === 'naturepower') {
			move = Data.getMove('triattack', battle.gen, battle.id);
			if (battle.conditions['electricterrain']) move = Data.getMove('thunderbolt', battle.gen, battle.id);
			if (battle.conditions['grassyterrain']) move = Data.getMove('energyball', battle.gen, battle.id);
			if (battle.conditions['mistyterrain']) move = Data.getMove('moonblast', battle.gen, battle.id);
			if (battle.conditions['psychicterrain']) move = Data.getMove('psychic', battle.gen, battle.id);
		}
		if (move.selfdestruct && pokeA.hp > 25) continue;
		if (move.id in {'hurricane':1, 'thunder':1} && !supressedWeather && toId(battle.conditions.weather) in {'desolateland':1, 'sunnyday':1}) continue;
		if (move.id in {'solarbeam':1, 'solarblade':1} && !supressedWeather && !(toId(battle.conditions.weather) in {'desolateland':1, 'sunnyday':1})) continue;

		let dmg = 0;
		if (move.category !== 'Status') dmg = Calc.calculate(pokeA, pokeB, move, conditionsA, conditionsB, battle.conditions, battle.gen, battle.id).getAvg();
		if (dmg === 0 && !hasAbility(pokeB, {'magicbounce':1, 'magicguard':1}) && (!conditionsB.volatiles['substitute'] || hasAbility(pokeA, 'infiltrator'))) {
			if (move.id === 'leechseed' && !pokeB.hasType('Grass', conditionsB) && !hasAbility(pokeB, 'sapsipper')) dmg = 12.5;
			if (!battle.conditions['mistyterrain'] || !pokeB.isGrounded(conditionsB)) {
				if (move.status === 'brn' && !pokeB.hasType('Fire', conditionsB) && !hasAbility(pokeB, {'comatose':1, 'flashfire':1, 'waterbubble':1, 'waterveil':1})) {
					if (battle.gen >= 7) dmg = 6.25;
					else dmg = 12.5;
				}
				if (pokeB.hasType(['Poison', 'Steel'], conditionsB) && !hasAbility(pokeB, {'comatose':1, 'immunity':1, 'poisonheal':1, 'pastelveil':1})) {
					if (move.status === 'psn') dmg = 12.5;
					if (move.status === 'tox') dmg = 18.75;
				}
			}
		}
		if (dmg > d) d = dmg;
	}
	if (d > 100) d = 100;
	res.d = d;

	res.hp = pokeA.hp;

	return res;
}

/*
* Moves
*/

function foeCanSwitch (battle) {
	let totalPokes = battle.foe.teamPv.length || 6;
	if (battle.foe.pokemon.length === totalPokes) {
		for (var i = 0; i < battle.foe.pokemon.length; i++) {
			if (!battle.foe.pokemon[i].fainted && !battle.foe.pokemon[i].active) {
				return true;
			}
		}
		return false;
	}
	return true;
}

function selfLastPokemon (battle) {
	for (var i = 0; i < battle.request.side.pokemon.length; i++) {
		if (battle.request.side.pokemon[i].condition !== '0 fnt' && !battle.request.side.pokemon[i].active) {
			return false;
		}
	}
	return true;
}

function selfCanSwitch (decisions, pokeA, conditionsA, pokeB, conditionsB) {
	if (!pokeA.hasItem('shedshell') && !pokeA.hasType('Ghost', conditionsA)) {
		if (pokeB.hasAbility('arenatrap') && !pokeA.isGrounded(conditionsA)) return false;
		if (pokeB.hasAbility('magnetpull') && pokeA.hasType('Steel', conditionsA)) return false;
		if (pokeB.hasAbility('shadowtag') && !pokeA.hasAbility('shadowtag')) return false;
	}
	for (let des of decisions) {
		if (des.type === 'switch') return true;
	}
	return false;
}

function selfHasStatus (battle) {
	for (var i = 0; i < battle.request.side.pokemon.length; i++) {
		if (battle.parseStatus(battle.request.side.pokemon[i].condition).status in {'slp':1, 'brn':1, 'psn':1, 'tox':1, 'par':1, 'frz':1}) {
			return true;
		}
	}
	return false;
}

function alreadyOppSleeping (battle) {
	for (var i = 0; i < battle.foe.pokemon.length; i++) {
		if (battle.foe.pokemon[i].status === 'slp') {
			return true;
		}
	}
	return false;
}

function sideHasHazards (conditions) {
	return (conditions.side['gmaxsteelsurge'] || conditions.side['spikes'] || conditions.side['stealthrock'] || conditions.side['stickyweb'] || conditions.side['toxicspikes']);
}

function sideHasDamagingHazards (conditions) {
	return (conditions.side['gmaxsteelsurge'] || conditions.side['spikes'] || conditions.side['stealthrock'] || conditions.side['toxicspikes']);
}

var getViableSupportMoves = exports.getViableSupportMoves = function (battle, decisions) {
	let res = {
		obligatory: [],
		viable: [],
		unviable: [],
		sleepTalk: [],
		switching: [],
		slowswitching: [],
		hasAuthentic: false,
	};
	let sideId = 0; // Active, singles
	let pokeA = battle.getCalcRequestPokemon(sideId, true);
	let pokeB = supposeActiveFoe(battle);
	let conditionsA = new Conditions({
		side: battle.self.side,
		volatiles: battle.self.active[0].volatiles,
		boosts: battle.self.active[0].boosts
	});
	let conditionsB = new Conditions({
		side: battle.foe.side,
		volatiles: battle.foe.active[0].volatiles,
		boosts: battle.foe.active[0].boosts
	});
	let movesB = battle.foe.active[0].moves;

	let randomBattle = (battle.id.indexOf('random') >= 0 || battle.id.indexOf('challengecup') >= 0 || battle.id.indexOf('hackmonscup') >= 0);
	let speA = pokeA.getSpe(battle, conditionsA, battle.self.active[0].moves, false, randomBattle);
	let speB = pokeB.getSpe(battle, conditionsB, movesB, false, randomBattle);

	pokeB.category = '';
	let hasPhysical = false, hasSpecial = false, hasStatus = false;
	for (var i = 0; i < movesB.length; i++) {
		if (movesB[i].id === 'struggle') continue;
		let move = Data.getMove(movesB[i].id, battle.gen, battle.id);
		if (conditionsB.volatiles['torment'] && battle.foe.active[0].helpers.lastMove && battle.foe.active[0].helpers.lastMove === move.id) continue;
		if (((pokeB.item && pokeB.item.id.startsWith('choice')) || conditionsB.volatiles['encore']) && battle.foe.active[0].helpers.lastMove && battle.foe.active[0].helpers.lastMove !== move.id) continue;
		if ((move.category === 'Physical' && !(move.id in {'flamecharge':1, 'nuzzle':1, 'rapidspin':1, 'uturn':1})) || move.id === 'photongeyser') hasPhysical = true;
		if (move.category === 'Special' || move.id === 'naturepower') hasSpecial = true;
		if (move.category === 'Status') hasStatus = true;
	}
	if (hasPhysical) pokeB.category = 'Physical';
	if (hasSpecial) pokeB.category = 'Special';
	if (hasPhysical && hasSpecial) pokeB.category = 'Mixed';
	if (pokeB.category.length === 0 && movesB.length >= 4) pokeB.category = 'Status';
	if (pokeB.category.length === 0) {
		if (conditionsB.boosts && conditionsB.boosts.atk > 0 && conditionsB.boosts.spa <= 0) pokeB.category = 'Physical';
		if (conditionsB.boosts && conditionsB.boosts.atk <= 0 && conditionsB.boosts.spa < 0) pokeB.category = 'Special';
		if (conditionsB.boosts && conditionsB.boosts.atk > 0 && pokeB.template.species === 'Magearna') pokeB.category = 'Special';
	}
	if (pokeB.category.length === 0) {
		if (pokeB.template.baseStats['atk'] > pokeB.template.baseStats['spa']) pokeB.category = 'Physical';
		if (pokeB.template.baseStats['atk'] < pokeB.template.baseStats['spa']) pokeB.category = 'Special';
		if (pokeB.template.baseStats['atk'] === pokeB.template.baseStats['spa']) pokeB.category = 'Mixed';
	}
	let supressedWeather = weatherSupressed(pokeA, pokeB);
	for (var i = 0; i < decisions.length; i++) {
		let des = decisions[i][0];
		if (des.type !== 'move') continue; // not a move
		if (battle.request.active[0].canMegaEvo || battle.request.side.pokemon[0].canMegaEvo) {
			if (hasAbility(pokeA, {'speedboost':1}) && (!conditionsA.boosts || conditionsA.boosts.spe <= 0)) {
				if (des.mega) continue;
			} else {
				if (!des.mega) continue; // Mega evolve by default
			}
		}

		if (des.dynamax && !(conditionsB.volatiles['dynamax'] && pokeA.hp > 50) && !selfLastPokemon(battle)) continue;

		let move = des.moveData;
		let viableZMove = (
			move.id in {'bellydrum':1, 'healblock':1, 'hypnosis':1, 'mirrormove':1, 'raindance':1, 'sleeppowder':1, 'splash':1, 'sunnyday':1} ||
			(move.zMoveBoost && move.zMoveBoost.atk && move.zMoveBoost.def && move.zMoveBoost.spa && move.zMoveBoost.spd && move.zMoveBoost.spe)
		);
		if (battle.request.active[0].canZMove || battle.request.side.pokemon[0].canZMove) {
			if (!des.zMove && viableZMove && pokeA.item) {
				if (pokeA.item.zMoveType && pokeA.item.zMoveType === move.type) continue;
				if (pokeA.item.zMoveFrom && pokeA.item.zMoveFrom === move.name) continue;
			}
		}
		if (des.zMove) {
			if (viableZMove) {
				res.obligatory.push(deciions[i]);
        		} else {
				res.unviable.push(deciions[i]);
			}
			continue;
		}

		if (move.category !== 'Status' && Calc.calculate(pokeA, pokeB, move, conditionsA, conditionsB, battle.conditions, battle.gen, battle.id).getAvg() === 0) {
			continue;
		}
		const immunityAbilities = {
			'lightningrod': 'Electric', 'motordrive': 'Electric', 'voltabsorb': 'Electric',
			'flashfire': 'Fire',
			'sapsipper': 'Grass',
			'levitate': 'Ground',
			'dryskin': 'Water', 'stormdrain': 'Water', 'waterabsorb': 'Water',
		}
		if (!(move.target in {'all':1, 'allySide':1, 'foeSide':1, 'self':1}) && hasAbility(pokeB, immunityAbilities) && !hasAbility(pokeA, {'moldbreaker':1, 'teravolt':1, 'turboblaze':1, 'neutralizinggas':1}) && immunityAbilities[pokeB.ability.id] === move.type) {
			continue;
		}
		if (move.id === 'thunderwave' && pokeB.hasType((hasAbility(pokeA, 'normalize') ? 'Ghost' : 'Ground'), conditionsB)) {
			res.unviable.push(decisions[i]);
			continue;
		}
		if (move.flags && move.flags['reflectable'] && move.id !== 'partingshot' && hasAbility(pokeB, 'magicbounce')) {
			res.unviable.push(decisions[i]);
			continue;
		}
		if (conditionsB.volatiles['substitute'] && !(move.target in {'self':1, 'allySide':1, 'allyTeam':1, 'foeSide':1})) {
			if (!(move.flags && move.flags['authentic'])) {
				if (move.category === 'Status') res.unviable.push(decisions[i]);
				continue;
			} else if (move.category === 'Status') {
				res.hasAuthentic = true;
			}
		}
		if (move.flags && move.flags['powder'] && battle.gen > 5) {
			if (hasAbility(pokeB, 'overcoat') || pokeB.hasType('Grass', conditionsB)) {
				res.unviable.push(decisions[i]);
				continue;
			}
		}
		if (move.flags && move.flags['sound']) {
			if (hasAbility(pokeB, 'soundproof')) {
				res.unviable.push(decisions[i]);
				continue;
			}
		}

		let movePriority = move.priority;
		if (move.flags && move.flags['heal'] && hasAbility(pokeA, 'triage')) movePriority += 3;
		if (move.category === 'Status' && hasAbility(pokeA, 'prankster')) movePriority++;
		if (move.type === 'Flying' && hasAbility(pokeA, 'galewings') && (battle.gen <= 6 || pokeA.hp >= 100)) movePriority++;

		if (move.target && !(move.target in {'all':1, 'allySide':1, 'foeSide':1, 'self':1})) {
			if (movePriority > 0 && ((battle.conditions['psychicterrain'] && pokeB.isGrounded(conditionsB)) || hasAbility(pokeB, {'dazzling':1, 'queenlymajesty':1}))) {
				res.unviable.push(decisions[i]);
				continue;
			}
			if (battle.gen >= 7 && move.category === 'Status' && hasAbility(pokeA, 'prankster') && pokeB.hasType('Dark', conditionsB)) {
				res.unviable.push(decisions[i]);
				continue;
			}
		}

		if (move.id === 'stockpile') {
			if (conditionsA.volatiles['stockpile3']) {
				res.unviable.push(decisions[i]);
				continue;
			}
		}
		if (!(move.target in {'self':1, 'allySide':1, 'allyTeam':1, 'foeSide':1}) && move.category !== 'Status' && !move.ignoreImmunity) {
			if (Calc.calculate(pokeA, pokeB, move, conditionsA, conditionsB, battle.conditions, battle.gen, battle.id).getMax() === 0) {
				res.unviable.push(decisions[i]);
				continue;
			}
		}
		if (move.forceSwitch || (move.id === 'partingshot' && hasAbility(pokeB, 'magicbounce'))) {
			if (conditionsB.volatiles['dynamax'] || hasAbility(pokeB, 'suctioncups') || !foeCanSwitch(battle)) {
				res.unviable.push(decisions[i]);
			} else {
				let boostsPHaze = 0;
				for (var j in conditionsB.boosts) {
					if (conditionsB.boosts[j] > 0) boostsPHaze++;
				}
				if (boostsPHaze) res.viable.push(decisions[i]);
				else res.unviable.push(decisions[i]);
			}
			continue;
		}
		if (move.selfSwitch) {
			if (pokeA.status in {'frz':1, 'slp':1} || conditionsA.volatiles['confusion']) {
				res.unviable.push(decisions[i]);
			} else if (move.flags && move.flags['contact'] && (hasAbility(pokeB, {'ironbarbs':1, 'roughskin':1}) || hasItem(pokeB, 'rockyhelmet'))) {
				res.unviable.push(decisions[i]);
			} else if (move.id === 'partingshot' && hasAbility(pokeB, {'contrary':1, 'magicbounce':1})) {
				res.unviable.push(decisions[i]);
			} else if (move.id === 'batonpass' && (conditionsA.volatiles['perish3'] || conditionsA.volatiles['perish2'] || conditionsA.volatiles['perish1'])) {
				res.unviable.push(decisions[i]);
			} else if (move.id === 'batonpass' && (conditionsA.boosts.atk > 0 || conditionsA.boosts.def > 0 || conditionsA.boosts.spa > 0 || conditionsA.boosts.spd > 0 || conditionsA.boosts.spe > 0)) {
				res.obligatory.push(decisions[i]);
			} else if (movePriority > 0 || (movePriority === 0 && speA > speB)) {
				res.switching.push(decisions[i]);
			} else {
				res.slowswitching.push(decisions[i]);
			}
			continue;
		}
		let ev = evaluatePokemon(battle, 0);
		switch (move.id) {
			case 'spikes':
				if (foeCanSwitch(battle) && conditionsB.side['spikes'] < (battle.gen >= 3 ? 3 : 1)) {
					if (sideHasDamagingHazards(conditionsB)) res.viable.push(decisions[i]);
					else res.obligatory.push(decisions[i]);
				} else {
					res.unviable.push(decisions[i]);
				}
				continue;
			case 'toxicspikes':
				if (foeCanSwitch(battle) && conditionsB.side['toxicspikes'] < 2) {
					if (sideHasDamagingHazards(conditionsB)) res.viable.push(decisions[i]);
					else res.obligatory.push(decisions[i]);
				} else {
					res.unviable.push(decisions[i]);
				}
				continue;
			case 'stealthrock':
			case 'gmaxstonesurge':
				if (foeCanSwitch(battle) && !conditionsB.side['stealthrock']) {
					if (sideHasDamagingHazards(conditionsB)) res.viable.push(decisions[i]);
					else res.obligatory.push(decisions[i]);
				} else {
					res.unviable.push(decisions[i]);
				}
				continue;
			case 'stickyweb':
				if (foeCanSwitch(battle) && !conditionsB.side['stickyweb']) {
					res.obligatory.push(decisions[i]);
				} else {
					res.unviable.push(decisions[i]);
				}
				continue;
			case 'rapidspin':
				if (!selfLastPokemon(battle) && sideHasHazards(conditionsA)) {
					if (battle.self.active[0].helpers.lastMove !== 'rapidspin') res.obligatory.push(decisions[i]);
					else res.viable.push(decisions[i]);
				} else if (conditionsA.volatiles['leechseed']) {
					res.viable.push(decisions[i]);
				} else {
					res.unviable.push(decisions[i]);
				}
				continue;
			case 'defog':
			case 'gmaxwindrage':
				if (battle.gen < 6) {
					// Defog does not work before gen 6
					res.unviable.push(decisions[i]);
					continue;
				}
				if (!selfLastPokemon(battle) && sideHasHazards(conditionsA)) {
					if (battle.self.active[0].helpers.lastMove !== move.id) res.obligatory.push(decisions[i]);
					else res.viable.push(decisions[i]);
				} else if ((conditionsB.side['lightscreen'] || conditionsB.side['reflect'] || conditionsB.side['auroraveil']) && !hasAbility(pokeA, 'infiltrator')) {
					res.viable.push(decisions[i]);
				} else {
					res.unviable.push(decisions[i]);
				}
				continue;
			case 'courtchange':
				if (!selfLastPokemon(battle) && sideHasHazards(conditionsA) && !sideHasHazards(conditionsB)) {
					res.obligatory.push(decisions[i]);
				} else {
					res.unviable.push(decisions[i]);
				}
				continue;
			case 'sleeptalk':
			case 'snore':
				if (pokeA.status === 'slp') {
					if (typeof battle.self.active[0].helpers.sleepCounter === 'number') {
						if (battle.self.active[0].helpers.sleepCounter < 2) res.sleepTalk.push(decisions[i]);
					}
					res.viable.push(decisions[i]);
				} else {
					res.unviable.push(decisions[i]);
				}
				continue;
			case 'substitute':
				if (conditionsA.volatiles['substitute'] || ev.t >= 31 || pokeA.hp <= 25 || (pokeA.hp < 50 && speA <= speB) || battle.self.active[0].helpers.lastMove === 'substitute' || pokeA.status in {'psn':1, 'tox':1} || conditionsB.volatiles['taunt']) {
					res.unviable.push(decisions[i]);
				} else if (pokeB.category === 'Status' || ev.t <= 14) {
					res.obligatory.push(decisions[i]);
				} else {
					res.viable.push(decisions[i]);
				}
				continue;
			case 'leechseed':
				if (!conditionsB.volatiles['leechseed'] && !pokeB.hasType('Grass', conditionsB)) res.viable.push(decisions[i]);
				else res.unviable.push(decisions[i]);
				continue;
			case 'endeavor':
			case 'painsplit':
				if (pokeA.hp <= pokeB.hp / 2) res.viable.push(decisions[i]);
				else res.unviable.push(decisions[i]);
				continue;
			case 'bellydrum':
				if (pokeA.hp >= 60 && !(conditionsA.boosts.atk > 1)) res.viable.push(decisions[i]);
				else res.unviable.push(decisions[i]);
				continue;
			case 'clangoroussoul':
				if (pokeA.hp >= 60 && !(conditionsA.boosts.atk > 1) && !(conditionsA.boosts.spa > 1) && !(conditionsA.boosts.spe > 1)) res.viable.push(decisions[i]);
				else res.unviable.push(decisions[i]);
			case 'geomancy':
				if (pokeA.item && pokeA.item.id === 'powerherb') res.viable.push(decisions[i]);
				else if (!pokeA.item) res.unviable.push(decisions[i]);
				continue;
			case 'destinybond':
				if (battle.self.active[0].helpers.lastMove === 'destinybond' || conditionsB.volatiles['dynamax'] || pokeA.hp > 25 || (speA < speB && !hasAbility(pokeA, 'prankster') && !pokeA.hasItem('custapberry'))) res.unviable.push(decisions[i]);
				else res.viable.push(decisions[i]);
				continue;
			case 'disable':
			case 'encore':
			case 'torment':
				if (conditionsB.volatiles[move.volatileStatus] || conditionsB.volatiles['dynamax'] || hasAbility(pokeB, 'aromaveil')) {
					res.unviable.push(decisions[i]);
				} else if (move.id !== 'torment' && !(battle.foe.active[0].helpers.lastMove && battle.turn - battle.foe.active[0].helpers.sw > 1 && battle.foe.active[0].helpers.lastMoveTurn > battle.foe.active[0].helpers.sw)) {
					res.unviable.push(decisions[i]);
				} else if (move.id !== 'encore' && pokeB.item && pokeB.item.id.startsWith('choice')) {
					res.obligatory.push(decisions[i]);
				} else {
					res.viable.push(decisions[i]);
				}
				continue;
			case 'attract':
				if (conditionsB.volatiles['attract'] || hasAbility(pokeB, {'aromaveil':1, 'oblivious':1}) || !(pokeA.gender + pokeB.gender in {'FM':1, 'MF':1})) {
					res.unviable.push(decisions[i]);
				} else {
					res.viable.push(decisions[i]);
				}
				continue;
			case 'taunt':
				if (conditionsB.volatiles[move.volatileStatus] || !hasStatus || hasAbility(pokeB, {'aromaveil':1, 'oblivious':1})) {
					res.unviable.push(decisions[i]);
				} else if (pokeB.category === 'Status' || ev.t <= 14) {
					res.obligatory.push(decisions[i]);
				} else {
					res.viable.push(decisions[i]);
				}
				continue;
			case 'curse':
				if (pokeA.hasType('Ghost', conditionsA) && pokeA.hp >= 60) {
					if (!conditionsB.volatiles[move.volatileStatus]) res.viable.push(decisions[i]);
					else res.unviable.push(decisions[i]);
				} else {
					let curseBoosts = {'atk':1, 'def':1};
					if (hasAbility(pokeA, 'contrary')) curseBoosts = {'spe':1};
					let alCurBoost = 0;
					for (var cb in curseBoosts) {
						alCurBoost++;
						if (conditionsA.boosts[cb] && conditionsA.boosts[cb] >= 6) alCurBoost--;
					}
					if (alCurBoost > 0) res.viable.push(decisions[i]);
					else res.unviable.push(decisions[i]);
				}
				continue;
			case 'yawn':
				if (!conditionsB.volatiles[move.volatileStatus] && pokeB.status !== 'slp') {
					res.viable.push(decisions[i]);
				} else {
					res.unviable.push(decisions[i]);
				}
				continue;
			case 'foresight':
			case 'odorsleuth':
				if (!conditionsB.volatiles[move.volatileStatus] && pokeB.hasType('Ghost', conditionsB)) {
					res.viable.push(decisions[i]);
				} else {
					res.unviable.push(decisions[i]);
				}
				continue;
			case 'gastroacid':
				if (!battle.foe.active[0].supressedAbility) {
					res.viable.push(decisions[i]);
				} else {
					res.unviable.push(decisions[i]);
				}
				continue;
			case 'nightmare':
				if (!conditionsB.volatiles[move.volatileStatus] && pokeB.status === 'slp') {
					res.viable.push(decisions[i]);
				} else {
					res.unviable.push(decisions[i]);
				}
				continue;
			case 'healblock':
				if (conditionsB.volatiles[move.volatileStatus] || hasAbility(pokeB, 'aromaveil')) {
					res.unviable.push(decisions[i]);
				} else {
					res.viable.push(decisions[i]);
				}
				continue;
			case 'aquaring':
			case 'embargo':
			case 'focusenergy':
			case 'imprison':
			case 'ingrain':
			case 'magnetrise':
			case 'powertrick':
			case 'telekinesis':
				if (conditionsA.volatiles[move.volatileStatus]) {
					res.unviable.push(decisions[i]);
				} else {
					res.viable.push(decisions[i]);
				}
				continue;
			case 'perishsong':
				if (selfCanSwitch(decisions, pokeA, conditionsA, pokeB, conditionsB) && !conditionsB.volatiles['perish3'] && !conditionsB.volatiles['perish2'] && !conditionsB.volatiles['perish1']) {
					res.viable.push(decisions[i]);
				} else {
					res.unviable.push(decisions[i]);
				}
				continue;
			case 'tailwind':
				if (conditionsA.side['tailwind'] || battle.conditions['trickroom'] || (speA > speB && (!conditionsB.boosts.spe || conditionsB.boosts.spe <= 0))) {
					res.unviable.push(decisions[i]);
				} else {
					res.viable.push(decisions[i]);
				}
				continue;
			case 'auroraveil':
			case 'gmaxresonance':
				if (conditionsA.side['auroraveil'] || supressedWeather || toId(battle.conditions.weather) !== 'hail') {
					res.unviable.push(decisions[i]);
				} else if (pokeB.category === 'Status') {
					res.viable.push(decisions[i]);
				} else {
					res.obligatory.push(decisions[i]);
				}
				continue;
			case 'reflect':
			case 'baddybad':
				if (conditionsA.side['reflect'] || conditionsA.volatiles['reflect']) { // Gen 1
					res.unviable.push(decisions[i]);
				} else if (pokeB.category in {'Mixed':1, 'Physical':1}) {
					res.obligatory.push(decisions[i]);
				} else {
					res.viable.push(decisions[i]);
				}
				continue;
			case 'lightscreen':
			case 'glitzyglow':
				if (conditionsA.side['lightscreen']) {
					res.unviable.push(decisions[i]);
				} else if (pokeB.category in {'Mixed':1, 'Special':1}) {
					res.obligatory.push(decisions[i]);
				} else {
					res.viable.push(decisions[i]);
				}
				continue;
			case 'trickroom':
				if (battle.conditions['trickroom'] || speA >= speB || conditionsA.boosts.spe > 0 || conditionsB.boosts.spe < 0) {
					res.unviable.push(decisions[i]);
				} else {
					res.obligatory.push(decisions[i]);
				}
				continue;
			case 'gravity':
			case 'gmaxgravitas':
				if (battle.conditions['gravity']) {
					res.unviable.push(decisions[i]);
				} else if (!pokeB.isGrounded(conditionsB)) {
					res.obligatory.push(decisions[i]);
				} else {
					res.viable.push(decisions[i]);
				}
				continue;
			case 'trick':
			case 'switcheroo':
				if (!pokeA.item || !pokeA.item.id.startsWith('choice') || pokeB.template.requiredItem || pokeB.template.requiredItems || (pokeB.item && (pokeB.onTakeItem || pokeB.item.id.startsWith('choice')))) {
					res.unviable.push(decisions[i]);
				} else if (pokeB.category === 'Status') {
					res.obligatory.push(decisions[i]);
				} else if (ev.t <= 19) {
					res.viable.push(decisions[i]);
				} else {
					res.unviable.push(decisions[i]);
				}
				continue;
			case 'aromatherapy':
			case 'gmaxsweetness':
			case 'healbell':
			case 'refresh':
			case 'sparklyswirl':
				if (selfHasStatus(battle)) {
					res.viable.push(decisions[i]);
				} else {
					res.unviable.push(decisions[i]);
				}
				continue;
			case 'haze':
			case 'heartswap':
			case 'spectralthief':
			case 'topsyturvy':
				let boostsHaze = {total: 0};
				let speA2 = pokeA.getSpe(battle, conditionsA, battle.self.active[0].moves, true, randomBattle);
				let speB2 = pokeB.getSpe(battle, conditionsB, movesB, true, randomBattle);
				for (var j in conditionsB.boosts) {
					if (conditionsB.boosts[j] > 0) {
						boostsHaze[j] = 1;
						boostsHaze.total++;
					}
				}
				if (boostsHaze.atk || boostsHaze.spa || (boostsHaze.spe && speA2 >= speB2)) {
					res.obligatory.push(decisions[i]);
				} else if (boostsHaze.total > 0) {
					res.viable.push(decisions[i]);
				} else {
					res.unviable.push(decisions[i]);
				}
				continue;
		}
		if (move.target === 'allySide' && move.sideCondition) {
			if (!conditionsA.side[toId(move.sideCondition)]) {
				res.viable.push(decisions[i]);
			} else {
				res.unviable.push(decisions[i]);
			}
			continue;
		}
		if (move.id in singleTurnMoves) {
			if (battle.self.active[0].helpers.lastMove in singleTurnMoves) {
				res.unviable.push(decisions[i]);
			} else if (move.id === 'maxguard' !== !!conditionsB.volatiles['dynamax']) {
				res.unviable.push(decisions[i]);
			} else if (hasAbility(pokeA, 'speedboost') && !(conditionsA.boosts.spe > 0)) {
				res.obligatory.push(decisions[i]);
			// protect on badly poisoned foe, but don't be too predictable to prevent safe switch-in or setup
			// needs to be obligatory to be chosen instead of a switch-out
			} else if (pokeB.status === 'tox' && !(pokeA.status in {'brn':1, 'psn':1, 'tox':1}) && Math.random() >= 0.5) {
				res.obligatory.push(decisions[i]);
			} else {
				res.viable.push(decisions[i]);
			}
			continue;
		}

		let moveStatus = move.status;
		if (move.secondary && move.secondary.status && (move.secondary.chance >= 50 || (move.secondary.chance >= 25 && hasAbility(pokeA, 'serenegrace'))) && (move.accuracy > 70 || hasAbility(pokeA, 'noguard'))) {
			moveStatus = move.secondary.status;
		}
		if (move.id === 'psychoshift' && !(pokeA.status in {'frz':1, 'slp':1})) moveStatus = pokeA.status;
		if (move.id === 'fling' && pokeA.item && !pokeA.hasAbility('klutz')) {
			switch (pokeA.item.id) {
				case 'lightball':
					moveStatus = 'par';
					break;
				case 'flameorb':
					moveStatus = 'brn';
					break;
				case 'toxicorb':
					moveStatus = 'tox';
					break;
			}
		}
		if (moveStatus) {
			if (pokeB.status || hasAbility(pokeB, 'comatose') || (pokeB.template.species === 'Minior' || hasAbility(pokeB, 'shieldsdown'))) {
				res.unviable.push(decisions[i]);
				continue;
			}
			if (battle.conditions['mistyterrain'] && pokeB.isGrounded(conditionsB)) {
				res.unviable.push(decisions[i]);
				continue;
			}
			if (!supressedWeather) {
				if (
					(toId(battle.conditions.weather) in {'desolateland':1, 'sunnyday':1} && hasAbility(pokeB, 'leafguard')) ||
					(toId(battle.conditions.weather) in {'primordealsea':1, 'raindance':1} && hasAbility(pokeB, 'hydration'))
				) {
					res.unviable.push(decisions[i]);
					continue;
				}
			}
			switch (moveStatus) {
				case 'par':
					if ((speA > speB && !(!conditionsB.boosts.spe || conditionsB.boosts.spe <= 0) && !hasAbility(pokeA, 'prankster')) || (battle.gen > 5 && pokeB.hasType('Electric', conditionsB)) || hasAbility(pokeB, {'guts':1, 'limber':1})) {
						res.unviable.push(decisions[i]);
						continue;
					}
					break;
				case 'brn':
					if (!(pokeB.category in {'Mixed':1, 'Physical':1}) || pokeB.hasType('Fire', conditionsB) || hasAbility(pokeB, {'flareboost':1, 'guts':1, 'waterbubble':1, 'waterveil':1})) {
						res.unviable.push(decisions[i]);
						continue;
					}
					break;
				case 'tox':
					if ((pokeB.hasType(['Poison', 'Steel'], conditionsB) && !hasAbility(pokeA, 'corrosion')) || (hasAbility(pokeB, {'guts':1, 'immunity':1, 'magicguard':1, 'pastelveil':1, 'toxicboost':1}))) {
						res.unviable.push(decisions[i]);
						continue;
					} else if (battle.gen > 2) {
						let obligatory = false;
						for (var j = 0; j < movesB.length; j++) {
							if ((movesB[j].heal && movesB[j].id !== 'lifedew') || movesB[j].id in {'leechseed':1, 'moonlight':1, 'morningsun':1, 'rest':1, 'sappyseed':1, 'shoreup':1, 'strengthsap':1, 'synthesis':1, 'wish':1}) obligatory = true;
						}
						if (obligatory) {
							res.obligatory.push(decisions[i]);
							continue;
						}
					}
					break;
				case 'psn':
					res.unviable.push(decisions[i]);
					continue;
				case 'slp':
					if (hasAbility(pokeB, {'insomnia':1, 'sweetveil':1, 'vitalspirit':1}) || (move.id === 'darkvoid' && pokeA.template.species !== 'Darkrai') || (battle.rules.indexOf('Sleep Clause Mod') >= 0 && alreadyOppSleeping(battle))) {
						res.unviable.push(decisions[i]);
						continue;
					}
					break;
			}
			res.viable.push(decisions[i]);
			continue;
		}

		if (move.selfdestruct && move.category === 'Status') {
			if (pokeA.hp > 25 || selfLastPokemon(battle)) {
				res.unviable.push(decisions[i]);
			} else {
				res.viable.push(decisions[i]);
			}
			continue;
		}
		if ((move.heal && move.id !== 'lifedew') || move.id in {'moonlight':1, 'morningsun':1, 'rest':1, 'shoreup':1, 'strengthsap':1, 'synthesis':1, 'wish':1}) {
			if (ev.t >= 31 || (pokeA.status === 'tox' && battle.turn - battle.self.active[0].helpers.sw >= 3)) {
				res.unviable.push(decisions[i]);
			} else if (move.id in {'moonlight':1, 'morningsun':1, 'synthesis':1} && !supressedWeather && toId(battle.conditions.weather) in {'primordialsea':1, 'raindance':1, 'sandstorm':1, 'hail':1}) {
				res.unviable.push(decisions[i]);
			} else if (move.id === 'wish' && battle.self.active[0].helpers.lastMove === 'wish') {
				res.unviable.push(decisions[i]);
			} else if (speA > speB && move.id !== 'wish') {
				if (pokeA.hp >= 60) {
					res.unviable.push(decisions[i]);
				} else if (pokeA.hp <= 25) {
					res.obligatory.push(decisions[i]);
				} else {
					res.viable.push(decisions[i]);
				}
			} else {
				if (pokeA.hp >= 85) {
					res.unviable.push(decisions[i]);
				} else if (pokeA.hp <= 25 && ev.t <= 19) {
					res.obligatory.push(decisions[i]);
				} else {
					res.viable.push(decisions[i]);
				}
			}
			continue;
		}
		if (move.boosts && move.target === 'self') {
			if (pokeA.hp < 75 || (move.boosts.spe > 0 && battle.conditions['trickroom']) || (move.id !== 'shellsmash' && hasAbility(pokeA, {'contrary':1}))) {
				res.unviable.push(decisions[i]);
				continue;
			}
			let hasPhysical = false;
			let hasSpecial = false;
			let moves = battle.request.side.pokemon[0].moves;
			for (var j = 0; j < moves.length; j++) {
				let move2 = Data.getMove(moves[j], battle.gen, battle.id);
				if ((move2.category === 'Physical' && !(move2.id in {'bodypress':1, 'flamecharge':1, 'foulplay':1, 'nuzzle':1, 'rapidspin':1, 'uturn':1})) || move2.id === 'photongeyser') hasPhysical = true;
				if (move2.category === 'Special' || move2.id === 'naturepower') hasSpecial = true;
			}
			if ((move.boosts.atk > 0 && (!move.boosts.spa || move.boosts.spa < 0) && !hasPhysical) || (move.boosts.spa > 0 && (!move.boosts.atk || move.boosts.atk < 0) && !hasSpecial)) {
				res.unviable.push(decisions[i]);
				continue;
			}
			let alreadyBoost = 0;
			for (var b in move.boosts) {
				alreadyBoost++;
				if (conditionsA.boosts[b] && conditionsA.boosts[b] >= 6) { // Max
					alreadyBoost--;
				}
			}
			if (alreadyBoost > 0) {
				res.viable.push(decisions[i]);
			} else {
				res.unviable.push(decisions[i]);
			}
			continue;
		}
		if (move.volatileStatus === 'confusion') {
			if (conditionsB.volatiles['confusion'] || (battle.conditions['mistyterrain'] && pokeB.isGrounded(conditionsB))) {
				res.unviable.push(decisions[i]);
			} else {
				res.viable.push(decisions[i]);
			}
			continue;
		}
		if (move.weather && battle.conditions.weather) {
			let weather = toId(battle.conditions.weather);
			if (weather && ((weather in {'desolateland':1, 'primordialsea':1, 'deltastream':1}) || weather === toId(move.weather))) {
				res.unviable.push(decisions[i]);
			} else {
				res.viable.push(decisions[i]);
			}
			continue;
		}
		if (move.target === 'all') {
			if (battle.conditions[move.id]) {
				res.unviable.push(decisions[i]);
			} else {
				res.viable.push(decisions[i]);
			}
			continue;
		}
		if (move.category === 'Status') res.unviable.push(decisions[i]);
	}
	if (res.sleepTalk.length) {
		res.obligatory = [];
		res.viable = [];
		res.unviable = [];
	} else if (pokeA.item && pokeA.item.id.startsWith('choice')) {
		res.unviable = res.unviable.concat(res.viable);
		res.viable = [];
	}
	return res;
};

var getViableDamageMoves = exports.getViableDamageMoves = function (battle, decisions) {
	let res = {
		ohko: [], // +99% -> replace status moves
		thko: [], // +50% -> no switch, might use status moves if not priority
		'3hko': [], // +33% -> switch if better types, might use status moves
		bad: [], // 1-33 -> switch if better types, replaced by status moves
		immune: [],
		defrost: [],
		subbreak: [],
		hasAuthentic: false,
		hasMultihit: false,
	};
	let maxBadDamage = 0;
	let maxDefrostDamage = 0;
	let pokeA = battle.getCalcRequestPokemon(0, true);
	let pokeB = supposeActiveFoe(battle);
	let conditionsA = new Conditions({
		side: battle.self.side,
		volatiles: battle.self.active[0].volatiles,
		boosts: battle.self.active[0].boosts
	});
	let conditionsB = new Conditions({
		side: battle.foe.side,
		volatiles: battle.foe.active[0].volatiles,
		boosts: battle.foe.active[0].boosts
	});
	let randomBattle = (battle.id.indexOf('random') >= 0 || battle.id.indexOf('challengecup') >= 0 || battle.id.indexOf('hackmonscup') >= 0);
	let speA = pokeA.getSpe(battle, conditionsA, battle.self.active[0].moves, false, randomBattle);
	let speB = pokeB.getSpe(battle, conditionsB, battle.foe.active[0].moves, false, randomBattle);

	let supressedWeather = weatherSupressed(pokeA, pokeB);
	for (var i = 0; i < decisions.length; i++) {
		let des = decisions[i][0];
		if (des.type !== 'move') continue; // not a move

		if (battle.request.active[0].canMegaEvo || battle.request.side.pokemon[0].canMegaEvo) {
			if (hasAbility(pokeA, 'speedboost') && !(conditionsA.boosts > 0)) {
				if (des.mega) continue; // don't mega immediately with speed boost
			} else {
				if (!des.mega) continue; // Mega evolve by default
			}
		}

		if (des.dynamax && !(conditionsB.volatiles['dynamax'] && pokeA.hp > 50) && !selfLastPokemon(battle)) {
			if (!((conditionsA.boosts.atk > 0 || conditionsA.boosts.spa > 0) && pokeA.hp > 50) && !(conditionsA.boosts.spe > 0)) continue;
		}

		let move = des.moveData;
		if (move.id === 'naturepower') {
			move = Data.getMove('triattack', battle.gen, battle.id);
			if (battle.conditions['electricterrain']) move = Data.getMove('thunderbolt', battle.gen, battle.id);
			if (battle.conditions['grassyterrain']) move = Data.getMove('energyball', battle.gen, battle.id);
			if (battle.conditions['mistyterrain']) move = Data.getMove('moonblast', battle.gen, battle.id);
			if (battle.conditions['psychicterrain']) move = Data.getMove('psychic', battle.gen, battle.id);
		}
		if (move.category === 'Status') continue; // Status move

		// bad moves
		if (move.selfdestruct && (pokeA.hp > 25 || selfLastPokemon(battle))) continue;
		if (move.id in {'bide':1, 'lastresort':1}) continue;
		if (move.id === 'dreameater' && pokeB.status !== 'slp') continue;
		if (move.id in {'fakeout':1, 'firstimpression':1} && (battle.self.active[0].helpers.sw !== battle.turn || conditionsB.volatiles['dynamax'])) continue;
		if (move.id === 'focuspunch' && !conditionsA.volatiles['substitute']) continue;
		if (move.id in {'hurricane':1, 'thunder':1} && toId(battle.conditions.weather) in {'desolateland':1, 'sunnyday':1}) continue;
		if (move.id in {'endeavor':1, 'snore':1}) continue; // handled as support moves
		if (move.id in {'solarbeam':1, 'solarblade':1} && !supressedWeather && !(toId(battle.conditions.weather) in {'desolateland':1, 'sunnyday':1})) continue;

		let dmg = Calc.calculate(pokeA, pokeB, move, conditionsA, conditionsB, battle.conditions, battle.gen, battle.id).getAvg();

		let hp = pokeB.hp;
		if (conditionsB.volatiles['dynamax']) {
			hp *= 2;
			if (speA < speB && move.priority <= 0 && pokeB.template.species.startsWith('Alcremie')) hp = Math.min(200, hp + 33.3);
		} else if (speA < speB && move.priority <= 0 && !(pokeB.status in {'frz':1, 'slp':1}) && !conditionsB.volatiles['healblock'] && !conditionsB.volatiles['taunt']) {
			let movesB = battle.foe.active[0].moves;
			let foeRecoveryHP = 0;
			for (var j = 0; j < movesB.length; j++) {
				if (movesB[j].id === 'lifedew') foeRecoveryHP = Math.max(foeRecoveryHP, 25);
				if (movesB[j].id in {'healorder':1, 'milkdrink':1, 'recover':1, 'roost':1, 'slackoff':1, 'softboiled':1, 'shoreup':1, 'strengthsap':1}) foeRecoveryHP = Math.max(foeRecoveryHP, 50);
				if (movesB[j].id === 'purify' && pokeA.status) foeRecoveryHP = Math.max(foeRecoveryHP, 50);
				if (move.id in {'moonlight':1, 'morningsun':1, 'synthesis':1}) {
					if (supressedWeather || !battle.conditions.weather) {
						foeRecoveryHP = Math.max(foeRecoveryHP, 50);
					} else if (toId(battle.conditions.weather) in {'desolateland':1, 'sunnyday':1}) {
						foeRecoveryHP = Math.max(foeRecoveryHP, 66.6);
					} else {
						foeRecoveryHP = Math.max(foeRecoveryHP, 25);
					}
				}
				if (movesB[j].id === 'shoreup' && !supressedWeather && toId(battle.conditions.weather) === 'sandstorm') foeRecoveryHP = Math.max(foeRecoveryHP, 66.6);
				if (movesB[j].id === 'rest' && !((battle.conditions['electricterrain'] || battle.conditions['mistyterrain']) && pokeB.isGrounded(conditionsB))) foeRecoveryHP = Math.max(foeRecoveryHP, 100);
				if (movesB[j].id === 'strengthsap') foeRecoveryHP = Math.max(foeRecoveryHP, (100 * pokeA.getStat('atk', battle.gen)) / pokeB.getStat('hp', battle.gen));
			}
			if (move.id === 'suckerpunch' && foeRecoveryHP > 0) continue;
			hp = Math.min(100, hp + foeRecoveryHP);
		}

		let pc = (dmg * 100) / hp;
		if (move.id === 'guardianofalola') {
			if (hp < 87.5) continue;
			if (!hasAbility(pokeB, 'wonderguard')) pc = 74.9;
		}
		if (move.id in {'naturesmadness':1, 'superfang':1}) {
			if (hp < 87.5) continue;
			if (!hasAbility(pokeB, 'wonderguard') && !battle.conditions.inversebattle && TypeChart.getMultipleEff(move.type, pokeB.getTypes(conditionsB), battle.gen, false, false, battle.id) > 0) pc = 49.9;
		}

		debug('Move: ' + move.name + ' | Damage = ' + dmg + ' | Percent: ' + pc);
		if (pc <= 0) {
			res.immune.push(decisions[i]);
			continue;
		}

		// calculate residual
		let residual = 0;

		// status
		let afterMoveStatus = pokeB.status;
		if (afterMoveStatus) {
			if (afterMoveStatus === 'brn' && move.id === 'sparklingaria') afterMoveStatus = null;
			if (afterMoveStatus === 'slp' && move.id in {'wakeupslap':1, 'maxlightning':1}) afterMoveStatus = null;
		} else if ((!conditionsB.volatiles['substitute'] || hasAbility(pokeA, 'infiltrator')) && !(battle.conditions['mistyterrain'] && pokeB.isGrounded(conditionsB))) {
			if (move.secondary && move.secondary.status && (move.secondary.chance >= 50 || (move.secondary.chance >= 25 && hasAbility(pokeA, 'serenegrace')))) {
				afterMoveStatus = move.secondary.status;
			}
			if (move.id === 'gmaxstunshock') afterMoveStatus = 'psn';
			if (move.id === 'psychoshift' && !(pokeA.status in {'frz':1, 'slp':1})) afterMoveStatus = pokeA.status;
			if (move.id === 'fling' && pokeA.item && !pokeA.hasAbility('klutz')) {
				switch (pokeA.item.id) {
					case 'flameorb':
						afterMoveStatus = 'brn';
						break;
					case 'toxicorb':
						afterMoveStatus = 'tox';
						break;
					case 'poisonbarb':
						afterMoveStatus = 'psn';
						break;
				}
			}
		}
		if (afterMoveStatus && (!hasAbility(pokeB, 'magicguard'))) {
			switch (afterMoveStatus) {
				case 'brn':
					let burnResidual = (battle.gen >= 7 ? 6.25 : 12.5);
					if (hasAbility(pokeB, 'heatproof')) burnResidual = burnResidual / 2.0;
					residual -= burnResidual;
					break;
				case 'tox':
					if (hasAbility(pokeB, 'poisonheal')) residual += 12.5;
					else residual -= 6.25 * (battle.turn - battle.self.active[0].helpers.sw + 1);
					break;
				case 'psn':
					if (hasAbility(pokeB, 'poisonheal')) residual += 12.5;
					else residual -= 12.5;
					break;
				case 'slp':
					if (hasAbility(pokeA, 'baddreams')) residual -= 12.5;
					break;
			}
		}
		if (conditionsB.volatiles['curse']) residual -= 25;
		if (move.id === 'sappyseed' || conditionsB.volatiles['leechseed']) residual -= 12.5;
		if (move.id !== 'rapidspin' && conditionsA.volatiles['leechseed']) residual += (12.5 * pokeA.getStat('hp', battle.gen) / pokeB.getStat('hp', battle.gen));
		if (move.volatileStatus === 'partiallytrapped' || move.id in {'gmaxcentiferno':1, 'gmaxsandblast':1}) residual -= (pokeA.hasItem('bindingband') ? 100 / 6.0 : 12.5);

		// item
		if (pokeB.item && (move.id !== 'knockoff' || hasAbility(pokeB, 'stickyhold')) && !hasAbility(pokeB, 'klutz')) {
			switch (pokeB.item.id) {
				case 'leftovers':
					if (!conditionsB.volatiles['healblock']) residual += 6.25;
					break;
				case 'blacksludge':
					if (pokeB.hasType('Poison', conditionsB)) {
						if (!conditionsB.volatiles['healblock']) residual += 6.25;
					} else if (!hasAbility(pokeB, 'magicguard')) {
						residual -= 12.5;
					}
					break;
				case 'lifeorb':
					if (!hasAbility(pokeB, {'magicguard':1, 'sheerforce':1})) residual -= 10;
					break;
				case 'stickybarb':
					if ((!pokeA.item || !(move.flags && move.flags['contact'])) && !hasAbility(pokeB, 'magicguard')) residual -= 12.5;
					break;
			}
		}

		// weather/terrain
		let afterMoveWeather = (supressedWeather ? null : toId(battle.conditions.weather));
		if (!supressedWeather) {
			switch (move.id) {
				case 'maxflare':
					afterMoveWeather = 'sunnyday';
					break;
				case 'magikarpsrevenge':
				case 'maxgeyser':
					afterMoveWeather = 'raindance';
					break;
				case 'maxrockfall':
					afterMoveWeather = 'sandstorm';
					break;
				case 'maxhailstorm':
					afterMoveWeather = 'hail';
					break;
			}
		}
		if (afterMoveWeather && !hasAbility(pokeB, {'magicguard':1, 'overcoat':1})) {
			switch (afterMoveWeather) {
				case 'desolateland':
				case 'sunnyday':
					if (hasAbility(pokeB, {'dryskin':1, 'solarpower':1})) residual -= 12.5;
					break;
				case 'primordealsea':
				case 'raindance':
					if (!conditionsB.volatiles['healblock']) {
						if (hasAbility(pokeB, 'dryskin')) residual += 12.5;
						if (hasAbility(pokeB, 'raindish')) residual += 6.25;
					}
					break;
				case 'sandstorm':
					if (!pokeB.hasType(['Ground', 'Rock', 'Steel'], conditionsB) && !hasAbility(pokeB, {'sandforce':1, 'sandrush':1, 'sandveil':1})) residual -= 6.25;
					break;
				case 'hail':
					if (hasAbility(pokeB, 'icebody')) {
						if (!conditionsB.volatiles['healblock']) residual += 6.25;
					} else if (!pokeB.hasType('Ice', conditionsB) && !hasAbility(pokeB, 'forecast')) {
						residual -= 6.25;
					}
					break;
			}
		}
		if (!(move.id in {'genesissupernova':1, 'splinteredstormshards':1, 'maxlightning':1, 'maxmindstorm':1, 'maxstarfall':1, 'gmaxwindrage':1}) && (move.id === 'maxovergrowth' || battle.conditions['grassyterrain']) && !conditionsB.volatiles['healblock'] && pokeB.isGrounded(conditionsB)) residual += 6.25;

		// gmax effects
		if (move.id in {'gmaxvolcalith':1, 'gmaxwildfire':1} && !pokeB.hasType(move.type, conditionsB)) residual -= 100 / 6.0;

		residual = [residual, residual];
		if (pokeB.status === 'tox' && !hasAbility(pokeB, {'magicguard':1, 'poisonheal':1})) residual[1] -= 6.25;
		for (var j = 0; j < residual.length; j++) {
			residual[j] = residual[j] * 100 / hp;
		}
		debug('Residual: ' + residual);

		let hazard = Calc.getHazardsDamage(pokeB, conditionsB, battle.conditions, battle.gen, battle.id);
		if (hasAbility(pokeB, {'regenerator':1})) hazard -= 33.3;
		hazard = hazard * 100 / hp;
		if (hazard < 0) hazard = 0;
		if (hazard > 100) hazard = 100;

		if (move.id in {'fakeout':1, 'firstimpression':1}) {
			if (pc >= 100 - hazard + Math.min(0, residual[0])) {
					res.ohko.push(decisions[i]);
			} else if (TypeChart.getMultipleEff(move.type, pokeB.getTypes(conditionsB), battle.gen, false, !!battle.conditions.inversebattle, battle.id) >= 1) {
				res.thko.push(decisions[i]);
			} else {
				res.bad.push(decisions[i]);
			}
			continue;
		}

		let authentic = (move.flags && move.flags['authentic']) || hasAbility(pokeA, 'infiltrator');
		let sub = (conditionsB.volatiles['substitute'] && !authentic ? 25 * 100 / hp : 0);
		if (sub === 0 && !hasAbility(pokeA, {'moldbreaker':1, 'teravolt':1, 'turboblaze':1, 'neutralizinggas':1})) {
			if (pokeB.template.species === 'Mimikyu' && hasAbility(pokeB, 'disguise')) sub = 0.1;
			if (pokeB.template.species === 'Eiscue' && hasAbility(pokeB, 'iceface') && move.category === 'Physical') sub = 0.1;
		}

		let multihit = (move.multihit || move.id === 'beatup' || (hasAbility(pokeA, 'parentalbond') && !move.selfdestruct && !move.multihit && !(move.flags && move.flags['charge']) && !move.isZ && !move.isMax));
		let ohkoPrevent = (!multihit && (sub > 0 || (hp >= 100 && (hasAbility(pokeB, 'sturdy') || hasItem(pokeB, 'focussash')))));

		if (move.id in {'nuzzle':1, 'rapidspin':1} && (sub > 0 || pc < 100)) continue;
		if ((des.zMove || des.dynamax) && sub > 0) continue;
		if ((battle.request.active[0].canZMove || battle.request.side.pokemon[0].canZMove) && sub === 0 && pc < 100) {
			if (!des.zMove && pokeA.item) {
				if (pokeA.item.zMoveType && pokeA.item.zMoveType === move.type) continue;
				if (pokeA.item.zMoveFrom && pokeA.item.zMoveFrom === move.name) continue;
			}
		}

		let foeCanProtect = false;
		if (!(battle.foe.active[0].helpers.lastMove in singleTurnMoves) && !(pokeB.status in {'frz':1, 'slp':1})) {
			let movesB = battle.foe.active[0].moves;
			if (conditionsB.volatiles['dynamax']) {
				for (var j = 0; j < movesB.length; j++) {
					if (movesB[j].category === 'Status') foeCanProtect = true;
				}
			} else {
				const protectMoves = {'protect':1, 'detect':1, 'kingsshield':1, 'quickguard':1, 'spikyshield':1, 'wideguard':1, 'banefulbunker':1, 'obstruct':1};
				for (var j = 0; j < movesB.length; j++) {
					if (movesB[j].id in protectMoves) foeCanProtect = true;
				}
			}
		}

		if (pc >= 99 && !ohkoPrevent) {
			res.ohko.push(decisions[i]);
		} else if (pc <= Math.max(0, residual[0])) {
			res.immune.push(decisions[i]);
		} else if (!(move.flags && move.flags['recharge'])) {
			if (2 * pc >= 100 + sub + residual[0] + (foeCanProtect ? Math.max(0, residual[1]) : 0)) {
				res.thko.push(decisions[i]);
			} else if (3 * pc >= 100 + sub + residual[0] + residual[1]) {
				res['3hko'].push(decisions[i]);
			} else if (pc > maxBadDamage) {
				maxBadDamage = pc;
				res.bad = [decisions[i]];
			}
		}

		if (authentic) {
			res.hasAuthentic = true;
		} else {
			if (multihit) res.hasMultihit = true;
			if (dmg > 25) res.subbreak.push(decisions[i]);
		}
		if (move.flags && move.flags['defrost'] && pc > maxDefrostDamage) {
			maxDefrostDamage = pc;
			res.defrost = [decisions[i]];
		}
	}
	return res;
};

function getMovesData (battle, decisions) {
	for (let i = 0; i < decisions.length; i++) {
		let des = decisions[i][0];
		if (des.type !== 'move') continue;

		let baseMoveName = battle.request.side.pokemon[0].moves[des.moveId];
		des.moveData = Data.getMove(des.move, battle.gen, battle.id);

		if (des.moveData.category !== 'Status') {
			if (des.zMove) {
				let baseMove = Data.getMove(baseMoveName, battle.gen, battle.id);
				if (pokeA.item && pokeA.item.zMoveType && pokeA.item.zMoveType === baseMove.type) {
					des.moveData = Object.assign({}, des.moveData);
					des.moveData.category = baseMove.category;
					if (baseMove.zMovePower) {
						des.moveData.basePower = baseMove.zMovePower;
					} else if (baseMove.basePower >= 140) {
						des.moveData.basePower = 200;
					} else if (baseMove.basePower >= 130) {
						des.moveData.basePower = 195;
					} else if (baseMove.basePower >= 120) {
						des.moveData.basePower = 190;
					} else if (baseMove.basePower >= 110) {
						des.moveData.basePower = 185;
					} else if (baseMove.basePower >= 100) {
						des.moveData.basePower = 180;
					} else if (baseMove.basePower >= 90) {
						des.moveData.basePower = 175;
					} else if (baseMove.basePower >= 80) {
						des.moveData.basePower = 160;
					} else if (baseMove.basePower >= 70) {
						des.moveData.basePower = 140;
					} else if (baseMove.basePower >= 60) {
						des.moveData.basePower = 120;
					} else {
						des.moveData.basePower = 100;
					}
				}
			}

			if (des.moveData.isMax) {
				let baseMove = Data.getMove(baseMoveName, battle.gen, battle.id);
				des.moveData = Object.assign({}, des.moveData);
				des.moveData.category = baseMove.category;
				if (baseMove.gmaxPower) {
					des.moveData.basePower = baseMove.gmaxPower;
				} else if (!baseMove.basePower) {
					des.moveData.basePower = 100;
				} else if (['Fighting', 'Poison'].includes(baseMove.type)) {
					if (baseMove.basePower >= 150) {
						des.moveData.basePower = 100;
					} else if (baseMove.basePower >= 110) {
						des.moveData.basePower = 95;
					} else if (baseMove.basePower >= 75) {
						des.moveData.basePower = 90;
					} else if (baseMove.basePower >= 65) {
						des.moveData.basePower = 85;
					} else if (baseMove.basePower >= 55) {
						des.moveData.basePower = 80;
					} else if (baseMove.basePower >= 45) {
						des.moveData.basePower = 75;
					} else {
						des.moveData.basePower = 70;
					}
				} else {
					if (baseMove.basePower >= 150) {
						des.moveData.basePower = 150;
					} else if (baseMove.basePower >= 110) {
						des.moveData.basePower = 140;
						des.moveData.basePower = 130;
					} else if (baseMove.basePower >= 65) {
						des.moveData.basePower = 120;
					} else if (baseMove.basePower >= 55) {
						des.moveData.basePower = 110;
					} else if (baseMove.basePower >= 45) {
						des.moveData.basePower = 100;
					} else {
						des.moveData.basePower = 90;
					}
				}
			}		
		}

		decisions[i] = [des];
	}

	return decisions;
}

function filterRedundantMaxMoves (decisions) {
	let maxGmaxPowers = {};
	for (let des of decisions) {
		if (des[0].moveData && des[0].moveData.isMax && des[0].moveData.category !== 'Status') {
			let typeAndCategory = des[0].moveData.type + '|' + des[0].moveData.category;
			if (!maxGmaxPowers[typeAndCategory]) maxGmaxPowers[typeAndCategory] = des[0].moveData.basePower;
			else maxGmaxPowers[typeAndCategory] = Math.max(maxGmaxPowers[typeAndCategory], des[0].moveData.basePower);
		}
	}
	decisions = decisions.filter(des => (!(des[0].moveData && des[0].moveData.isMax && des[0].moveData.category !== 'Status') || des[0].moveData.basePower >= maxGmaxPowers[des[0].moveData.type + '|' + des[0].moveData.category]));

	let maxGuardMaxPP = 0;
	for (let des of decisions) {
		if (des[0].move === 'maxguard') maxGuardMaxPP = Math.max(maxGuardMaxPP, des[0].movePP);
	}
	decisions = decisions.filter(des => (des[0].move !== 'maxguard' || des[0].movePP >= maxGuardMaxPP));

	return decisions;
}

function debugBestMove (bestSw, damageMoves, supportMoves) {
	debug('Best switch: ' + (bestSw ? bestSw[0].poke : 'none'));

	let tmp;
	for (let i in damageMoves) {
		if (!damageMoves[i] || !damageMoves[i].length) continue;
		tmp = [];
		for (let j = 0; j < damageMoves[i].length; j++) {
			tmp.push(damageMoves[i][j][0].move);
		}
		debug('Damage Moves (' + i + ') -> ' + tmp);
	}

	for (let i in supportMoves) {
		if (!supportMoves[i] || !supportMoves[i].length) continue;
		tmp = [];
		for (let j = 0; j < supportMoves[i].length; j++) {
			tmp.push(supportMoves[i][j][0].move);
		}
		debug('Support Moves (' + i + ') -> ' + tmp);
	}
}

function sample (arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

var getBestMove = exports.getBestMove = function (battle, decisions) {
	decisions = filterRedundantMaxMoves(getMovesData(battle, decisions));

	let bestSwitch = exports.getBestSwitch(battle, decisions);
	let damageMoves = getViableDamageMoves(battle, decisions);
	let supportMoves = getViableSupportMoves(battle, decisions);
	debugBestMove(bestSwitch, damageMoves, supportMoves);

	let ev = evaluatePokemon(battle, 0);

	let pokeA = battle.getCalcRequestPokemon(0, true);
	let pokeB = supposeActiveFoe(battle);
	let conditionsA = new Conditions({
		side: battle.self.side,
		volatiles: battle.self.active[0].volatiles,
		boosts: battle.self.active[0].boosts
	});
	let conditionsB = new Conditions({
		side: battle.foe.side,
		volatiles: battle.foe.active[0].volatiles,
		boosts: battle.foe.active[0].boosts
	});
	let movesB = battle.foe.active[0].moves;

	let randomBattle = (battle.id.indexOf('random') >= 0 || battle.id.indexOf('challengecup') >= 0 || battle.id.indexOf('hackmonscup') >= 0);
	let speA = pokeA.getSpe(battle, conditionsA, battle.self.active[0].moves, false, randomBattle);
	let speNoBoostA = pokeA.getSpe(battle, conditionsA, battle.self.active[0].moves, true, randomBattle);
	let speB = pokeB.getSpe(battle, conditionsB, movesB, false, randomBattle);
	if (battle.conditions['trickroom']) {
		speA = -1 * speA;
		speNoBoostA = -1 * speNoBoostA;
		speB = -1 * speB;
	}
	let supressedWeather = weatherSupressed(pokeA, pokeB);

	/* Special switch cases */

	let switchIfNoOption = false;
	if (bestSwitch) {
		// No switch if you die
		if (Calc.getHazardsDamage(pokeA, conditionsA, battle.conditions, battle.gen, battle.id) > pokeA.hp + (hasAbility(pokeA, 'regenerator') ? 33.3 : 0)) bestSwitch = null;
		// No switch behind sub
		if (conditionsA.volatiles['substitute'] && (damageMoves.ohko.length || damageMoves.thko.length || damageMoves['3hko'].length)) bestSwitch = null;
		// No switch when dynamaxed
		if (conditionsA.volatiles['dynamax']) bestSwitch = null;

		if (conditionsB.volatiles['substitute'] && !damageMoves.subbreak.length && !damageMoves.hasMultihit && !damageMoves.hasAuthentic && !supportMoves.hasAuthentic) switchIfNoOption = true;
		if (pokeA.status === 'tox' && battle.turn - battle.self.active[0].helpers.sw >= 3 && !hasAbility(pokeA, {'magicguard':1, 'poisonheal':1})) switchIfNoOption = true;
		if (pokeA.status && hasAbility(pokeA, 'naturalcure')) switchIfNoOption = true;
		if (conditionsA.volatiles['curse'] || conditionsA.volatiles['leechseed'] || (!battle.conditions['trickroom'] && speNoBoostA > speB && speA < speB && conditionsA.boosts.spe < 0)) switchIfNoOption = true;

		let movesA = battle.request.side.pokemon[0].moves;
		for (let moveId of movesA) {
			if (moveId === 'photongeyser') continue;
			let move = Data.getMove(moveId, battle.gen, battle.id);
			if ((move.category === 'Physical' && conditionsA.boosts.atk < 0) || (move.category === 'Special' && conditionsA.boosts.spa < 0)) {
				switchIfNoOption = true;
			}
		}

		if (bestSwitch) {
			if (supportMoves.switching.length) bestSwitch = sample(supportMoves.switching);
			if (conditionsA.volatiles['perish1']) return bestSwitch;
		}
	}

	let damageMoveCategories = [supportMoves.sleepTalk];
	if (pokeA.status === 'frz') damageMoveCategories.push(damageMoves.defrost);
	damageMoveCategories = damageMoveCategories.concat([damageMoves.ohko, damageMoves.thko, damageMoves['3hko'], damageMoves.bad]);

	let finalDamageMoves = [];
	for (let category of damageMoveCategories) {
		if (category.length) {
			finalDamageMoves = category.slice();
			break;
		}
	}

	let filteredMoves = [];

	// multihit or authentic if sub
	if (conditionsB.volatiles['substitute'] && !hasAbility(pokeA, {'infiltrator':1, 'parentalbond':1})) {
		filteredMoves = [];
		for (var i = 0; i < finalDamageMoves.length; i++) {
			var move = finalDamageMoves[i][0].moveData;
			if (move.multihit || move.id === 'beatup') filteredMoves.push(moves[i]);
		}
		if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;

		filteredMoves = [];
		for (var i = 0; i < finalDamageMoves.length; i++) {
			var move = finalDamageMoves[i][0].moveData;
			if (move.flags && move.flags['authentic']) filteredMoves.push(moves[i]);
		}
		if (filteredMoves.length > 0) {
			finalDamageMoves = filteredMoves;
		} else {
			finalDamageMoves = damageMoves.subbreak.slice();
		}
	}

	// multihit if sub/disguise/ice face
	if ((conditionsB.volatiles['substitute'] || (pokeB.template.species === 'Mimikyu' && hasAbility(pokeB, 'disguise')) || (pokeB.template.species === 'Eiscue' && hasAbility(pokeB, 'iceface') && move.category === 'Physical')) && !hasAbility(pokeA, {'infiltrator':1, 'parentalbond':1})) {
		filteredMoves = [];
		for (var i = 0; i < finalDamageMoves.length; i++) {
			var move = finalDamageMoves[i][0].moveData;
			if (move.multihit || move.id === 'beatup') filteredMoves.push(moves[i]);
		}
		if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
	}

	// max priority
	let maxPriority = -10;
	filteredMoves = [];
	for (var i = 0; i < finalDamageMoves.length; i++) {
		let move = finalDamageMoves[i][0].moveData;
		let priority = move.priority;
		if (move.drain && hasAbility(pokeA, 'triage')) priority += 3;
		if (move.id === 'naturepower' && hasAbility(pokeA, 'prankster')) priority += 1;
		if (move.type === 'Flying' && (battle.gen <= 6 || pokeA.hp >= 100) && hasAbility(pokeA, 'galewings')) priority += 1;
		if (priority === maxPriority) {
			filteredMoves.push(finalDamageMoves[i]);
		} else if (priority > maxPriority) {
			maxPriority = move.priority;
			filteredMoves = [finalDamageMoves[i]];	
		}
	}
	if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
	if (maxPriority < 1 && damageMoves.ohko.length === 0 && supportMoves.obligatory.length > 0 && hasAbility(pokeA, 'prankster')) maxPriority = 1;

	// no charge/recharge
	filteredMoves = [];
	for (var i = 0; i < finalDamageMoves.length; i++) {
		let move = finalDamageMoves[i][0].moveData;
		if (!move.flags || (!move.flags['charge'] && !move.flags['recharge'])) filteredMoves.push(finalDamageMoves[i]);
	}
	if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;

	// self attack/speed stat increase
	filteredMoves = [];
	for (var i = 0; i < finalDamageMoves.length; i++) {
		let move = finalDamageMoves[i][0].moveData;
		if (move.secondary && (move.secondary.chance >= 50 || (move.secondary.chance >= 25 && hasAbility(pokeA, 'serenegrace'))) && move.secondary.self && move.secondary.self.boosts && (move.secondary.self.boosts.atk || move.secondary.self.boosts.spa || move.secondary.self.boosts.spe)) filteredMoves.push(finalDamageMoves[i]);
		if (move.id in {'maxairstream':1, 'maxknuckle':1, 'maxooze':1}) filteredMoves.push(finalDamageMoves[i]);
		if (move.id === 'fellstinger' && damageMoves.ohko.length) filteredMoves.push(finalDamageMoves[i]);
	}
	if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;

	// foe defense/speed stat decrease
	if (!damageMoves.ohko.length) {
		filteredMoves = [];
		for (var i = 0; i < finalDamageMoves.length; i++) {
			let move = finalDamageMoves[i][0].moveData;
			if (move.secondary && (move.secondary.chance >= 50 || (move.secondary.chance >= 25 && hasAbility(pokeA, 'serenegrace'))) && move.secondary.boosts && (move.secondary.boosts.def || move.secondary.boosts.spd || move.secondary.boosts.spe)) filteredMoves.push(finalDamageMoves[i]);
			if (move.id in {'maxdarkness':1, 'maxphantasm':1, 'maxstrike':1, 'gmaxfoamburst':1}) filteredMoves.push(finalDamageMoves[i]);
		}
		if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
	}

	// no recoil
	filteredMoves = [];
	for (var i = 0; i < finalDamageMoves.length; i++) {
		let move = finalDamageMoves[i][0].moveData;
		if ((!move.recoil || pokeB.hp * move.recoil[0] / move.recoil[1] < pokeA.hp) && !move.mindBlownRecoil) filteredMoves.push(finalDamageMoves[i]);
	}
	if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;

	// max accuracy
	if (!hasAbility(pokeA, {'compoundeyes':1, 'noguard':1, 'victorystar':1})) {
		let maxAccuracy = 0;
		for (var i = 0; i < finalDamageMoves.length; i++) {
			let move = finalDamageMoves[i][0].moveData;
			let accuracy = move.finalDamageMoves;
			if (!supressedWeather) {
				if (move.id in {'hurricane':1, 'thunder':1}) {
					if (toId(battle.conditions.weather) in {'primordealsea':1, 'raindance':1}) accuracy = true;
					if (toId(battle.conditions.weather) in {'desolateland':1, 'sunnyday':1}) accuracy = 50;
				}
				if (move.id === 'blizzard' && toId(battle.conditions.weather) === 'hail') accuracy = true;
			}
			if (typeof accuracy !== 'number') {
				// z and max moves are considered normal accuracy to prevent them from being chosen on this step (should be used sparingly)
				if (!move.isZ && !move.isMax && !(conditionsA.boosts.accuracy > 0) && !(conditionsB.boosts.evasion < 0)) accuracy = 101;
				else accuracy = 100;
			}
			if (accuracy === maxAccuracy) {
				filteredMoves.push(finalDamageMoves[i]);
			} else if (accuracy > maxAccuracy) {
				maxAccuracy = accuracy;
				filteredMoves = [finalDamageMoves[i]];
			}
		}
		if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
	}

	// no self-confusion
	filteredMoves = [];
	for (var i = 0; i < finalDamageMoves.length; i++) {
		let move = finalDamageMoves[i][0].moveData;
		if (!(move.self && move.self.volatileStatus)) filteredMoves.push(finalDamageMoves[i]);
	}
	if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;

	// no self stat decrease
	filteredMoves = [];
	for (var i = 0; i < finalDamageMoves.length; i++) {
		let move = finalDamageMoves[i][0].moveData;
		if (!(move.self && move.self.boosts)) filteredMoves.push(finalDamageMoves[i]);
	}
	if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;

	// no z or max
	filteredMoves = [];
	for (var i = 0; i < finalDamageMoves.length; i++) {
		if (!finalDamageMoves[i][0].zMove && !finalDamageMoves[i][0].dynamax) filteredMoves.push(finalDamageMoves[i]);
	}
	if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;

	// flinch
	if (!damageMoves.ohko.length && !conditionsB.volatiles['dynamax']) {
		filteredMoves = [];
		for (var i = 0; i < finalDamageMoves.length; i++) {
			let move = finalDamageMoves[i][0].moveData;
			if ((move.secondary && move.secondary.volatileStatus === 'flinch') || move.id in {'firefang':1, 'icefang':1, 'thunderfang':1} || (move.id === 'fling' && pokeA.hasItem({'kingsrock':1, 'razorfang':1}))) filteredMoves.push(finalDamageMoves[i]);
		}
		if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
	}

	// drain or heal
	if (pokeA.hp <= 85 && !conditionsA.volatiles['healblock']) {
		filteredMoves = [];
		for (var i = 0; i < finalDamageMoves.length; i++) {
			let move = finalDamageMoves[i][0].moveData;
			if (move.drain || move.id in {'gmaxfinale':1, 'maxovergrowth':1, 'sappyseed':1}) filteredMoves.push(finalDamageMoves[i]);
		}
		if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
	}

	// self defense stat increase
	filteredMoves = [];
	for (var i = 0; i < finalDamageMoves.length; i++) {
		let move = finalDamageMoves[i][0].moveData;
		if (move.secondary && (move.secondary.chance >= 50 || (move.secondary.chance >= 25 && hasAbility(pokeA, 'serenegrace'))) && move.secondary.self && move.secondary.self.boosts && (move.secondary.self.boosts.def || move.secondary.self.boosts.spd)) filteredMoves.push(finalDamageMoves[i]);
		if (move.id in {'maxquake':1, 'maxsteelspike':1}) filteredMoves.push(finalDamageMoves[i]);
	}
	if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;

	// foe attack stat decrease
	if (!damageMoves.ohko.length) {
		filteredMoves = [];
		for (var i = 0; i < finalDamageMoves.length; i++) {
			let move = finalDamageMoves[i][0].moveData;
			if (move.secondary && (move.secondary.chance >= 50 || (move.secondary.chance >= 25 && hasAbility(pokeA, 'serenegrace'))) && move.secondary.boosts && (move.secondary.boosts.atk || move.secondary.boosts.spa)) filteredMoves.push(finalDamageMoves[i]);
			if (move.id in {'maxflutterby':1, 'maxwyrmwind':1}) filteredMoves.push(finalDamageMoves[i]);
		}
		if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
	}

	// no LO recoil with sheer force
	if (hasAbility(pokeA, {'sheerforce':1}) && hasItem(pokeA, 'lifeorb')) {
		filteredMoves = [];
		for (var i = 0; i < finalDamageMoves.length; i++) {
			let move = finalDamageMoves[i][0].moveData;
			if (move.secondary || move.secondaries) filteredMoves.push(finalDamageMoves[i]);
		}
		if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
	}

	// no contact
	if (!hasAbility(pokeA, {'toughclaws':1})) {
		filteredMoves = [];
		for (var i = 0; i < finalDamageMoves.length; i++) {
			let move =finalDamageMoves[i][0].moveData;
			if (!move.flags || !move.flags['contact'] || move.id === 'uturn') filteredMoves.push(finalDamageMoves[i]);
		}
		if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
	}

	let finalMoveNames = [];
	for (let finalMove of finalDamageMoves) {
		finalMoveNames.push(finalMove[0].move);
	}
	debug('Final damage moves: ' + finalMoveNames);

	let foeHasSwitch = false;
	for (var i = 0; i < movesB.length; i++) {
		if (movesB[i].id in {'batonpass':1, 'teleport':1}) foeHasSwitch = true;
		if (movesB[i].id === 'partingshot' && !hasAbility(pokeA, {'contrary':1, 'magicbounce':1})) foeHasSwitch = true;
		if (movesB[i].id === 'uturn' && !hasAbility(pokeA, {'ironbarbs':1, 'roughskin':1, 'wonderguard':1}) && !hasItem(pokeA, 'rockyhelmet')) foeHasSwitch = true;
		if (movesB[i].id === 'voltswitch' && !pokeA.hasType('Ground',conditionsA) && !hasAbility(pokeA, {'lightningrod':1, 'motordrive':1, 'voltabsorb':1, 'wonderguard':1})) foeHasSwitch = true;
	}

	let defMultiplier = 4;
	for (let stat of ['def', 'spd']) {
		let defBoost = conditionsA.boosts[stat] || 0;
		let multiplier = 1 + (0.5) * Math.abs(defBoost);
		if (defBoost < 0) multiplier = 1 / multiplier;
		if (multiplier < defMultiplier) defMultiplier = multiplier;
	}
	if (defMultiplier <= 1 || hasAbility(pokeB, 'unaware')) defMultiplier = 1;
	if (((conditionsA.side['lightscreen'] && conditionsA.side['reflect']) || conditionsA.side['auroraveil']) && !hasAbility(pokeB, 'infiltrator')) defMultiplier *= 2;

	if (!foeHasSwitch && ((speA < speB && maxPriority <= 0 && ev.t >= 31 * defMultiplier) || (damageMoves.ohko.length === 0 && supportMoves.obligatory.length === 0 && ev.t >= 41 * defMultiplier))) {
		if (bestSwitch) {
			debug('Returning best switch');
			if (bestSwitch[0].type === 'move') return bestSwitch;
			let evBestSwitch = evaluatePokemon(battle, bestSwitch[0].pokeId);
			if (
				(evBestSwitch.hp >= 50 || evBestSwitch.t <= 9) &&
				(evBestSwitch.t < ev.t|| (evBestSwitch.t === ev.t && evBestSwitch.d > ev.d))
			) {
				return bestSwitch;
			}
		}
	}

	if (ev.t <= 19 * defMultiplier && supportMoves.slowswitching.length) bestSwitch = sample(supportMoves.slowswitching);

	if (damageMoves.ohko.length) {
		return sample(finalDamageMoves);
	} else if (supportMoves.obligatory.length) {
		return sample(supportMoves.obligatory);
	} else if (damageMoves.thko.length) {
		if (supportMoves.viable.length > 0 && maxPriority <= 0 && Math.random() >= 0.5) {
			return sample(supportMoves.viable);
		} else {
			return sample(finalDamageMoves);
		}
	} else if (damageMoves['3hko'].length > 0 || supportMoves.viable.length > 0 || damageMoves.bad.length > 0) {
		if (bestSwitch) {
			if (bestSwitch[0].type === 'move' && bestSwitch[0].moveId !== 'batonpass') return bestSwitch;
			if (switchIfNoOption && damageMoves['3hko'].length === 0) return bestSwitch;
			let evBestSwitch = evaluatePokemon(battle, bestSwitch[0].pokeId);
			if (evBestSwitch.t < ev.t || (evBestSwitch.t === ev.t && evBestSwitch.d > ev.d)) {
				return bestSwitch;
			}
		}

		let finalMoves = supportMoves.viable;
		if (damageMoves['3hko'].length > 0 || finalMoves.length === 0) finalMoves = finalMoves.concat([sample(finalDamageMoves)]);
		return sample(finalMoves);
	} else if (bestSwitch) {
		battle.self.active[0].helpers.hasNoViableMoves = battle.foe.active[0].name;
		return bestSwitch;
	} else if (supportMoves.unviable.length) {
		return sample(supportMoves.unviable);
	}

	return sample(decisions);
};

/*
* Switches
*/

var getBestSwitch = exports.getBestSwitch = function (battle, decisions) {
	debug('Switch options | Foe: ' + battle.foe.active[0].name);
	let switches = [];
	for (var i = 0; i < decisions.length; i++) {
		if (decisions[i][0].type !== 'switch') continue;

		if (battle.foe.active[0] && !battle.foe.active[0].fainted && battle.self.pokemon[decisions[i][0].pokeId]) {
			let pk = battle.self.pokemon[decisions[i][0].pokeId];
			if (pk.helpers.hasNoViableMoves === battle.foe.active[0].name) continue;
		}

		switchOption = {
			decision: decisions[i],
			ev: evaluatePokemon(battle, decisions[i][0].pokeId),
		};
		debug('Switch option | Pokemon: ' + switchOption.decision[0].poke + ' | Evaluation: ' + JSON.stringify(switchOption.ev));
		switches.push(switchOption);
	}

	switches.sort((a, b) => 10000 * (a.ev.t - b.ev.t) + (a.ev.d - b.ev.d));
	if (battle.foe.active[0] && battle.foe.active[0].volatiles['substitute']) {
		debug('Returning sub breaker');
		subBreakers = switches.filter(switchOption => (switchOption.ev.d > 25));
		if (subBreakers.length) return subBreakers[0].decision;
	}
	if (switches.length) return switches[0].decision;
	return null;
};

var getBestLead = exports.getBestLead = function (battle, decisions) {
	let sideIdToPokemon = {};
	for (var i = 0; i < decisions.length; i++) {
		let sideId = decisions[i][0].team[0];
		sideIdToPokemon[sideId] = battle.getCalcRequestPokemon(sideId, true);;
	}

	let leads = [];

	// trickroom setters
	for (var i = 0; i < decisions.length; i++) {
		let sideId = decisions[i][0].team[0];
		let moves = battle.request.side.pokemon[sideId].moves;
		for (var j = 0; j < moves.length; j++) {
			if (moves[j] === 'trickroom') {
				leads.push(decisions[i]);
			}
		}
	}

	// hazard setters
	if (leads.length === 0) {
		for (var i = 0; i < decisions.length; i++) {
			let sideId = decisions[i][0].team[0];
			let moves = battle.request.side.pokemon[sideId].moves;
			for (var j = 0; j < moves.length; j++) {
				if (moves[j] in {'spikes':1, 'stealthrock':1, 'stickyweb':1, 'toxicspikes':1}) {
					leads.push(decisions[i]);
					break;
				}
			}
		}
	}

	// weather setters
	if (leads.length === 0) {
		for (var i = 0; i < decisions.length; i++) {
			let sideId = decisions[i][0].team[0];
			let pokeA = sideIdToPokemon[sideId];
			if (hasAbility(pokeA, {'drizzle':1, 'drought':1, 'sandstream':1, 'snowwarning':1}) && !pokeA.hasItem({'blueorb':1, 'redorb':1})) {
				leads.push(decisions[i]);
			}
		}
	}

	// screen setters
	if (leads.length === 0) {
		for (var i = 0; i < decisions.length; i++) {
			let sideId = decisions[i][0].team[0];
			let pokeA = sideIdToPokemon[sideId];
			for (let move of battle.request.side.pokemon[sideId].moves) {
				if (move in {'lightscreen':1, 'reflect':1} || (move === 'auroraveil' && hasAbility(pokeA, 'snowwarning'))) {
					leads.push(decisions[i]);
					break;
				}
			}
		}
	}

	// hazard removers/deflectors
	if (leads.length === 0) {
		for (var i = 0; i < decisions.length; i++) {
			let sideId = decisions[i][0].team[0];
			let pokeA = sideIdToPokemon[sideId];
			if (hasAbility(pokeA, 'magicbounce')) {
				leads.push(decisions[i]);
				continue;
			}
			for (let move of battle.request.side.pokemon[sideId].moves) {
				if (move in {'defog':1, 'magiccoat':1, 'rapidspin':1}) {
					leads.push(decisions[i]);
					break;
				}
			}
		}
	}

	// focus sash, pivots and anti-leads
	if (leads.length === 0) {
		for (var i = 0; i < decisions.length; i++) {
			let sideId = decisions[i][0].team[0];
			let pokeA = sideIdToPokemon[sideId];
			if (pokeA.hasItem('focussash')) {
				leads.push(decisions[i]);
				continue;
			}
			for (let move of battle.request.side.pokemon[sideId].moves) {
				if (move in {'partingshot':1, 'uturn':1, 'taunt':1, 'teleport':1, 'voltswitch':1}) {
					leads.push(decisions[i]);
					break;
				}
			}
		}
	}

	if (leads.length === 0) return sample(decisions);
	return sample(leads);
};

/*
* Swapper
*/

exports.decide = function (battle, decisions) {
	if (battle.gametype !== 'singles') throw new Error('This module only works for singles gametype');
	if (battle.request.forceSwitch) {
		return getBestSwitch(battle, decisions);
	} else if (battle.request.active) {
		return getBestMove(battle, decisions);
	} else {
		return getBestLead(battle, decisions);
	}
};
