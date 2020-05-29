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

	// ability
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

	// item
	if (!target.item || target.item === '&unknown') {
		let itemId = null;
		if (battle.gen >= 2 && !hackmonsBattle) {
			if (pokeB.template.requiredItem) {
				itemId = pokeB.template.requiredItem;
			} else if (pokeB.template.requiredItems) {
				itemId = pokeB.template.requiredItems[0];
			} else if ((pokeB.template.nfe || pokeB.template.evos) && !(pokeB.template.id in {'cubone':1, 'farfetchdgalar':1, 'pikachu':1})) {
				if (battle.gen === 7 && pokeB.template.id === 'eevee') itemId = 'eeviumz';
				else pokeB.item = itemId = 'eviolite';
			} else {
				pokeB.item = null;
				if (pokeB.ability) {
					switch (pokeB.ability.id) {
						case 'cheekpouch':
						case 'harvest':
						case 'ripen':
						case 'unburden':
							itemId = 'sitrusberry';
							break;
						case 'drizzle':
							itemId = 'damprock';
							break;
						case 'drought':
							itemId = 'heatrock';
							break;
						case 'gluttony':
							itemId = 'magoberry';
							break;
						case 'sheerforce':
							itemId = 'lifeorb';
							break;
					}
				}
				switch (pokeB.template.id) {
					case 'pikachu':
						if (battle.id.indexOf('nfe') < 0) itemId = 'lightball';
						break;
					case 'farfetchd':
					case 'farfetchdgalar':
					case 'sirfetchd':
						itemId = (battle.gen >= 8 ? 'leek' : 'stick');
						break;
					case 'cubone':
					case 'marowak':
					case 'marowakalola':
						itemId = 'thickclub';
						break;
					case 'ditto':
						itemId = 'choicescarf';
						break;
					case 'unown':
						itemId = 'choicespecs';
						break;
					case 'kommoo':
						if (battle.gen === 7 && battle.id.indexOf('gen7uu') < 0) itemId = 'kommoniumz';
						break;
				}
			}
		}
		if (itemId) pokeB.item = Data.getItem(itemId, battle.gen, battle.id);
	} else {
		pokeB.item = target.item;
	}

	// evs, ivs and nature
	if (battle.gen >= 3) pokeB.ivs = {hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31};
	if (battle.id.indexOf('hackmonscup') > 0) {
		pokeB.evs = {hp: 124, atk: 124, def: 124, spa: 124, spd: 124, spe: 124};
		if (battle.gen >= 3) pokeB.ivs = {hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15};
	} else if (battle.gen <= 2) {
		pokeB.evs = {hp: 252, atk: 252, def: 252, spa: 252, spd: 252, spe: 252};
		pokeB.dvs = {hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15};
	} else if (battle.id.indexOf('random') > 0) {
		pokeB.evs = {hp: 84, atk: 84, def: 84, spa: 84, spd: 84, spe: 84};
	} else {
		if (hackmonsBattle && battle.gen !== 6) {
			pokeB.evs = {hp: 252, atk: 252, def: 252, spa: 252, spd: 252, spe: 252};
		} else if ((pokeB.template.baseStats.spe >= 70 || pokeB.hasItem('choicescarf')) && !pokeB.hasAbility({'slowstart':1, 'stall':1}) && !pokeB.hasItem({'fullincense':1, 'ironball':1, 'laggingtail':1, 'machobrace':1})) {
			pokeB.evs = {hp: 0, atk: 252, def: 4, spa: 252, spd: 4, spe: 252};
			if (battle.gen >= 3) pokeB.nature = {spe: 1.1};
		} else if (Math.max(pokeB.template.baseStats.atk, pokeB.template.baseStats.spa) >= Math.max(pokeB.template.baseStats.hp, pokeB.template.baseStats.def, pokeB.template.baseStats.spd) || pokeB.hasAbility({'hugepower':1, 'purepower':1})) {
			pokeB.evs = {hp: 252, atk: 252, def: 0, spa: 252, spd: 0, spe: 4};
			if (battle.gen >= 3) pokeB.nature = {atk: 1.1, spa: 1.1};
		} else {
			pokeB.evs = {hp: 252, atk: 0, def: 128, spa: 0, spd: 128, spe: 0};
		}
		for (let move of battle.foe.active[0].moves) {
			if (move.id in {'gyroball':1, 'trickroom':1}) {
				if (pokeB.evs.spe > 0) {
					pokeB.evs.hp = Math.min(252, pokeB.evs.hp + pokeB.evs.spe);
					pokeB.evs.spe = 0;
				}
				if (battle.gen >= 3) {
					pokeB.ivs.spe = 0;
					pokeB.nature.spe = 0.9;
				}
			}
		}
	}

	return pokeB;
}

function hasAbility (poke, ability) {
	return poke.hasAbility(ability);
}

function hasItem (poke, item) {
	return poke.hasItem(item);
}

function isWeatherSupressed (pokeA, pokeB) {
	return (!hasAbility(pokeA, 'neutralizinggas') && !hasAbility(pokeB, 'neutralizinggas') && (hasAbility(pokeA, {'airlock':1, 'cloudnine':1}) || hasAbility(pokeB, {'airlock':1, 'cloudnine':1})));
}

function getConditionsAfterSwitchIn(battle, pokeA, pokeB, conditionsB) {
	let conditionsA = new Conditions({
		side: Object.assign({}, battle.self.side),
		volatiles: {},
		boosts: {atk: 0, def: 0, spa: 0, spd: 0, spe: 0},
	});

	if (hasAbility(pokeA, 'intimidate')) {
		if (hasAbility(pokeB, 'mirrorarmor')) {
			conditionsA.boosts.atk -= 1;
		} else if (!hasAbility(pokeB, {'clearbody':1, 'whitesmoke':1, 'fullmetalbody':1})) {
			if (!conditionsB.boosts.atk) conditionsB.boosts.atk = 0;
			if (hasAbility(pokeB, {'contrary':1, 'defiant':1})) conditionsB.boosts.atk = 1;
			else conditionsB.boosts.atk = -1;
			if (hasAbility(pokeB, 'competitive')) conditionsB.boosts.spa = (conditionsB.boosts.spa ? conditionsB.boosts.spa + 2 : 2);
		}
	}
	if (hasAbility(pokeA, 'download')) {
		if (pokeB.template.baseStats.spd <= pokeB.template.baseStats.def) conditionsA.boosts.spa += 1;
		else conditionsA.boosts.atk += 1;
	}
	if (hasAbility(pokeA, 'intrepidsword')) conditionsA.boosts.atk += 1;
	if (hasAbility(pokeA, 'dauntlessshield')) conditionsA.boosts.def += 1;
	if (hasAbility(pokeA, 'screencleaner')) {
		conditionsA.side['lightscreen'] = false;
		conditionsA.side['reflect'] = false;
		conditionsA.side['auroraveil'] = false;
		conditionsB.side['lightscreen'] = false;
		conditionsB.side['reflect'] = false;
		conditionsB.side['auroraveil'] = false;
	}

	if (hasItem(pokeA, 'electricseed') && battle.conditions['electricterrain']) conditionsA.boosts.def += 1;
	if (hasItem(pokeA, 'grassyseed') && battle.conditions['grassyterrain']) conditionsA.boosts.def += 1;
	if (hasItem(pokeA, 'mistyseed') && battle.conditions['mistyterrain']) conditionsA.boosts.spd += 1;
	if (hasItem(pokeA, 'psychicseed') && battle.conditions['psychicterrain']) conditionsA.boosts.spd += 1;
	if (hasItem(pokeA, 'roomservice') && battle.conditions['trickroom']) conditionsA.boosts.spe -= 1;

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
			if (hasAbility(pokeA, 'contrary')) conditionsA.boosts.spe += 1;
			else conditionsA.boosts.spe -= 1;
			if (hasAbility(pokeA, 'defiant')) conditionsA.boosts.atk += 2;
			if (hasAbility(pokeA, 'competitive')) conditionsA.boosts.spa += 2;
		}
	}

	return {pokeA: pokeA, conditionsA: conditionsA, conditionsB: conditionsB};
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
	if (sideId > 0) {
		conditionsA = new Conditions({
			side: battle.self.side,
			volatiles: battle.self.active[0].volatiles,
			boosts: battle.self.active[0].boosts,
		});
	} else {
		let conditions = getConditionsAfterSwitchIn(battle, pokeA, pokeB, conditionsB);
		pokeA = conditions.pokeA;
		conditionsA = conditions.conditionsA;
		conditionsB = conditions.conditionsB;
	}

	if (sideId > 0 && hasAbility(pokeA, 'imposter') && !conditionsB.volatiles['substitute']) {
		let hpA = pokeA.hp;
		let statusA = pokeA.hp;
		let supressedA = pokeA.supressedAbility;
		let itemA = pokeA.item;
		pokeA = supposeActiveFoe(battle);
		pokeA.hp = hpA;
		pokeA.status = statusA;
		pokeA.supressedAbility = supressedA;
		pokeA.item = itemA;
	} else if (sideId !== 0 && hasAbility(pokeA, 'trace')) {
		pokeA.ability = pokeB.ability;
	}
	let supressedWeather = isWeatherSupressed(pokeA, pokeB);
	let res = {r: 0, rpc: 0, d: 0};

	/* Calculate r - received damage in percentage of current HP */
	let movesB = [];
	let supposedMoveTypes = [];
	let hasHP = false;
	let hasType = {};
	for (let move of battle.foe.active[0].moves.slice()) {
		if (move.disabled || move.pp <= 0) continue;

		let moveData = Data.getMove(move.id, battle.gen, battle.id);
		if (moveData.isMax) {
			supposedMoveTypes.push(moveData.type);
			continue;
		}

		if (moveData.id === 'hiddenpower') {
			if (battle.id.indexOf('hackmonscup') < 0) {
				let randomBattleMovesHaveHP = false;
				const formatsData = Data.getFormatsData(pokeB.template.species, battle.gen, battle.id);
				if (formatsData && formatsData.randomBattleMoves) {
					for (let randomBattleMove of formatsData.randomBattleMoves) {
						if (randomBattleMove.startsWith('hiddenpower')) movesB.push(Data.getMove(randomBattleMove, battle.gen, battle.id));
						randomBattleMovesHaveHP = true;
					}
				}
			}
			if (!randomBattleMovesHaveHP) {
				const hpTypes = ['bug', 'dark', 'dragon', 'electric', 'fighting', 'fire', 'flying', 'ghost', 'grass', 'ground', 'ice', 'poison', 'psychic', 'rock', 'steel', 'water'];
				for (let hpType of hpTypes) {
					movesB.push(Data.getMove('hiddenpower' + hpType, battle.gen, battle.id));
				}
			}
		} else {
			movesB.push(moveData);
		}
	}

	if (pokeB.template.requiredMove && battle.id.indexOf('hackmon') < 0) {
		movesB.push(Data.getMove(pokeB.template.requiredMove, battle.gen, battle.id));
	}

	for (let move of movesB) {
		if (move.category !== 'Status' && (move.basePower <= 1 || move.basePower >= 55) && move.priority === 0) hasType[Calc.getMoveType(pokeB, move, conditionsB, battle.conditions, battle.gen)] = true;
	}

	if (movesB.length < 4 && supposedMoveTypes.length < 4) {
		for (let type of pokeB.getTypes(conditionsB)) {
			supposedMoveTypes.push(type);
		}
	}

	const typeCommonPhysicalMove = {
		'Bug': 'xscissor',
		'Dark': 'knockoff',
		'Dragon': 'dragonclaw',
		'Electric': 'wildcharge',
		'Fairy': 'playrough',
		'Fighting': 'closecombat',
		'Fire': 'flareblitz',
		'Flying': 'bravebird',
		'Ghost': 'shadowclaw',
		'Grass': 'powerwhip',
		'Ground': 'earthquake',
		'Ice': 'iciclecrash',
		'Normal': 'doubleedge',
		'Poison': 'poisonjab',
		'Psychic': 'zenheadbutt',
		'Rock': 'stoneedge',
		'Steel': 'ironhead',
		'Water': 'liquidation',
	};
	const typeCommonSpecialMove = {
		'Bug': 'bugbuzz',
		'Dark': 'darkpulse',
		'Dragon': 'dragonpulse',
		'Electric': 'thunderbolt',
		'Fairy': 'moonblast',
		'Fighting': 'focusblast',
		'Fire': 'fireblast',
		'Flying': 'hurricane',
		'Ghost': 'shadowball',
		'Grass': 'energyball',
		'Ground': 'earthpower',
		'Ice': 'icebeam',
		'Normal': 'hypervoice',
		'Poison': 'sludgewave',
		'Psychic': 'psychic',
		'Rock': 'powergem',
		'Steel': 'flashcannon',
		'Water': 'hydropump',
	};
	for (let type of supposedMoveTypes) {
		if (hasType[type]) continue;
		if (pokeB.template.baseStats.atk >= pokeB.template.baseStats.spa) movesB.push(Data.getMove(typeCommonPhysicalMove[type], battle.gen, battle.id));
		if (pokeB.template.baseStats.atk <= pokeB.template.baseStats.spa) movesB.push(Data.getMove(typeCommonSpecialMove[type], battle.gen, battle.id));
	}

	if (conditionsB.volatiles['dynamax']) {
		const typeMaxMove = {
			'Bug': 'maxflutterby',
			'Dark': 'maxdarkness',
			'Dragon': 'maxwyrmwind',
			'Electric': 'maxlightning',
			'Fairy': 'maxstarfall',
			'Fighting': 'maxknuckle',
			'Fire': 'maxflare',
			'Flying': 'maxairstream',
			'Ghost': 'maxphantasm',
			'Grass': 'maxovergrowth',
			'Ground': 'maxquake',
			'Ice': 'maxhailstorm',
			'Normal': 'maxstrike',
			'Poison': 'maxooze',
			'Psychic': 'maxmindstorm',
			'Rock': 'maxrockfall',
			'Steel': 'maxsteelspike',
			'Water': 'maxgeyser',
		};
		maxMovesB = [];
		for (let move of movesB) {
			maxMovesB.push(Data.getMove(typeMaxMove[move.type], battle.gen, battle.id));
		}
		movesB = maxMovesB;
	}

	let r = 0;
	if (sideId > 0) r = Calc.getHazardsDamage(pokeB, conditionsB, battle.conditions, battle.gen, battle.id);

	let foeCanBurn = false;
	for (let move of movesB) {
		if (conditionsB.volatiles['torment'] && battle.foe.active[0].helpers.lastMove === move.id) continue;
		if (((pokeB.item && pokeB.item.id.startsWith('choice')) || conditionsB.volatiles['encore']) && battle.foe.active[0].helpers.lastMove && battle.foe.active[0].helpers.lastMove !== move.id) continue;
		if (move.id === 'naturepower') {
			if (conditionsB.volatiles['taunt']) continue;
			move = Data.getMove('triattack', battle.gen, battle.id);
			if (battle.conditions['electricterrain']) move = Data.getMove('thunderbolt', battle.gen, battle.id);
			if (battle.conditions['grassyterrain']) move = Data.getMove('energyball', battle.gen, battle.id);
			if (battle.conditions['mistyterrain']) move = Data.getMove('moonblast', battle.gen, battle.id);
			if (battle.conditions['psychicterrain']) move = Data.getMove('psychic', battle.gen, battle.id);
		}
		if (move.id === 'hiddenpower') continue; // ignore typeless HP
		if (move.id in {'hurricane':1, 'thunder':1} && !supressedWeather && toId(battle.conditions.weather) in {'desolateland':1, 'sunnyday':1}) continue;
		if (move.id in {'solarbeam':1, 'solarblade':1} && !supressedWeather && !(toId(battle.conditions.weather) in {'desolateland':1, 'sunnyday':1})) continue;

		let dmg = 0;
		if (move.category !== 'Status') dmg = Calc.calculate(pokeB, pokeA, move, conditionsB, conditionsA, battle.conditions, battle.gen, battle.id).getAvg();
		if (pokeA.hasType('Steel', conditionsA) && (battle.gen < 6 || !pokeA.hasType('Ghost', conditionsA)) && !pokeA.hasItem('shedshell')) dmg *= 2;
		if (dmg > r) r = dmg;

		// 20% burn chance is enough to fear burn
		if (!pokeA.status && !pokeA.hasType('Fire', conditionsA) && !pokeA.hasAbility({'comatose':1, 'guts':1, 'mistysurge':1, 'waterbubble':1, 'waterveil':1}) && (move.category === 'Status' || dmg > 0) && (sideId > 0 || !conditionsA.volatiles['substitute'])) {
			if (
				(move.id in {'blueflare':1, 'inferno':1, 'lavaplume':1, 'sacredfire':1, 'searingshot':1, 'scald':1, 'steameruption':1, 'willowisp':1}) ||
				(hasAbility(pokeB, 'serenegrace') && move.id in {'blazekick':1, 'ember':1, 'fireblast':1, 'firefang':1, 'firepunch':1, 'flamethrower':1, 'flamewheel':1, 'flareblitz':1, 'heatwave':1, 'pyroball':1, 'triattack':1}) ||
				(pokeB.status === 'brn' && move.id === 'psychoshift')
			) {
				foeCanBurn = true;
			}
		}
	}
	res.r = Math.round(Math.min(pokeA.hp, r));
	res.rpc = Math.round((res.r * 100) / pokeA.hp);

	/* Calculate d - dealt damage */
	let movesA = battle.request.side.pokemon[sideId].moves;
	if (sideId !== 0 && hasAbility(pokeA, 'imposter') && !conditionsB.volatiles['substitute']) moves = battle.foe.active[0].moves;
	let d = 0;
	for (let moveId of movesA) {
		let move = Data.getMove(moveId, battle.gen, battle.id);
		if (sideId === 0) {
			if (conditionsA.volatiles['taunt'] && move.category === 'Status') continue;
			if (conditionsA.volatiles['torment'] && battle.self.active[0].helpers.lastMove === move.id) continue;
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
		if (move.category === 'Physical' && foeCanBurn) dmg *= 0.5;

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
	res.d = Math.min(pokeB.hp, d);

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
	let speA = pokeA.getFullSpe(battle, conditionsA, false);
	let speB = pokeB.getFullSpe(battle, conditionsB, false);

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
	let supressedWeather = isWeatherSupressed(pokeA, pokeB);
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
				if (conditionsA.volatiles['substitute'] || ev.r >= 50 || pokeA.hp <= 25 || (pokeA.hp < 50 && speA <= speB) || battle.self.active[0].helpers.lastMove === 'substitute' || pokeA.status in {'psn':1, 'tox':1} || conditionsB.volatiles['taunt']) {
					res.unviable.push(decisions[i]);
				} else if (pokeB.category === 'Status' || ev.r <= 25) {
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
				} else if (pokeB.category === 'Status' || ev.rpc <= 25) {
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
				} else if (ev.rpc <= 25) {
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
			case 'guadswap':
			case 'haze':
			case 'heartswap':
			case 'powerswap':
			case 'spectralthief':
			case 'topsyturvy':
				let clearedStats = ['atk', 'def', 'spa', 'spd', 'spe'];
				if (move.id === 'guardswap') clearedStats = ['def', 'spd'];
				if (move.id === 'powerswap') clearedStats = ['atk', 'spa'];
				let clearedBoosts = {total: 0};
				for (let stat of clearedStats) {
					if (conditionsB.boosts[stat] > 0) {
						clearedBoosts[stat] = 1;
						clearedBoosts.total++;
					}
				}
				let speANoBoost = pokeA.getFullSpe(battle, conditionsB, true);
				let speBNoBoost = pokeB.getFullSpe(battle, conditionsB, true);
				if (clearedBoosts.atk || clearedBoosts.spa || (clearedBoosts.spe && speANoBoost >= speBNoBoost)) {
					res.obligatory.push(decisions[i]);
				} else if (clearedBoosts.total > 0) {
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
			} else if ((move.id === 'maxguard') !== !!conditionsB.volatiles['dynamax']) {
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
			if (ev.r >= 50 || (pokeA.status === 'tox' && battle.turn - battle.self.active[0].helpers.sw >= 3)) {
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
				} else if (pokeA.hp <= 25 && ev.rpc <= 85) {
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
	let speA = pokeA.getFullSpe(battle, conditionsA, false);
	let speB = pokeB.getFullSpe(battle, conditionsB, false);

	let supressedWeather = isWeatherSupressed(pokeA, pokeB);
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
		if (move.id === 'focuspunch' && !(conditionsA.volatiles['substitute'] || pokeB.status in {'frz':1, 'slp':1})) continue;
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
		des.moveData = Object.assign({}, Data.getMove(des.move, battle.gen, battle.id));

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
	let speA = pokeA.getFullSpe(battle, conditionsA, false);
	let speANoBoost = pokeA.getFullSpe(battle, conditionsA, true);
	let speB = pokeB.getFullSpe(battle, conditionsB, false);
	if (battle.conditions['trickroom']) {
		speA = -1 * speA;
		speANoBoost = -1 * speANoBoost;
		speB = -1 * speB;
	}
	let supressedWeather = isWeatherSupressed(pokeA, pokeB);

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
		if (conditionsA.volatiles['curse'] || conditionsA.volatiles['leechseed'] || (!battle.conditions['trickroom'] && speANoBoost > speB && speA < speB && conditionsA.boosts.spe < 0)) switchIfNoOption = true;

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
	if (
		(
			conditionsB.volatiles['substitute'] || 
			(pokeB.template.species === 'Mimikyu' && hasAbility(pokeB, 'disguise')) ||
			(pokeB.template.species === 'Eiscue' && hasAbility(pokeB, 'iceface'))
		) && !hasAbility(pokeA, {'infiltrator':1, 'parentalbond':1})
	) {
		filteredMoves = [];
		for (var i = 0; i < finalDamageMoves.length; i++) {
			var move = finalDamageMoves[i][0].moveData;
			if (move.multihit || move.id === 'beatup' || (hasAbility(pokeB, 'iceface') && move.category !== 'Physical')) filteredMoves.push(moves[i]);
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
		if (move.id === 'maxairstream' || (move.id === 'maxknuckle' && pokeA.template.baseStats.atk >= pokeA.template.baseStats.spa) || (move.id === 'maxooze' && pokeA.template.baseStats.atk <= pokeA.template.baseStats.spa)) filteredMoves.push(finalDamageMoves[i]);
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

	// knock off item
	if (pokeB.item && pokeB.item.id) {
		filteredMoves = [];
		for (var i = 0; i < finalDamageMoves.length; i++) {
			let move = finalDamageMoves[i][0].moveData;
			if (move.id === 'knockoff' || (move.id === 'incinerate' && (pokeB.item.id.endsWith('Berry') || pokeB.item.id.endsWith('Gem')))) filteredMoves.push(finalDamageMoves[i]);
		}
		if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
	}

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
			if (move.drain || move.id === 'gmaxfinale') filteredMoves.push(finalDamageMoves[i]);
			if (move.id === 'maxovergrowth' && pokeA.isGrounded(conditionsA) && !pokeB.isGrounded(conditionsA)) filteredMoves.push(finalDamageMoves[i]);
			if (move.id === 'sappyseed' && !pokeB.hasType('Grass', conditionsB) && !pokeB.hasAbility('magicguard')) filteredMoves.push(finalDamageMoves[i]);
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
	if (hasAbility(pokeA, 'sheerforce') && hasItem(pokeA, 'lifeorb')) {
		filteredMoves = [];
		for (var i = 0; i < finalDamageMoves.length; i++) {
			let move = finalDamageMoves[i][0].moveData;
			if (move.secondary || move.secondaries) filteredMoves.push(finalDamageMoves[i]);
		}
		if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
	}

	// no contact
	if (!hasAbility(pokeA, 'toughclaws')) {
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

	if (!foeHasSwitch && ev.rpc >= 85 && ((speA <= speB && maxPriority <= 0) || (damageMoves.ohko.length === 0 && supportMoves.obligatory.length === 0))) {
		if (bestSwitch) {
			debug('Returning best switch');
			if (bestSwitch[0].type === 'move') return bestSwitch;
			let evBestSwitch = evaluatePokemon(battle, bestSwitch[0].pokeId);
			if (evBestSwitch.rpc < 50 && (evBestSwitch.rpc < ev.r || (evBestSwitch.r === ev.r && evBestSwitch.d > ev.d))) {
				return bestSwitch;
			}
		}
	}

	if (bestSwitch && (ev.rpc <= 25 || (ev.rpc <= 85 && ev.r <= 33.3 && pokeA.hasAbility('regenerator'))) && supportMoves.slowswitching.length) bestSwitch = sample(supportMoves.slowswitching);

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
			if (evBestSwitch.rpc < 50 && (evBestSwitch.r < ev.r || (evBestSwitch.r === ev.r && evBestSwitch.d > ev.d))) {
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

	switches.sort((a, b) => 10000 * (a.ev.r - b.ev.r) + (a.ev.d - b.ev.d));
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
