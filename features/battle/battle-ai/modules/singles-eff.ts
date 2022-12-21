/*
 * Default module for singles
 *
 */

import { toId } from '../../../../tools';
import { debug } from '../../../../console-reports';
import { BattleModule } from "../modules";

import { getMultipleEff } from "./../typechart";
import { Pokemon, Conditions, calculate, getMoveType, getHazardsDamage } from "./../calc";
import { BoostsTable, getAbility, getFormatsData, getItem, getMove, Move, Type } from "./../battle-data";
import { Battle } from "../battle";
import { Decision, MoveDecision, SwitchDecision, TeamDecision } from "../decision";

const ProtectionMoves = ['protect', 'detect', 'kingsshield', 'quickguard', 'spikyshield', 'wideguard', 'banefulbunker', 'obstruct', 'maxguard', 'endure'];

interface Matchup {
	received: number;
	receivedPercentage: number;
	inflicted: number
}

interface SupportViabilityCategoties {
	obligatory: Decision[][];
	viable: Decision[][];
	unviable: Decision[][];
	sleepTalk: Decision[][];
	switching: Decision[][];
	slowswitching: Decision[][];
	canBypassSub: boolean;
};

interface DamageViabilityCategories {
	ohko: Decision[][];
	thko: Decision[][];
	'3hko': Decision[][];
	bad: Decision[][];
	immune: Decision[][];
	defrost: Decision[][];
	subbreak: Decision[][];
	canBypassSub: boolean;
	hasMultihit: boolean;
};

export class SinglesEffective implements BattleModule {
	id = 'singles-eff';

	constructor() { };

	supposeActiveFoe(battle: Battle): Pokemon {
		let target = battle.foe.active[0];
		let pokeId = target.name + '|' + target.species;
		let foePoke = new Pokemon(target.template, {
			gender: target.gender,
			evs: {},
			level: target.level,
			shiny: target.shiny,
			terastallize: target.terastallize,
			helpers: (battle.helpers.foe[pokeId] || {}),
		}, battle);
		foePoke.hp = target.hp;
		foePoke.status = target.status;

		let hackmonsBattle = (battle.id.indexOf('hackmon') >= 0);

		// ability
		if (battle.gen >= 3 && !target.supressedAbility) {
			if (!target.ability || target.ability === '&unknown') {
				if (!hackmonsBattle && foePoke.template.abilities) {
					let abilities = Object.values(foePoke.template.abilities);
					abilities.sort((a, b) => getAbility(b, battle.gen, battle.id).rating - getAbility(a, battle.gen, battle.id).rating);
					foePoke.ability = getAbility(abilities[0], battle.gen, battle.id);
				} else {
					foePoke.ability = null;
				}
			} else {
				foePoke.ability = target.ability;
			}
		}

		// item
		if (!target.item || target.item === '&unknown') {
			let itemId = null;
			if (battle.gen >= 2 && !hackmonsBattle) {
				if (foePoke.template.requiredItem) {
					itemId = foePoke.template.requiredItem;
				} else if (foePoke.template.requiredItems) {
					itemId = foePoke.template.requiredItems[0];
				} else if (foePoke.template.evos && !(foePoke.template.id in { 'cubone': 1, 'farfetchdgalar': 1, 'pikachu': 1 })) {
					if (battle.gen === 7 && foePoke.template.id === 'eevee' && battle.id.indexOf('lc') < 0) itemId = 'eeviumz';
					else foePoke.item = itemId = 'eviolite';
				} else {
					foePoke.item = null;
					switch (foePoke.template.id) {
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
					if (foePoke.ability && !itemId) {
						switch (foePoke.ability.id) {
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
							case 'orichalcumpulse':
								itemId = 'heatrock';
								break;
							case 'hadronengine':
								itemId = 'terrainextender';
								break;
							case 'gluttony':
								itemId = 'magoberry';
								break;
							case 'sheerforce':
								itemId = 'lifeorb';
								break;
						}
					}
				}
			}
			if (itemId) foePoke.item = getItem(itemId, battle.gen, battle.id);
		} else {
			foePoke.item = target.item;
		}

		// evs, ivs and nature
		if (battle.gen >= 3) foePoke.ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
		if (battle.id.indexOf('hackmonscup') > 0) {
			foePoke.evs = { hp: 124, atk: 124, def: 124, spa: 124, spd: 124, spe: 124 };
			if (battle.gen >= 3) foePoke.ivs = { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 };
		} else if (battle.gen <= 2) {
			foePoke.evs = { hp: 252, atk: 252, def: 252, spa: 252, spd: 252, spe: 252 };
			foePoke.dvs = { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 };
		} else if (battle.id.indexOf('random') > 0) {
			foePoke.evs = { hp: 84, atk: 84, def: 84, spa: 84, spd: 84, spe: 84 };
		} else {
			if (hackmonsBattle && battle.gen !== 6) {
				foePoke.evs = { hp: 252, atk: 252, def: 252, spa: 252, spd: 252, spe: 252 };
			} else if ((foePoke.template.baseStats.spe >= 70 || foePoke.hasItem('choicescarf')) && !foePoke.hasAbility({ 'myceliummight': 1, 'slowstart': 1, 'stall': 1 }) && !foePoke.hasItem({ 'fullincense': 1, 'ironball': 1, 'laggingtail': 1, 'machobrace': 1 })) {
				foePoke.evs = { hp: 0, atk: 252, def: 4, spa: 252, spd: 4, spe: 252 };
				foePoke.nature = { spe: 1.1 };
			} else if (Math.max(foePoke.template.baseStats.atk, foePoke.template.baseStats.spa) >= Math.max(foePoke.template.baseStats.hp, foePoke.template.baseStats.def, foePoke.template.baseStats.spd) || foePoke.hasAbility({ 'hugepower': 1, 'purepower': 1 })) {
				foePoke.evs = { hp: 252, atk: 252, def: 0, spa: 252, spd: 0, spe: 4 };
				foePoke.nature = { atk: 1.1, spa: 1.1 };
			} else {
				foePoke.evs = { hp: 252, atk: 0, def: 128, spa: 0, spd: 128, spe: 0 };
			}
			for (let move of battle.foe.active[0].moves) {
				if (move.id in { 'gyroball': 1, 'trickroom': 1 }) {
					foePoke.evs.hp = Math.min(252, foePoke.evs.hp + foePoke.evs.spe);
					foePoke.evs.spe = 0;
					foePoke.ivs.spe = 0;
					foePoke.nature.spe = 0.9;
				}
			}
		}

		return foePoke;
	}

	isWeatherSupressed(pokeA: Pokemon, pokeB: Pokemon): boolean {
		return (!pokeA.hasAbility('neutralizinggas') && !pokeB.hasAbility('neutralizinggas') && (pokeA.hasAbility({ 'airlock': 1, 'cloudnine': 1 }) || pokeB.hasAbility({ 'airlock': 1, 'cloudnine': 1 })));
	}

	getConditionsAfterSwitchIn(battle: Battle, selfPoke: Pokemon, foePoke: Pokemon, foeConditions: Conditions, gconditions: Record<string, any> = {}): {
		selfPoke: Pokemon, selfConditions: Conditions, foeConditions: Conditions, gconditions: Record<string, any>
	} {
		const selfConditions = new Conditions({
			side: { ...battle.self.side },
			pokemon: [...battle.self.pokemon],
			volatiles: {},
			boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
		});
		foeConditions = new Conditions(foeConditions);
		gconditions = { ...gconditions };

		if (!(gconditions.weather in { 'deltastream': 1, 'desolateland': 1, 'primordealsea': 1 })) {
			if (selfPoke.hasAbility('drizzle')) gconditions.weather = 'raindance';
			if (selfPoke.hasAbility({ 'drought': 1, 'orichalcumpulse': 1 })) gconditions.weather = 'sunnyday';
			if (selfPoke.hasAbility('sandstream')) gconditions.weather = 'sandstorm';
			if (selfPoke.hasAbility('snowwarning')) gconditions.weather = battle.gen >= 9 ? 'snow' : 'hail';
		}
		if (gconditions.weather !== 'deltastream') {
			if (selfPoke.hasAbility('desolateland')) gconditions.weather = 'desolateland';
			if (selfPoke.hasAbility('primordealsea')) gconditions.weather = 'primordealsea';
		}
		if (selfPoke.hasAbility('deltastream')) gconditions.weather = 'deltastream';
		if (selfPoke.hasAbility({ 'electricsurge': 1, 'hadronengine': 1 })) gconditions.electricterrain = true;
		if (selfPoke.hasAbility('grassysurge')) gconditions.grassyterrain = true;
		if (selfPoke.hasAbility('mistysurge')) gconditions.mistyterrain = true;
		if (selfPoke.hasAbility('psychicsurge')) gconditions.psychicterrain = true;

		if (selfPoke.hasAbility('intimidate')) {
			if (foePoke.hasAbility('mirrorarmor')) {
				selfConditions.boosts.atk -= 1;
			} else if (!foePoke.hasAbility({ 'clearbody': 1, 'whitesmoke': 1, 'fullmetalbody': 1 }) && !foePoke.hasItem('clearamulet')) {
				if (!foeConditions.boosts.atk) foeConditions.boosts.atk = 0;
				if (foePoke.hasAbility({ 'contrary': 1, 'defiant': 1, 'guarddog': 1 })) foeConditions.boosts.atk += 1;
				else foeConditions.boosts.atk -= 1;
				if (foePoke.hasAbility('competitive')) foeConditions.boosts.spa = (foeConditions.boosts.spa || 0) + 2;
			}
		}
		if (selfPoke.hasAbility('download')) {
			if (foePoke.template.baseStats.spd <= foePoke.template.baseStats.def) selfConditions.boosts.spa += 1;
			else selfConditions.boosts.atk += 1;
		}
		if (selfPoke.hasAbility('intrepidsword')) selfConditions.boosts.atk += 1;
		if (selfPoke.hasAbility('dauntlessshield')) selfConditions.boosts.def += 1;
		if (selfPoke.hasAbility('screencleaner')) {
			selfConditions.side['lightscreen'] = false;
			selfConditions.side['reflect'] = false;
			selfConditions.side['auroraveil'] = false;
			foeConditions.side['lightscreen'] = false;
			foeConditions.side['reflect'] = false;
			foeConditions.side['auroraveil'] = false;
		}

		if (selfPoke.hasItem('electricseed') && gconditions.electricterrain) selfConditions.boosts.def += 1;
		if (selfPoke.hasItem('grassyseed') && gconditions.grassyterrain) selfConditions.boosts.def += 1;
		if (selfPoke.hasItem('mistyseed') && gconditions.mistyterrain) selfConditions.boosts.spd += 1;
		if (selfPoke.hasItem('psychicseed') && gconditions.psychicterrain) selfConditions.boosts.spd += 1;
		if (selfPoke.hasItem('roomservice') && gconditions['trickroom']) selfConditions.boosts.spe -= 1;

		if (selfConditions.side['toxicspikes'] && !selfPoke.status && !selfPoke.hasAbility('immunity') && !selfPoke.hasItem('heavydutyboots') && selfPoke.hasType(['Poison', 'Steel'], selfConditions) && !selfPoke.isGrounded(selfConditions)) {
			selfPoke = Object.assign({}, selfPoke);
			selfPoke.status = (selfConditions.side['toxicspikes'] >= 2 ? 'tox' : 'psn');
		}

		if (selfConditions.side['stickyweb'] && !selfPoke.hasItem('heavydutyboots') && !selfPoke.isGrounded(selfConditions)) {
			if (selfPoke.hasAbility('mirrorarmor')) {
				if (!foePoke.hasAbility({ 'clearbody': 1, 'whitesmoke': 1, 'fullmetalbody': 1 }) && !foePoke.hasItem('clearamulet')) {
					if (!foeConditions.boosts.spe) foeConditions.boosts.spe = 0;
					if (foePoke.hasAbility({ 'contrary': 1 })) foeConditions.boosts.spe = 1;
					else foeConditions.boosts.spe = -1;
					if (foePoke.hasAbility({ 'defiant': 1 })) foeConditions.boosts.atk = (foeConditions.boosts.atk ? foeConditions.boosts.atk + 2 : 2);
					if (foePoke.hasAbility({ 'competitive': 1 })) foeConditions.boosts.spa = (foeConditions.boosts.spa ? foeConditions.boosts.spa + 2 : 2);
				}
			} else if (!selfPoke.hasAbility({ 'clearbody': 1, 'whitesmoke': 1, 'fullmetalbody': 1 }) && !selfPoke.hasItem('clearamulet')) {
				if (selfPoke.hasAbility('contrary')) selfConditions.boosts.spe += 1;
				else selfConditions.boosts.spe -= 1;
				if (selfPoke.hasAbility('defiant')) selfConditions.boosts.atk += 2;
				if (selfPoke.hasAbility('competitive')) selfConditions.boosts.spa += 2;
			}
		}

		return { selfPoke, selfConditions, foeConditions, gconditions };
	}

	evaluatePokemon(battle: Battle, sideId: number): Matchup {
		if (!battle.foe.active[0] || battle.foe.active[0].fainted) return { t: 0, d: 0 };

		let isActive = (sideId === 0 && !!battle.request.active);

		let selfPoke = battle.parseRequestPokemon(sideId, (sideId < battle.self.active.length));
		let foePoke = this.supposeActiveFoe(battle);
		let selfConditions: Conditions;
		let foeConditions = new Conditions({
			side: { ...battle.foe.side },
			pokemon: [...battle.foe.pokemon],
			volatiles: { ...battle.foe.active[0].volatiles },
			boosts: { ...battle.foe.active[0].boosts },
		});
		let gconditions = battle.conditions;

		if (isActive) {
			selfConditions = new Conditions({
				side: battle.self.side,
				pokemon: battle.self.pokemon,
				volatiles: battle.self.active[0].volatiles,
				boosts: battle.self.active[0].boosts,
			});
		} else {
			const conditions = this.getConditionsAfterSwitchIn(battle, selfPoke, foePoke, foeConditions);
			selfPoke = conditions.selfPoke;
			selfConditions = conditions.selfConditions;
			foeConditions = conditions.foeConditions;
			gconditions = conditions.gconditions;
		}

		if (!isActive) {
			if (selfPoke.hasAbility('imposter') && !foeConditions.volatiles['substitute']) {
				const hpA = selfPoke.hp;
				const statusA = selfPoke.status;
				const terastallizeA = selfPoke.terastallize;
				const supressedA = selfPoke.supressedAbility;
				const itemA = selfPoke.item;
				selfPoke = this.supposeActiveFoe(battle);
				selfPoke.hp = hpA;
				selfPoke.status = statusA;
				selfPoke.terastallize = terastallizeA;
				selfPoke.supressedAbility = supressedA;
				selfPoke.item = itemA;
			} else if (selfPoke.hasAbility('trace')) {
				selfPoke.ability = foePoke.ability;
			}
		}
		const supressedWeather = this.isWeatherSupressed(selfPoke, foePoke);
		const res = { received: 0, receivedPercentage: 0, inflicted: 0 };

		/* Calculate r - received damage in percentage of current HP */

		let movesB = [];
		const supposedMoveTypes: Type[] = [];
		for (let move of battle.foe.active[0].moves.slice()) {
			if (move.disabled || move.pp <= 0) continue;

			let moveData = getMove(move.id, battle.gen, battle.id);
			if (moveData.isMax) {
				supposedMoveTypes.push(moveData.type);
				continue;
			}

			if (moveData.id === 'hiddenpower') {
				let randomBattleMovesHaveHP = false;
				if (battle.id.indexOf('hackmonscup') < 0) {
					const formatsData = getFormatsData(foePoke.template.species, battle.gen, battle.id);
					if (formatsData && formatsData.randomBattleMoves) {
						for (let randomBattleMove of formatsData.randomBattleMoves) {
							if (randomBattleMove.startsWith('hiddenpower')) movesB.push(getMove(randomBattleMove, battle.gen, battle.id));
							randomBattleMovesHaveHP = true;
						}
					}
				}
				if (!randomBattleMovesHaveHP) {
					const hpTypes = ['bug', 'dark', 'dragon', 'electric', 'fighting', 'fire', 'flying', 'ghost', 'grass', 'ground', 'ice', 'poison', 'psychic', 'rock', 'steel', 'water'];
					for (let hpType of hpTypes) {
						movesB.push(getMove('hiddenpower' + hpType, battle.gen, battle.id));
					}
				}
			} else {
				movesB.push(moveData);
			}
		}

		if (foePoke.template.requiredMove && battle.id.indexOf('hackmon') < 0) {
			movesB.push(getMove(foePoke.template.requiredMove, battle.gen, battle.id));
		}

		if (battle.id.indexOf('hackmonscup') < 0) {
			const hasType: Partial<Record<Type, boolean>> = {};
			for (let move of movesB) {
				if (move.category !== 'Status' && (move.basePower <= 1 || move.basePower >= 55 || move.multihit) && move.priority === 0) hasType[getMoveType(foePoke, move, foeConditions, gconditions, battle.gen)] = true;
			}

			let supposedMoves = [];
			if (movesB.length < 4 && supposedMoveTypes.length < 4) {
				if (foePoke.ability) {
					switch (foePoke.ability.id) {
						case 'aerilate':
						case 'galvanize':
						case 'pixilate':
						case 'refrigerate':
							if (foePoke.template.baseStats.atk >= foePoke.template.baseStats.spa) supposedMoves.push('doubleedge');
							if (foePoke.template.baseStats.atk <= foePoke.template.baseStats.spa) supposedMoves.push('hypervoice');
							break;
						case 'desolateland':
						case 'drought':
							if (foePoke.template.baseStats.atk <= foePoke.template.baseStats.spa) supposedMoves.push('solarbeam');
							break;
						case 'electricsurge':
							if (foePoke.template.baseStats.atk <= foePoke.template.baseStats.spa) supposedMoves.push('risingvoltage');
							break;
						case 'grassysurge':
							if (foePoke.template.baseStats.atk >= foePoke.template.baseStats.spa) supposedMoves.push('grassyglide');
							break;
						case 'psychicsurge':
							if (foePoke.template.baseStats.atk <= foePoke.template.baseStats.spa) supposedMoves.push('expandingforce');
							break;
						case 'snowwarning':
							if (foePoke.template.baseStats.atk <= foePoke.template.baseStats.spa) supposedMoves.push('blizzard');
							break;
					}
				}
				for (let type of foePoke.getTypes(foeConditions)) {
					supposedMoveTypes.push(type);
				}
			}

			for (let move of supposedMoves) {
				movesB.push(getMove(move, battle.gen, battle.id));
			}
			const typeCommonPhysicalMove: Partial<Record<Type, any>> = {
				'Bug': 'xscissor',
				'Dark': 'knockoff',
				'Dragon': 'dragonclaw',
				'Electric': 'wildcharge',
				'Fairy': 'playrough',
				'Fighting': 'closecombat',
				'Fire': 'flareblitz',
				'Flying': 'acrobatics',
				'Ghost': 'shadowclaw',
				'Grass': 'seedbomb',
				'Ground': 'earthquake',
				'Ice': 'iciclecrash',
				'Normal': 'doubleedge',
				'Poison': 'poisonjab',
				'Psychic': 'zenheadbutt',
				'Rock': 'stoneedge',
				'Steel': 'ironhead',
				'Water': 'liquidation',
			};
			const typeCommonSpecialMove: Partial<Record<Type, any>> = {
				'Bug': 'bugbuzz',
				'Dark': 'darkpulse',
				'Dragon': 'dragonpulse',
				'Electric': 'thunderbolt',
				'Fairy': 'moonblast',
				'Fighting': 'focusblast',
				'Fire': 'fireblast',
				'Flying': 'airslash',
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
				if (foePoke.template.baseStats.atk >= foePoke.template.baseStats.spa) movesB.push(getMove(typeCommonPhysicalMove[type], battle.gen, battle.id));
				if (foePoke.template.baseStats.atk <= foePoke.template.baseStats.spa) movesB.push(getMove(typeCommonSpecialMove[type], battle.gen, battle.id));
			}
		}

		if (foeConditions.volatiles.dynamax) {
			const typeMaxMove: Partial<Record<Type, string>> = {
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
			const maxMovesB = [];
			for (let move of movesB) {
				maxMovesB.push(getMove(typeMaxMove[move.type], battle.gen, battle.id));
			}
			movesB = maxMovesB;
		}

		let r = 0;

		let foeCanBurn = false;
		for (let move of movesB) {
			if (foeConditions.volatiles['torment'] && battle.foe.active[0].helpers.lastMove === move.id) continue;
			if (((foePoke.item && foePoke.item.id.startsWith('choice')) || foeConditions.volatiles['encore']) && battle.foe.active[0].helpers.lastMove && battle.foe.active[0].helpers.lastMove !== move.id) continue;
			if (move.id === 'naturepower') {
				if (foeConditions.volatiles['taunt']) continue;
				move = getMove('triattack', battle.gen, battle.id);
				if (gconditions.electricterrain) move = getMove('thunderbolt', battle.gen, battle.id);
				if (gconditions.grassyterrain) move = getMove('energyball', battle.gen, battle.id);
				if (gconditions.mistyterrain) move = getMove('moonblast', battle.gen, battle.id);
				if (gconditions.psychicterrain) move = getMove('psychic', battle.gen, battle.id);
			}
			if (move.id in { 'hurricane': 1, 'thunder': 1 } && !supressedWeather && toId(gconditions.weather) in { 'desolateland': 1, 'sunnyday': 1 }) continue;
			if (move.id in { 'solarbeam': 1, 'solarblade': 1 } && !supressedWeather && !(toId(gconditions.weather) in { 'desolateland': 1, 'sunnyday': 1 })) continue;

			let dmg = 0;
			if (move.category !== 'Status') {
				dmg = calculate({ poke: foePoke, conditions: foeConditions }, { poke: selfPoke, conditions: selfConditions },
					move, gconditions, battle).getAvg();
			}
			if (dmg > r) r = dmg;

			// 20% burn chance is enough to fear burn
			if (!selfPoke.status && !selfPoke.hasType('Fire', selfConditions) && !selfPoke.hasAbility({ 'comatose': 1, 'guts': 1, 'mistysurge': 1, 'naturalcure': 1, 'purifyingsalt': 1, 'waterbubble': 1, 'waterveil': 1 }) && (move.category === 'Status' || dmg > 0) && (!isActive || !selfConditions.volatiles['substitute'])) {
				if (
					(move.secondary && move.secondary.status === 'brn' && (move.secondary.chance >= 20 || (move.secondary.chance >= 10 && selfPoke.hasAbility('serenegrace')))) ||
					(move.id in { 'firefang': 1, 'triattack': 1 } && selfPoke.hasAbility('serenegrace')) ||
					(move.id === 'burningjealousy' && !isActive && (selfConditions.boosts.atk > 0 || selfConditions.boosts.def > 0 || selfConditions.boosts.spa > 0 || selfConditions.boosts.spd > 0 || selfConditions.boosts.spe > 0)) ||
					(move.id === 'psychoshift' && foePoke.status === 'brn')
				) {
					foeCanBurn = true;
				}
			}
		}

		let physicalA = false;
		if (selfPoke.hasAbility('imposter')) physicalA = true;
		for (let moveId of battle.request.side.pokemon[sideId].moves) {
			if (getMove(moveId, battle.gen, battle.id).category === 'Physical') physicalA = true;
		}
		// double damage to fear burn/magnet pull
		if ((foeCanBurn && physicalA) || (selfPoke.hasType('Steel', selfConditions) && (battle.gen < 6 || !selfPoke.hasType('Ghost', selfConditions)) && !selfPoke.hasItem('shedshell'))) r *= 2;
		if (!isActive) r += getHazardsDamage(foePoke, foeConditions, gconditions, battle.gen, battle.id);

		res.received = Math.min(selfPoke.hp, r);
		res.receivedPercentage = Math.round((res.received * 100) / selfPoke.hp);

		/* Calculate d - dealt damage */

		let movesA = battle.request.side.pokemon[sideId].moves;
		if (!isActive && selfPoke.hasAbility('imposter') && !foeConditions.volatiles['substitute']) {
			movesA = [];
			for (let move of movesB) {
				movesA.push(move.id);
			}
		}
		let d = 0;

		for (let moveId of movesA) {
			let move = getMove(moveId, battle.gen, battle.id);
			if (isActive) {
				if (selfConditions.volatiles['taunt'] && move.category === 'Status') continue;
				if (selfConditions.volatiles['torment'] && battle.self.active[0].helpers.lastMove === move.id) continue;
				if (((selfPoke.item && selfPoke.item.id.startsWith('choice')) || selfConditions.volatiles['encore']) && battle.self.active[0].helpers.lastMove && battle.self.active[0].helpers.lastMove !== move.id) continue;
			}
			if (move.id === 'naturepower') {
				move = getMove('triattack', battle.gen, battle.id);
				if (gconditions.electricterrain) move = getMove('thunderbolt', battle.gen, battle.id);
				if (gconditions.grassyterrain) move = getMove('energyball', battle.gen, battle.id);
				if (gconditions.mistyterrain) move = getMove('moonblast', battle.gen, battle.id);
				if (gconditions.psychicterrain) move = getMove('psychic', battle.gen, battle.id);
			}
			if (move.selfdestruct && selfPoke.hp > 25) continue;
			if (move.id in { 'hurricane': 1, 'thunder': 1 } && !supressedWeather && toId(gconditions.weather) in { 'desolateland': 1, 'sunnyday': 1 }) continue;
			if (move.id in { 'solarbeam': 1, 'solarblade': 1 } && !supressedWeather && !(toId(gconditions.weather) in { 'desolateland': 1, 'sunnyday': 1 })) continue;

			let dmg = 0;
			if (move.category !== 'Status') {
				dmg = calculate({ poke: selfPoke, conditions: selfConditions }, { poke: foePoke, conditions: foeConditions },
					move, gconditions, battle).getAvg();
			}
			if (move.category === 'Physical' && foeCanBurn) dmg *= 0.5;

			if (dmg === 0 && !foePoke.hasAbility({ 'magicbounce': 1, 'magicguard': 1 }) && (!foeConditions.volatiles['substitute'] || selfPoke.hasAbility('infiltrator'))) {
				if (move.id === 'leechseed' && !foePoke.hasType('Grass', foeConditions) && !foePoke.hasAbility('sapsipper')) dmg = 12.5;
				if (!gconditions.mistyterrain || !foePoke.isGrounded(foeConditions)) {
					if (move.status === 'brn' && !foePoke.hasType('Fire', foeConditions) && !foePoke.hasAbility({ 'comatose': 1, 'flashfire': 1, 'purifyingsalt': 1, 'waterbubble': 1, 'waterveil': 1 })) {
						if (battle.gen >= 7) dmg = 6.25;
						else dmg = 12.5;
					}
					if (foePoke.hasType(['Poison', 'Steel'], foeConditions) && !foePoke.hasAbility({ 'comatose': 1, 'immunity': 1, 'pastelveil': 1, 'poisonheal': 1, 'purifyingsalt': 1 })) {
						if (move.status === 'psn') dmg = 12.5;
						if (move.status === 'tox') dmg = 18.75;
					}
				}
			}
			if (dmg > d) d = dmg;
		}
		res.inflicted = Math.min(foePoke.hp, d);

		return res;
	}

	/*
	* Moves
	*/

	foeCanSwitch(battle: Battle): boolean {
		const totalPokes = battle.foe?.teamPv?.length || 6;
		if (battle.foe?.pokemon?.length === totalPokes) {
			for (let i = 0; i < battle.foe.pokemon.length; i++) {
				if (!battle.foe.pokemon[i].fainted && !battle.foe.pokemon[i].active) {
					return true;
				}
			}
			return false;
		}
		return true;
	}

	selfLastPokemon(battle: Battle): boolean {
		return (battle.request?.side?.pokemon || []).filter(poke => !poke.active).every(poke => battle.parseStatus(poke.condition).status === 'fnt');
	}

	selfCanSwitch(decisions: Decision[][], selfPoke: Pokemon, selfConditions: Conditions, foePoke: Pokemon): boolean {
		if (!selfPoke.hasItem('shedshell') && !selfPoke.hasType('Ghost', selfConditions)) {
			if (foePoke.hasAbility('arenatrap') && !selfPoke.isGrounded(selfConditions)) return false;
			if (foePoke.hasAbility('magnetpull') && selfPoke.hasType('Steel', selfConditions)) return false;
			if (foePoke.hasAbility('shadowtag') && !selfPoke.hasAbility('shadowtag')) return false;
		}
		return decisions.flat(1).some(des => des.type === 'switch');
	}

	selfHasStatus(battle: Battle): boolean {
		return battle.request.side.pokemon
			.filter(p => !!p.condition)
			.map(p => battle.parseStatus(p.condition)?.status)
			.some(status => ['slp', 'brn', 'psn', 'tox', 'par', 'frz'].includes(status));
	}

	alreadyOppSleeping(battle: Battle): boolean {
		return battle.foe.pokemon.some(p => p.status === 'slp');
	}

	sideHasHazards(conditions: Conditions): boolean {
		return (this.sideHasDamagingHazards(conditions) || conditions.side['stickyweb']);
	}

	sideHasDamagingHazards(conditions: Conditions): boolean {
		return (conditions.side['gmaxsteelsurge'] || conditions.side['spikes'] || conditions.side['stealthrock'] || conditions.side['toxicspikes']);
	}

	getViableSupportMoves(battle: Battle, decisions: Decision[][]): SupportViabilityCategoties {
		const res: SupportViabilityCategoties = {
			obligatory: [],
			viable: [],
			unviable: [],
			sleepTalk: [],
			switching: [],
			slowswitching: [],
			canBypassSub: false,
		};
		let sideId = 0; // Active, singles
		let selfPoke = battle.parseRequestPokemon(sideId, true);
		let foePoke = this.supposeActiveFoe(battle);
		let selfConditions = new Conditions({
			volatiles: battle.self.active[0].volatiles,
			boosts: battle.self.active[0].boosts,
			side: battle.self.side,
			pokemon: battle.self.pokemon,
		});
		let foeConditions = new Conditions({
			volatiles: battle.foe.active[0].volatiles,
			boosts: battle.foe.active[0].boosts,
			side: battle.foe.side,
			pokemon: battle.foe.pokemon,
		});
		let movesB = battle.foe.active[0].moves;

		const selfSpe = selfPoke.getFullSpe(battle, selfConditions, false);
		const foeSpe = foePoke.getFullSpe(battle, foeConditions, false);

		let hasPhysical = false, hasSpecial = false, hasStatus = false;
		for (let i = 0; i < movesB.length; i++) {
			if (movesB[i].id === 'struggle') continue;
			let move = getMove(movesB[i].id, battle.gen, battle.id);
			if (foeConditions.volatiles['torment'] && battle.foe.active[0].helpers.lastMove && battle.foe.active[0].helpers.lastMove === move.id) continue;
			if (((foePoke.item && foePoke.item.id.startsWith('choice')) || foeConditions.volatiles['encore']) && battle.foe.active[0].helpers.lastMove && battle.foe.active[0].helpers.lastMove !== move.id) continue;
			if ((move.category === 'Physical' && !(move.id in { 'flamecharge': 1, 'flipturn': 1, 'nuzzle': 1, 'rapidspin': 1, 'uturn': 1 })) || move.id === 'photongeyser') hasPhysical = true;
			if (move.category === 'Special' || move.id === 'naturepower') hasSpecial = true;
			if (move.category === 'Status') hasStatus = true;
		}

		let pokeCategory: (typeof foePoke.category | null) = null;
		if (hasPhysical) pokeCategory = 'Physical';
		if (hasSpecial) pokeCategory = 'Special';
		if (hasPhysical && hasSpecial) pokeCategory = 'Mixed';
		if (!pokeCategory && movesB.length >= 4) pokeCategory = 'Status';
		if (!pokeCategory) {
			if (foeConditions.boosts && foeConditions.boosts.atk > 0 && foeConditions.boosts.spa <= 0) pokeCategory = 'Physical';
			if (foeConditions.boosts && foeConditions.boosts.atk <= 0 && foeConditions.boosts.spa < 0) pokeCategory = 'Special';
			if (foeConditions.boosts && foeConditions.boosts.atk > 0 && foePoke.template.species === 'Magearna') pokeCategory = 'Special';
		}
		if (!pokeCategory) {
			if (foePoke.template.baseStats['atk'] > foePoke.template.baseStats['spa']) pokeCategory = 'Physical';
			if (foePoke.template.baseStats['atk'] < foePoke.template.baseStats['spa']) pokeCategory = 'Special';
		}
		foePoke.category = pokeCategory || foePoke.category;

		let supressedWeather = this.isWeatherSupressed(selfPoke, foePoke);
		for (let i = 0; i < decisions.length; i++) {
			if (decisions[i][0].type !== 'move') continue; // not a move
			const des = decisions[i][0] as MoveDecision;
			if (battle.request.active[0].canMegaEvo || battle.request.side.pokemon[0].canMegaEvo) {
				if (selfPoke.hasAbility({ 'speedboost': 1 }) && (!selfConditions.boosts || selfConditions.boosts.spe <= 0)) {
					if (des.transformation === 'mega') continue;
				} else {
					if (des.transformation !== 'mega') continue; // Mega evolve by default
				}
			}

			if (des.transformation === 'dynamax' && !(foeConditions.volatiles.dynamax && selfPoke.hp > 50) && !this.selfLastPokemon(battle)) continue;
			if (typeof des.transformation === 'object' && des.transformation?.terastallize && (des.moveData?.category === 'Status' || !this.selfLastPokemon(battle))) continue;

			let move = des.moveData as Record<string, any>;
			let viableZMove = (
				move.id in { 'bellydrum': 1, 'healblock': 1, 'hypnosis': 1, 'mirrormove': 1, 'raindance': 1, 'sleeppowder': 1, 'splash': 1, 'sunnyday': 1 } ||
				(move.zMoveBoost && move.zMoveBoost.atk && move.zMoveBoost.def && move.zMoveBoost.spa && move.zMoveBoost.spd && move.zMoveBoost.spe)
			);
			if (battle.request.active[0].canZMove || battle.request.side.pokemon[0].canZMove) {
				if (des.transformation !== 'zmove' && viableZMove && selfPoke.item) {
					if (selfPoke.item.zMoveType && selfPoke.item.zMoveType === move.type) continue;
					if (selfPoke.item.zMoveFrom && selfPoke.item.zMoveFrom === move.name) continue;
				}
			}
			if (des.transformation === 'zmove') {
				if (viableZMove) {
					res.obligatory.push(decisions[i]);
				} else {
					res.unviable.push(decisions[i]);
				}
				continue;
			}

			if (move.category !== 'Status' &&
				calculate({ poke: selfPoke, conditions: selfConditions }, { poke: foePoke, conditions: foeConditions }, move, battle.conditions, battle, des.transformation).getMax() <= 0
			) {
				continue;
			}
			const immunityAbilities = {
				'lightningrod': 'Electric', 'motordrive': 'Electric', 'voltabsorb': 'Electric',
				'flashfire': 'Fire', 'wellbakedbody': 'Fire',
				'sapsipper': 'Grass',
				'eartheater': 'Ground', 'levitate': 'Ground',
				'dryskin': 'Water', 'stormdrain': 'Water', 'waterabsorb': 'Water',
			}
			if (!(move.target in { 'all': 1, 'allySide': 1, 'foeSide': 1, 'self': 1 }) && foePoke.hasAbility(immunityAbilities) && !selfPoke.hasAbility({ 'moldbreaker': 1, 'teravolt': 1, 'turboblaze': 1, 'neutralizinggas': 1 }) && immunityAbilities[foePoke.ability.id] === move.type) {
				continue;
			}
			if (move.id === 'thunderwave' && foePoke.hasType((selfPoke.hasAbility('normalize') ? 'Ghost' : 'Ground'), foeConditions)) {
				res.unviable.push(decisions[i]);
				continue;
			}
			if (move.flags?.reflectable && move.id !== 'partingshot' && foePoke.hasAbility('magicbounce')) {
				res.unviable.push(decisions[i]);
				continue;
			}
			if (move.category === 'Status' && move.target === 'normal' && foePoke.hasAbility('goodasgold')) {
				res.unviable.push(decisions[i]);
				continue;
			}
			if (foeConditions.volatiles['substitute'] && !(move.target in { 'self': 1, 'allySide': 1, 'allyTeam': 1, 'foeSide': 1 })) {
				if (!move.flags?.bypasssub) {
					if (move.category === 'Status') res.unviable.push(decisions[i]);
					continue;
				} else if (move.category === 'Status') {
					res.canBypassSub = true;
				}
			}
			if (move.flags?.powder && battle.gen > 5) {
				if (foePoke.hasAbility('overcoat') || foePoke.hasType('Grass', foeConditions)) {
					res.unviable.push(decisions[i]);
					continue;
				}
			}
			if (move.flags?.sound) {
				if (foePoke.hasAbility('soundproof')) {
					res.unviable.push(decisions[i]);
					continue;
				}
			}

			let movePriority = move.priority;
			if (move.flags?.heal && selfPoke.hasAbility('triage')) movePriority += 3;
			if (move.category === 'Status' && selfPoke.hasAbility('prankster')) movePriority++;
			if (move.type === 'Flying' && selfPoke.hasAbility('galewings') && (battle.gen <= 6 || selfPoke.hp >= 100)) movePriority++;

			if (move.target && !(move.target in { 'all': 1, 'allySide': 1, 'foeSide': 1, 'self': 1 })) {
				if (movePriority > 0 && ((battle.conditions['psychicterrain'] && foePoke.isGrounded(foeConditions)) || foePoke.hasAbility({ 'dazzling': 1, 'queenlymajesty': 1 }))) {
					res.unviable.push(decisions[i]);
					continue;
				}
				if (battle.gen >= 7 && move.category === 'Status' && selfPoke.hasAbility('prankster') && foePoke.hasType('Dark', foeConditions)) {
					res.unviable.push(decisions[i]);
					continue;
				}
			}

			if (move.id === 'stockpile') {
				if (selfConditions.volatiles['stockpile3']) {
					res.unviable.push(decisions[i]);
					continue;
				}
			}
			if (!(move.target in { 'self': 1, 'allySide': 1, 'allyTeam': 1, 'foeSide': 1 }) && move.category !== 'Status' && !move.ignoreImmunity) {
				if (calculate({ poke: selfPoke, conditions: selfConditions }, { poke: foePoke, conditions: foeConditions }, move, battle.conditions, battle, des.transformation).getMax() <= 0) {
					res.unviable.push(decisions[i]);
					continue;
				}
			}
			if (move.forceSwitch || (move.id === 'partingshot' && foePoke.hasAbility('magicbounce'))) {
				if (foeConditions.volatiles.dynamax || foePoke.hasAbility({ 'guarddog': 1, 'suctioncups': 1 }) || !this.foeCanSwitch(battle)) {
					res.unviable.push(decisions[i]);
				} else {
					let boostsPHaze = 0;
					for (let stat in foeConditions.boosts) {
						if (foeConditions.boosts[stat] > 0) boostsPHaze++;
					}
					if (boostsPHaze) res.viable.push(decisions[i]);
					else res.unviable.push(decisions[i]);
				}
				continue;
			}
			if (move.selfSwitch) {
				if (['frz', 'slp'].includes(selfPoke.status || '') || selfConditions.volatiles['confusion']) {
					res.unviable.push(decisions[i]);
				} else if (move.flags?.contact && (foePoke.hasAbility({ 'ironbarbs': 1, 'roughskin': 1 }) || foePoke.hasItem('rockyhelmet'))) {
					res.unviable.push(decisions[i]);
				} else if (move.id === 'partingshot' && foePoke.hasAbility({ 'contrary': 1, 'magicbounce': 1 })) {
					res.unviable.push(decisions[i]);
				} else if (move.id === 'shedtail' && ((selfSpe > foeSpe && selfPoke.hp <= 50) || selfPoke.hp <= 75)) {
					res.unviable.push(decisions[i]);
				} else if (move.id === 'batonpass' && Object.keys(selfConditions).some(condition => condition.startsWith('perish'))) {
					res.unviable.push(decisions[i]);
				} else if (move.id === 'batonpass' && Object.values(selfConditions.boosts).some(boost => boost > 0)) {
					res.obligatory.push(decisions[i]);
				} else if (movePriority > 0 || (movePriority === 0 && selfSpe > foeSpe)) {
					res.switching.push(decisions[i]);
				} else {
					res.slowswitching.push(decisions[i]);
				}
				continue;
			}
			const ev = this.evaluatePokemon(battle, 0);
			switch (move.id) {
				case 'ceaselessedge':
				case 'spikes':
					if (this.foeCanSwitch(battle) && foeConditions.side['spikes'] < (battle.gen >= 3 ? 3 : 1)) {
						if (this.sideHasDamagingHazards(foeConditions)) res.viable.push(decisions[i]);
						else res.obligatory.push(decisions[i]);
					} else {
						res.unviable.push(decisions[i]);
					}
					continue;
				case 'toxicspikes':
					if (this.foeCanSwitch(battle) && foeConditions.side['toxicspikes'] < 2) {
						if (this.sideHasDamagingHazards(foeConditions)) res.viable.push(decisions[i]);
						else res.obligatory.push(decisions[i]);
					} else {
						res.unviable.push(decisions[i]);
					}
					continue;
				case 'gmaxstonesurge':
				case 'stealthrock':
				case 'stoneaxe':
					if (this.foeCanSwitch(battle) && !foeConditions.side['stealthrock']) {
						if (this.sideHasDamagingHazards(foeConditions)) res.viable.push(decisions[i]);
						else res.obligatory.push(decisions[i]);
					} else {
						res.unviable.push(decisions[i]);
					}
					continue;
				case 'stickyweb':
					if (this.foeCanSwitch(battle) && !foeConditions.side['stickyweb']) {
						res.obligatory.push(decisions[i]);
					} else {
						res.unviable.push(decisions[i]);
					}
					continue;
				case 'mortalspin':
				case 'rapidspin':
					if (!this.selfLastPokemon(battle) && this.sideHasHazards(selfConditions)) {
						if (battle.self.active[0].helpers.lastMove !== move.id) res.obligatory.push(decisions[i]);
						else res.viable.push(decisions[i]);
					} else if (selfConditions.volatiles['leechseed']) {
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
					if (!this.selfLastPokemon(battle) && this.sideHasHazards(selfConditions)) {
						if (battle.self.active[0].helpers.lastMove !== move.id) res.obligatory.push(decisions[i]);
						else res.viable.push(decisions[i]);
					} else if ((foeConditions.side['lightscreen'] || foeConditions.side['reflect'] || foeConditions.side['auroraveil']) && !selfPoke.hasAbility('infiltrator')) {
						res.viable.push(decisions[i]);
					} else {
						res.unviable.push(decisions[i]);
					}
					continue;
				case 'brickbreak':
				case 'psychicfangs':
				case 'ragingbull':
					if ((foeConditions.side['lightscreen'] || foeConditions.side['reflect'] || foeConditions.side['auroraveil']) && !selfPoke.hasAbility('infiltrator')) {
						res.viable.push(decisions[i]);
					}
					continue;
				case 'tidyup':
					if (!this.selfLastPokemon(battle) && this.sideHasHazards(selfConditions)) {
						res.obligatory.push(decisions[i]);
						continue;
					}
					// decide viability by boosts
					break;
				case 'courtchange':
					if (!this.selfLastPokemon(battle) && this.sideHasHazards(selfConditions) && !this.sideHasHazards(foeConditions)) {
						res.obligatory.push(decisions[i]);
					} else {
						res.unviable.push(decisions[i]);
					}
					continue;
				case 'sleeptalk':
				case 'snore':
					if (selfPoke.status === 'slp') {
						if (typeof battle.self.active[0].helpers.sleepCounter === 'number') {
							if (battle.self.active[0].helpers.sleepCounter < 2) res.sleepTalk.push(decisions[i]);
						}
						res.viable.push(decisions[i]);
					} else {
						res.unviable.push(decisions[i]);
					}
					continue;
				case 'substitute':
					if (selfConditions.volatiles['substitute'] || ev.received >= 50 || selfPoke.hp <= 25 || (selfPoke.hp < 50 && selfSpe <= foeSpe) || battle.self.active[0].helpers.lastMove === 'substitute' || selfPoke.status in { 'psn': 1, 'tox': 1 } || foeConditions.volatiles['taunt']) {
						res.unviable.push(decisions[i]);
					} else if (foePoke.category === 'Status' || ev.received <= 25) {
						res.obligatory.push(decisions[i]);
					} else {
						res.viable.push(decisions[i]);
					}
					continue;
				case 'leechseed':
					if (!foeConditions.volatiles['leechseed'] && !foePoke.hasAbility({ 'liquidooze': 1, 'magicguard': 1 }) && !foePoke.hasType('Grass', foeConditions)) res.viable.push(decisions[i]);
					else res.unviable.push(decisions[i]);
					continue;
				case 'endeavor':
				case 'painsplit':
					if (selfPoke.hp <= foePoke.hp / 2) res.viable.push(decisions[i]);
					else res.unviable.push(decisions[i]);
					continue;
				case 'bellydrum':
					if (selfPoke.hp >= 60 && !(selfConditions.boosts.atk > 1)) res.viable.push(decisions[i]);
					else res.unviable.push(decisions[i]);
					continue;
				case 'clangoroussoul':
				case 'filletaway':
					if (selfPoke.hp >= 60 && !(selfConditions.boosts.atk > 1) && !(selfConditions.boosts.spa > 1) && !(selfConditions.boosts.spe > 1)) res.viable.push(decisions[i]);
					else res.unviable.push(decisions[i]);
				case 'geomancy':
					if (selfPoke.item && selfPoke.item.id === 'powerherb') res.viable.push(decisions[i]);
					else if (!selfPoke.item) res.unviable.push(decisions[i]);
					continue;
				case 'destinybond':
					if (battle.self.active[0].helpers.lastMove === 'destinybond' || foeConditions.volatiles.dynamax || selfPoke.hp > 25 || (selfSpe < foeSpe && !selfPoke.hasAbility('prankster') && !selfPoke.hasItem('custapberry'))) res.unviable.push(decisions[i]);
					else res.viable.push(decisions[i]);
					continue;
				case 'disable':
				case 'encore':
				case 'torment':
					if (foeConditions.volatiles[move.volatileStatus] || foeConditions.volatiles.dynamax || foePoke.hasAbility('aromaveil')) {
						res.unviable.push(decisions[i]);
					} else if (move.id !== 'torment' && !(battle.foe.active[0].helpers.lastMove && battle.turn - battle.foe.active[0].helpers.sw > 1 && battle.foe.active[0].helpers.lastMoveTurn > battle.foe.active[0].helpers.sw)) {
						res.unviable.push(decisions[i]);
					} else if (move.id !== 'encore' && foePoke.item && foePoke.item.id.startsWith('choice')) {
						res.obligatory.push(decisions[i]);
					} else {
						res.viable.push(decisions[i]);
					}
					continue;
				case 'attract':
					if (foeConditions.volatiles['attract'] || foePoke.hasAbility({ 'aromaveil': 1, 'oblivious': 1 }) || !(selfPoke.gender + foePoke.gender in { 'FM': 1, 'MF': 1 })) {
						res.unviable.push(decisions[i]);
					} else {
						res.viable.push(decisions[i]);
					}
					continue;
				case 'taunt':
					if (foeConditions.volatiles[move.volatileStatus] || !hasStatus || foePoke.hasAbility({ 'aromaveil': 1, 'oblivious': 1 })) {
						res.unviable.push(decisions[i]);
					} else if (foePoke.category === 'Status' || ev.receivedPercentage <= 25) {
						res.obligatory.push(decisions[i]);
					} else {
						res.viable.push(decisions[i]);
					}
					continue;
				case 'curse':
					if (selfPoke.hasType('Ghost', selfConditions) && selfPoke.hp >= 60) {
						if (!foeConditions.volatiles[move.volatileStatus]) res.viable.push(decisions[i]);
						else res.unviable.push(decisions[i]);
					} else {
						let curseBoosts = (selfPoke.hasAbility('contrary') ? { 'spe': 1 } : { 'atk': 1, 'def': 1 });
						let alCurBoost = 0;
						for (let stat in curseBoosts) {
							alCurBoost++;
							if (selfConditions.boosts[stat] && selfConditions.boosts[stat] >= 6) alCurBoost--;
						}
						if (alCurBoost > 0) res.viable.push(decisions[i]);
						else res.unviable.push(decisions[i]);
					}
					continue;
				case 'yawn':
					if (!foeConditions.volatiles[move.volatileStatus] && !foePoke.status) {
						res.viable.push(decisions[i]);
					} else {
						res.unviable.push(decisions[i]);
					}
					continue;
				case 'foresight':
				case 'odorsleuth':
					if (!foeConditions.volatiles[move.volatileStatus] && foePoke.hasType('Ghost', foeConditions)) {
						res.viable.push(decisions[i]);
					} else {
						res.unviable.push(decisions[i]);
					}
					continue;
				case 'gastroacid':
					if (!battle.foe.active[0].supressedAbility && !foePoke.hasItem('abilityshield')) {
						res.viable.push(decisions[i]);
					} else {
						res.unviable.push(decisions[i]);
					}
					continue;
				case 'nightmare':
					if (!foeConditions.volatiles[move.volatileStatus] && foePoke.status === 'slp') {
						res.viable.push(decisions[i]);
					} else {
						res.unviable.push(decisions[i]);
					}
					continue;
				case 'healblock':
					if (foeConditions.volatiles[move.volatileStatus] || foePoke.hasAbility('aromaveil')) {
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
					if (selfConditions.volatiles[move.volatileStatus]) {
						res.unviable.push(decisions[i]);
					} else {
						res.viable.push(decisions[i]);
					}
					continue;
				case 'perishsong':
					if (this.selfCanSwitch(decisions, selfPoke, selfConditions, foePoke) && !foeConditions.volatiles['perish3'] && !foeConditions.volatiles['perish2'] && !foeConditions.volatiles['perish1']) {
						res.viable.push(decisions[i]);
					} else {
						res.unviable.push(decisions[i]);
					}
					continue;
				case 'tailwind':
					if (selfConditions.side['tailwind'] || battle.conditions['trickroom'] || (selfSpe > foeSpe && (!foeConditions.boosts.spe || foeConditions.boosts.spe <= 0))) {
						res.unviable.push(decisions[i]);
					} else {
						res.viable.push(decisions[i]);
					}
					continue;
				case 'auroraveil':
				case 'gmaxresonance':
					if (selfConditions.side['auroraveil'] || supressedWeather || !['hail', 'snow'].includes(toId(battle.conditions.weather))) {
						res.unviable.push(decisions[i]);
					} else if (foePoke.category === 'Status') {
						res.viable.push(decisions[i]);
					} else {
						res.obligatory.push(decisions[i]);
					}
					continue;
				case 'reflect':
				case 'baddybad':
					if (selfConditions.side['reflect'] || selfConditions.volatiles['reflect']) { // Gen 1
						res.unviable.push(decisions[i]);
					} else if (foePoke.category in { 'Mixed': 1, 'Physical': 1 }) {
						res.obligatory.push(decisions[i]);
					} else {
						res.viable.push(decisions[i]);
					}
					continue;
				case 'lightscreen':
				case 'glitzyglow':
					if (selfConditions.side['lightscreen']) {
						res.unviable.push(decisions[i]);
					} else if (foePoke.category in { 'Mixed': 1, 'Special': 1 }) {
						res.obligatory.push(decisions[i]);
					} else {
						res.viable.push(decisions[i]);
					}
					continue;
				case 'trickroom':
					if (battle.conditions['trickroom'] || selfSpe >= foeSpe || selfConditions.boosts.spe > 0 || foeConditions.boosts.spe < 0) {
						res.unviable.push(decisions[i]);
					} else {
						res.obligatory.push(decisions[i]);
					}
					continue;
				case 'gravity':
				case 'gmaxgravitas':
					if (battle.conditions['gravity']) {
						res.unviable.push(decisions[i]);
					} else if (!foePoke.isGrounded(foeConditions)) {
						res.obligatory.push(decisions[i]);
					} else {
						res.viable.push(decisions[i]);
					}
					continue;
				case 'trick':
				case 'switcheroo':
					if (!selfPoke.item || !selfPoke.item.id.startsWith('choice') || foePoke.template.requiredItem || foePoke.template.requiredItems || (foePoke.item && (foePoke.item.onTakeItem || foePoke.item.id.startsWith('choice')))) {
						res.unviable.push(decisions[i]);
					} else if (foePoke.category === 'Status') {
						res.obligatory.push(decisions[i]);
					} else if (ev.receivedPercentage <= 25) {
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
					if (this.selfHasStatus(battle)) {
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
					let clearedBoosts: BoostsTable & { total: number } = { total: 0 };
					for (let stat of clearedStats) {
						if (foeConditions.boosts[stat] > 0) {
							clearedBoosts[stat] = 1;
							clearedBoosts.total++;
						}
					}
					const selfSpeNoBoost = selfPoke.getFullSpe(battle, foeConditions, true);
					const foeSpeNoBoost = foePoke.getFullSpe(battle, foeConditions, true);
					if (clearedBoosts.atk || clearedBoosts.spa || (clearedBoosts.spe && selfSpeNoBoost >= foeSpeNoBoost)) {
						res.obligatory.push(decisions[i]);
					} else if (clearedBoosts.total > 0) {
						res.viable.push(decisions[i]);
					} else {
						res.unviable.push(decisions[i]);
					}
					continue;
				case 'relicsong':
					if (selfPoke.template.name === 'Meloetta') res.viable.push(decisions[i]);
					continue;

			}
			if (move.target === 'allySide' && move.sideCondition) {
				if (!selfConditions.side[toId(move.sideCondition)]) {
					res.viable.push(decisions[i]);
				} else {
					res.unviable.push(decisions[i]);
				}
				continue;
			}
			if (ProtectionMoves.includes(move.id)) {
				if (ProtectionMoves.includes(battle.self.active[0].helpers.lastMove)) {
					res.unviable.push(decisions[i]);
				} else if ((move.id === 'maxguard') !== !!foeConditions.volatiles.dynamax) {
					res.unviable.push(decisions[i]);
				} else if (battle.conditions['trickroom'] && selfSpe < foeSpe) {
					res.unviable.push(decisions[i]);
				} else if (selfPoke.hasAbility('speedboost') && !(selfConditions.boosts.spe > 0)) {
					res.obligatory.push(decisions[i]);
				} else if (move.id === 'kingsshield' && selfPoke.template.name === 'Aegislash-Blade' && selfSpe <= foeSpe) {
					res.obligatory.push(decisions[i]);
					// protect on badly poisoned foe, but don't be too predictable to prevent safe switch-in or setup
					// needs to be obligatory to be chosen instead of a switch-out
				} else if (foePoke.status === 'tox' && !(selfPoke.status in { 'brn': 1, 'psn': 1, 'tox': 1 }) && Math.random() >= 0.5) {
					res.obligatory.push(decisions[i]);
				} else {
					res.viable.push(decisions[i]);
				}
				continue;
			}

			let moveStatus = move.status;
			if (!selfPoke.hasAbility('sheerforce') && move.secondary && move.secondary.status && (move.secondary.chance >= 50 || (move.secondary.chance >= 25 && selfPoke.hasAbility('serenegrace'))) && (move.accuracy > 70 || selfPoke.hasAbility('noguard'))) {
				moveStatus = move.secondary.status;
			}
			if (move.id === 'psychoshift' && !(selfPoke.status in { 'frz': 1, 'slp': 1 })) moveStatus = selfPoke.status;
			if (move.id === 'fling' && selfPoke.item && !selfPoke.hasAbility('sheerforce') && !selfPoke.hasAbility('klutz')) {
				switch (selfPoke.item.id) {
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
				if (foePoke.status || foeConditions.volatiles?.yawn || foePoke.hasAbility({ 'comatose': 1, 'purifyingsalt': 1 }) || (foePoke.template.species === 'Minior' || foePoke.hasAbility('shieldsdown'))) {
					res.unviable.push(decisions[i]);
					continue;
				}
				if (battle.conditions['mistyterrain'] && foePoke.isGrounded(foeConditions)) {
					res.unviable.push(decisions[i]);
					continue;
				}
				if (!supressedWeather) {
					if (
						(toId(battle.conditions.weather) in { 'desolateland': 1, 'sunnyday': 1 } && foePoke.hasAbility('leafguard')) ||
						(toId(battle.conditions.weather) in { 'primordealsea': 1, 'raindance': 1 } && foePoke.hasAbility('hydration'))
					) {
						res.unviable.push(decisions[i]);
						continue;
					}
				}
				switch (moveStatus) {
					case 'par':
						if ((selfSpe > foeSpe && !(!foeConditions.boosts.spe || foeConditions.boosts.spe <= 0) && !selfPoke.hasAbility('prankster')) || (battle.gen > 5 && foePoke.hasType('Electric', foeConditions)) || foePoke.hasAbility({ 'guts': 1, 'limber': 1 })) {
							res.unviable.push(decisions[i]);
							continue;
						}
						break;
					case 'brn':
						if (!['Mixed', 'Physical'].includes(foePoke.category) || foePoke.hasType('Fire', foeConditions) || foePoke.hasAbility({ 'flareboost': 1, 'guts': 1, 'waterbubble': 1, 'waterveil': 1 })) {
							res.unviable.push(decisions[i]);
							continue;
						}
						break;
					case 'tox':
						if ((foePoke.hasType(['Poison', 'Steel'], foeConditions) && !selfPoke.hasAbility('corrosion')) || (foePoke.hasAbility({ 'guts': 1, 'immunity': 1, 'magicguard': 1, 'pastelveil': 1, 'toxicboost': 1 }))) {
							res.unviable.push(decisions[i]);
							continue;
						} else if (battle.gen > 2) {
							let obligatory = false;
							for (let j = 0; j < movesB.length; j++) {
								if ((movesB[j].heal && movesB[j].heal[0] / movesB[j].heal[1] >= 0.33) || movesB[j].id in { 'leechseed': 1, 'moonlight': 1, 'morningsun': 1, 'rest': 1, 'sappyseed': 1, 'shoreup': 1, 'strengthsap': 1, 'synthesis': 1, 'wish': 1 }) obligatory = true;
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
						if (foePoke.hasAbility({ 'insomnia': 1, 'sweetveil': 1, 'vitalspirit': 1 }) || (move.id === 'darkvoid' && selfPoke.template.species !== 'Darkrai') || (battle.rules.indexOf('Sleep Clause Mod') >= 0 && this.alreadyOppSleeping(battle))) {
							res.unviable.push(decisions[i]);
							continue;
						}
						if (battle.conditions['electricterrain'] && foePoke.isGrounded(foeConditions)) {
							res.unviable.push(decisions[i]);
							continue;
						}
						break;
				}
				res.viable.push(decisions[i]);
				continue;
			}

			if (move.selfdestruct && move.category === 'Status') {
				if (selfPoke.hp > 25 || this.selfLastPokemon(battle)) {
					res.unviable.push(decisions[i]);
				} else {
					res.viable.push(decisions[i]);
				}
				continue;
			}
			if ((move.heal && move.heal[0] / move.heal[1] >= 0.33) || move.id in { 'moonlight': 1, 'morningsun': 1, 'rest': 1, 'shoreup': 1, 'strengthsap': 1, 'synthesis': 1, 'wish': 1 }) {
				if (ev.received >= 50 || (selfPoke.status === 'tox' && battle.turn - battle.self.active[0].helpers.sw >= 3)) {
					res.unviable.push(decisions[i]);
				} else if (move.id in { 'moonlight': 1, 'morningsun': 1, 'synthesis': 1 } && !supressedWeather && toId(battle.conditions.weather) in { 'primordialsea': 1, 'raindance': 1, 'sandstorm': 1, 'hail': 1, 'snow': 1 }) {
					res.unviable.push(decisions[i]);
				} else if (move.id === 'wish' && battle.self.active[0].helpers.lastMove === 'wish') {
					res.unviable.push(decisions[i]);
				} else if (selfSpe > foeSpe && move.id !== 'wish') {
					if (selfPoke.hp >= 60) {
						res.unviable.push(decisions[i]);
					} else if (selfPoke.hp <= 25) {
						res.obligatory.push(decisions[i]);
					} else {
						res.viable.push(decisions[i]);
					}
				} else {
					if (selfPoke.hp >= 85) {
						res.unviable.push(decisions[i]);
					} else if (selfPoke.hp <= 25 && ev.receivedPercentage <= 85) {
						res.obligatory.push(decisions[i]);
					} else {
						res.viable.push(decisions[i]);
					}
				}
				continue;
			}
			if (move.boosts && move.target === 'self') {
				if (selfPoke.hp < 75 || (move.boosts.spe > 0 && (selfPoke.status === 'par' || battle.conditions['trickroom'])) || (move.id !== 'shellsmash' && selfPoke.hasAbility('contrary'))) {
					res.unviable.push(decisions[i]);
					continue;
				}

				let hasPhysical = false;
				let hasSpecial = false;
				let moves = battle.request.side.pokemon[0].moves;
				for (let j = 0; j < moves.length; j++) {
					let move2 = getMove(moves[j], battle.gen, battle.id);
					if ((move2.category === 'Physical' && !(move2.id in { 'bodypress': 1, 'flamecharge': 1, 'flipturn': 1, 'foulplay': 1, 'nuzzle': 1, 'rapidspin': 1, 'uturn': 1 })) || move2.id === 'photongeyser') hasPhysical = true;
					if (move2.category === 'Special' || move2.id === 'naturepower') hasSpecial = true;
				}
				if ((move.boosts.atk > 0 && !(move.boosts.spa > 0) && !hasPhysical) || (move.boosts.spa > 0 && !(move.boosts.atk > 0) && !hasSpecial)) {
					res.unviable.push(decisions[i]);
					continue;
				}

				let boostCount = 0;
				for (let stat in move.boosts) {
					if (!selfConditions.boosts[stat] || selfConditions.boosts[stat] < 6) { // Max
						boostCount++;
					}
				}
				if (boostCount > 0) {
					res.viable.push(decisions[i]);
				} else {
					res.unviable.push(decisions[i]);
				}
				continue;
			}
			if (move.volatileStatus === 'confusion') {
				if (
					foeConditions.volatiles['confusion'] ||
					(battle.conditions['mistyterrain'] && foePoke.isGrounded(foeConditions)) ||
					(move.id === 'swagger' && ['Mixed', 'Physical'].includes(foePoke.category))
				) {
					res.unviable.push(decisions[i]);
				} else {
					res.viable.push(decisions[i]);
				}
				continue;
			}
			if (move.weather) {
				const battleWeather = toId(battle.conditions.weather || '');
				const moveWeather = move.weather;
				if (['desolateland', 'primordialsea', 'deltastream'].includes(battleWeather) || battleWeather === toId(moveWeather)) {
					res.unviable.push(decisions[i]);
				} else {
					res.viable.push(decisions[i]);
				}
				continue;
			}
			if (move.target === 'all') {
				if (battle.conditions[move.id] || move.id === 'mistyterrain') {
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
		} else if (selfPoke.item && selfPoke.item.id.startsWith('choice')) {
			res.unviable = res.unviable.concat(res.viable);
			res.viable = [];
		}
		return res;
	};

	getViableDamageMoves(battle: Battle, decisions: Decision[][]): DamageViabilityCategories {
		const res: DamageViabilityCategories = {
			ohko: [], // +99% -> replace status moves
			thko: [], // +50% -> no switch, might use status moves if not priority
			'3hko': [], // +33% -> switch if better types, might use status moves
			bad: [], // 1-33 -> switch if better types, replaced by status moves
			immune: [],
			defrost: [],
			subbreak: [],
			canBypassSub: false,
			hasMultihit: false,
		};
		let maxBadDamage = 0;
		let maxDefrostDamage = 0;
		let selfPoke = battle.parseRequestPokemon(0, true);
		let foePoke = this.supposeActiveFoe(battle);
		let selfConditions = new Conditions({
			side: battle.self.side,
			pokemon: battle.self.pokemon,
			volatiles: battle.self.active[0].volatiles,
			boosts: battle.self.active[0].boosts
		});
		let foeConditions = new Conditions({
			side: battle.foe.side,
			pokemon: battle.foe.pokemon,
			volatiles: battle.foe.active[0].volatiles,
			boosts: battle.foe.active[0].boosts
		});
		const selfSpe = selfPoke.getFullSpe(battle, selfConditions, false);
		const foeSpe = foePoke.getFullSpe(battle, foeConditions, false);

		let supressedWeather = this.isWeatherSupressed(selfPoke, foePoke);
		for (let i = 0; i < decisions.length; i++) {
			let des = decisions[i][0] as MoveDecision;
			if (des.type !== 'move') continue; // not a move

			if (battle.request.active[0].canMegaEvo || battle.request.side.pokemon[0].canMegaEvo) {
				if (selfPoke.hasAbility('speedboost') && !(selfConditions.boosts.spe > 0)) {
					if (des.transformation === 'mega') continue; // don't mega immediately with speed boost
				} else {
					if (des.transformation !== 'mega') continue; // Mega evolve by default
				}
			}

			if (des.transformation === 'dynamax' && !(foeConditions.volatiles.dynamax && selfPoke.hp > 50) && !this.selfLastPokemon(battle)) {
				if (!((selfConditions.boosts.atk > 0 || selfConditions.boosts.spa > 0) && selfPoke.hp > 50) && !(selfConditions.boosts.spe > 0)) continue;
			}
			if (typeof des.transformation === 'object' && des.transformation?.terastallize) {
				if (des.moveData.category === 'Status') continue;
				if (
					des.moveData.id !== 'terablast' &&
					!this.selfLastPokemon(battle) &&
					!((selfConditions.boosts.atk > 0 || selfConditions.boosts.spa > 0) && selfPoke.hp > 50) &&
					!(selfConditions.boosts.spe > 0)
				) continue;
			}

			let move = des.moveData as Record<string, any>;
			if (move.id === 'naturepower') {
				move = getMove('triattack', battle.gen, battle.id);
				if (battle.conditions['electricterrain']) move = getMove('thunderbolt', battle.gen, battle.id);
				if (battle.conditions['grassyterrain']) move = getMove('energyball', battle.gen, battle.id);
				if (battle.conditions['mistyterrain']) move = getMove('moonblast', battle.gen, battle.id);
				if (battle.conditions['psychicterrain']) move = getMove('psychic', battle.gen, battle.id);
			}
			if (move.category === 'Status') continue; // Status move

			// bad moves
			if (move.selfdestruct && (selfPoke.hp > 25 || this.selfLastPokemon(battle))) continue;
			if (move.id in { 'bide': 1, 'lastresort': 1 }) continue;
			if (move.id === 'dreameater' && foePoke.status !== 'slp') continue;
			if (move.id in { 'fakeout': 1, 'firstimpression': 1 } && (battle.self.active[0].helpers.sw !== battle.turn || foeConditions.volatiles.dynamax)) continue;
			if (move.id === 'focuspunch' && !(selfConditions.volatiles['substitute'] || foePoke.status in { 'frz': 1, 'slp': 1 })) continue;
			if (move.id in { 'hurricane': 1, 'thunder': 1 } && toId(battle.conditions.weather) in { 'desolateland': 1, 'sunnyday': 1 }) continue;
			if (move.id in { 'endeavor': 1, 'snore': 1 }) continue; // handled as support moves
			if (move.id in { 'solarbeam': 1, 'solarblade': 1 } && !supressedWeather && !(toId(battle.conditions.weather) in { 'desolateland': 1, 'sunnyday': 1 })) continue;
			if ((move.id === 'burnup' && !selfPoke.hasType('Fire', selfConditions)) || (move.id === 'doubleshock' && !selfPoke.hasType('Electric', selfConditions))) continue;

			let dmg = calculate({ poke: selfPoke, conditions: selfConditions }, { poke: foePoke, conditions: foeConditions },
				move, battle.conditions, battle, des.transformation).getAvg();

			let hp = foePoke.hp;
			let foeRecoveryHP = 0;
			if (foeConditions.volatiles.dynamax) {
				hp *= 2;
				if (selfSpe < foeSpe && move.priority <= 0 && foePoke.template.species.startsWith('Alcremie')) foeRecoveryHP = 33.3;
			} else if (!foeConditions.volatiles['healblock'] && !foeConditions.volatiles['taunt']) {
				const movesB = battle.foe.active[0].moves;
				for (let j = 0; j < movesB.length; j++) {
					if (movesB[j].heal) foeRecoveryHP = Math.max(foeRecoveryHP, (movesB[j].heal[0] / movesB[j].heal[1]) * 100);
					if (movesB[j].id === 'purify' && selfPoke.status) foeRecoveryHP = Math.max(foeRecoveryHP, 50);
					if (['moonlight', 'morningsun', 'synthesis'].includes(move.id)) {
						if (supressedWeather || !battle.conditions.weather) {
							foeRecoveryHP = Math.max(foeRecoveryHP, 50);
						} else if (toId(battle.conditions.weather) in { 'desolateland': 1, 'sunnyday': 1 }) {
							foeRecoveryHP = Math.max(foeRecoveryHP, 66.6);
						} else {
							foeRecoveryHP = Math.max(foeRecoveryHP, 25);
						}
					}
					if (movesB[j].id === 'shoreup') {
						if (!supressedWeather && toId(battle.conditions.weather) === 'sandstorm') foeRecoveryHP = Math.max(foeRecoveryHP, 66.6);
						else foeRecoveryHP = Math.max(foeRecoveryHP, 50);
					}
					if (movesB[j].id === 'rest' && !((battle.conditions['electricterrain'] || battle.conditions['mistyterrain']) && foePoke.isGrounded(foeConditions))) foeRecoveryHP = Math.max(foeRecoveryHP, 100);
					if (movesB[j].id === 'strengthsap') foeRecoveryHP = Math.max(foeRecoveryHP, (100 * selfPoke.getStat('atk')) / foePoke.getStat('hp'));
				}
			}
			if (
				(((selfSpe <= foeSpe && move.priority === 0) || move.priority < 0) && !['frz', 'slp'].includes(foePoke.status || '')) ||
				foeConditions.volatiles.dynamax
			) {
				hp = Math.min(100, hp + foeRecoveryHP);
			}

			if (
				move.id === 'suckerpunch' &&
				!foeConditions.volatiles['taunt'] &&
				(foeRecoveryHP > 0 || battle.self.active[0].helpers.lastMove === 'suckerpunch')
			) continue;

			let pc = (dmg * 100) / hp;
			if (move.id === 'guardianofalola') {
				if (hp < 87.5) continue;
				if (!foePoke.hasAbility('wonderguard')) pc = 74.9;
			}
			if (['naturesmadness', 'ruination', 'superfang'].includes(move.id)) {
				if (hp < 87.5) continue;
				if (!foePoke.hasAbility('wonderguard') && !battle.conditions.inversebattle && getMultipleEff(move.type, foePoke.getTypes(foeConditions), battle.gen, false, false, battle.id) > 0) pc = 49.9;
			}

			if (pc <= 0) {
				debug('Immune to move ' + move.namel);
				res.immune.push(decisions[i]);
				continue;
			}

			// calculate residual
			let residual: number | number[] = 0;

			// status
			if (!foePoke.hasAbility('magicguard')) {
				let afterMoveStatus = foePoke.status;
				if (afterMoveStatus) {
					if (afterMoveStatus === 'brn' && move.id === 'sparklingaria') afterMoveStatus = null;
					if (afterMoveStatus === 'slp' && move.id in { 'wakeupslap': 1, 'maxlightning': 1 }) afterMoveStatus = null;
				} else if ((!foeConditions.volatiles['substitute'] || selfPoke.hasAbility('infiltrator')) && !(battle.conditions['mistyterrain'] && foePoke.isGrounded(foeConditions))) {
					if (!selfPoke.hasAbility('sheerforce') && move.secondary && move.secondary.status && (move.secondary.chance >= 50 || (move.secondary.chance >= 25 && selfPoke.hasAbility('serenegrace')))) {
						afterMoveStatus = move.secondary.status;
					}
					if (move.id === 'gmaxstunshock') afterMoveStatus = 'psn';
					if (move.id === 'psychoshift' && !(selfPoke.status in { 'frz': 1, 'slp': 1 })) afterMoveStatus = selfPoke.status;
					if (move.id === 'fling' && selfPoke.item && !selfPoke.hasAbility('sheerforce') && !selfPoke.hasAbility('klutz')) {
						switch (selfPoke.item.id) {
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
				if (afterMoveStatus) {
					switch (afterMoveStatus) {
						case 'brn':
							let burnResidual = (battle.gen >= 7 ? 6.25 : 12.5);
							if (foePoke.hasAbility('heatproof')) burnResidual = burnResidual / 2.0;
							residual -= burnResidual;
							break;
						case 'tox':
							if (foePoke.hasAbility('poisonheal')) residual += 12.5;
							else residual -= 6.25 * (battle.turn - battle.self.active[0].helpers.sw + 1);
							break;
						case 'psn':
							if (foePoke.hasAbility('poisonheal')) residual += 12.5;
							else residual -= 12.5;
							break;
						case 'slp':
							if (selfPoke.hasAbility('baddreams')) residual -= 12.5;
							break;
					}
				}
				if (foeConditions.volatiles['curse']) residual -= 25;
				if (!foePoke.hasType('Grass', foeConditions) && (move.id === 'sappyseed' || foeConditions.volatiles['leechseed'])) residual -= 12.5;
				if (move.volatileStatus === 'partiallytrapped' || ['gmaxcentiferno', 'gmaxsandblast'].includes(move.id)) residual -= (selfPoke.hasItem('bindingband') ? 100 / 6.0 : 12.5);
				if (foeConditions.volatiles['saltcure']) residual -= (foePoke.hasType('Steel', foeConditions) || foePoke.hasType('Water', foeConditions) ? 25 : 12.5);
			}

			if (move.id !== 'rapidspin' && selfConditions.volatiles['leechseed']) {
				let leechSeedHeal = 12.5 * (selfPoke.getStat('hp') / foePoke.getStat('hp'));
				if (!selfPoke.hasAbility('liquidooze')) {
					residual += leechSeedHeal;
				} else if (!foePoke.hasAbility('magicguard')) {
					residual -= leechSeedHeal;
				}
			}

			// item
			if (foePoke.item && (move.id !== 'knockoff' || foePoke.hasAbility('stickyhold')) && !foePoke.hasAbility('klutz')) {
				switch (foePoke.item.id) {
					case 'leftovers':
						if (!foeConditions.volatiles['healblock']) residual += 6.25;
						break;
					case 'blacksludge':
						if (foePoke.hasType('Poison', foeConditions)) {
							if (!foeConditions.volatiles['healblock']) residual += 6.25;
						} else if (!foePoke.hasAbility('magicguard')) {
							residual -= 12.5;
						}
						break;
					case 'lifeorb':
						if (!foePoke.hasAbility({ 'magicguard': 1, 'sheerforce': 1 })) residual -= 10;
						break;
					case 'stickybarb':
						if ((!selfPoke.item || !move?.flags?.contact) && !foePoke.hasAbility('magicguard')) residual -= 12.5;
						break;
				}
			}

			// weather/terrain
			if (!foePoke.hasAbility({ 'magicguard': 1, 'overcoat': 1 })) {
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
				if (afterMoveWeather) {
					switch (afterMoveWeather) {
						case 'desolateland':
						case 'sunnyday':
							if (foePoke.hasAbility({ 'dryskin': 1, 'solarpower': 1 })) residual -= 12.5;
							break;
						case 'primordealsea':
						case 'raindance':
							if (!foeConditions.volatiles['healblock']) {
								if (foePoke.hasAbility('dryskin')) residual += 12.5;
								if (foePoke.hasAbility('raindish')) residual += 6.25;
							}
							break;
						case 'sandstorm':
							if (!foePoke.hasType(['Ground', 'Rock', 'Steel'], foeConditions) && !foePoke.hasAbility({ 'sandforce': 1, 'sandrush': 1, 'sandveil': 1 })) residual -= 6.25;
							break;
						case 'hail':
							if (foePoke.hasAbility('icebody')) {
								if (!foeConditions.volatiles['healblock']) residual += 6.25;
							} else if (!foePoke.hasType('Ice', foeConditions) && !foePoke.hasAbility('forecast')) {
								residual -= 6.25;
							}
							break;
						case 'snow':
							if (foePoke.hasAbility('icebody') && !foeConditions.volatiles['healblock']) residual += 6.25;
							break;
					}
				}
			}
			if (
				!['genesissupernova', 'splinteredstormshards', 'maxlightning', 'maxmindstorm', 'maxstarfall', 'gmaxwindrage', 'steelroller', 'icespinner'].includes(move.id) &&
				(move.id === 'maxovergrowth' || battle.conditions['grassyterrain']) &&
				!foeConditions.volatiles['healblock'] && foePoke.isGrounded(foeConditions)
			) residual += 6.25;

			// gmax effects
			if (['gmaxcannonade', 'gmaxvinelash', 'gmaxvolcalith', 'gmaxwildfire'].includes(move.id) && !foePoke.hasAbility('magicguard') && !foePoke.hasType(move.type, foeConditions)) residual -= 100 / 6.0;

			residual = [residual, residual];
			if (foePoke.status === 'tox' && !foePoke.hasAbility({ 'magicguard': 1, 'poisonheal': 1 })) residual[1] -= 6.25;
			for (let j = 0; j < residual.length; j++) {
				residual[j] = residual[j] * 100 / hp;
			}

			debug('Move: ' + move.name + ' | Damage: ' + dmg + ' | Percent: ' + pc + ' | Residual: ' + residual);

			let hazard = getHazardsDamage(foePoke, foeConditions, battle.conditions, battle.gen, battle.id);
			if (foePoke.hasAbility({ 'regenerator': 1 })) hazard -= 33.3;
			hazard = hazard * 100 / hp;
			if (hazard < 0) hazard = 0;
			if (hazard > 100) hazard = 100;

			if (move.id in { 'fakeout': 1, 'firstimpression': 1 }) {
				if (pc >= 100 - hazard + Math.min(0, residual[0])) {
					res.ohko.push(decisions[i]);
				} else if (getMultipleEff(move.type, foePoke.getTypes(foeConditions), battle.gen, false, !!battle.conditions.inversebattle, battle.id) >= 1) {
					res.thko.push(decisions[i]);
				} else {
					res.bad.push(decisions[i]);
				}
				continue;
			}

			let bypasssub = (move?.flags?.bypasssub) || selfPoke.hasAbility('infiltrator');
			let sub = (foeConditions.volatiles['substitute'] && !bypasssub ? 25 * 100 / hp : 0);
			if (sub === 0 && !selfPoke.hasAbility({ 'moldbreaker': 1, 'teravolt': 1, 'turboblaze': 1, 'neutralizinggas': 1 })) {
				if (foePoke.template.species === 'Mimikyu' && foePoke.hasAbility('disguise')) sub = 0.1;
				if (foePoke.template.species === 'Eiscue' && foePoke.hasAbility('iceface') && move.category === 'Physical') sub = 0.1;
			}

			let multihit = (move.multihit || move.id === 'beatup' || (selfPoke.hasAbility('parentalbond') && !move.selfdestruct && !move.multihit && !move?.flags?.charge && !move.isZ && !move.isMax));
			let ohkoPrevent = (!multihit && (sub > 0 || (hp >= 100 && (foePoke.hasAbility('sturdy') || foePoke.hasItem('focussash')))));

			if (move.id in { 'nuzzle': 1, 'rapidspin': 1 } && (sub > 0 || pc < 100)) continue;
			if (typeof des.transformation === 'string' && ['zmove', 'dynamax'].includes(des.transformation) && sub > 0) continue;
			if ((battle.request.active[0].canZMove || battle.request.side.pokemon[0].canZMove) && sub === 0 && pc < 100) {
				if (des.transformation !== 'zmove' && selfPoke.item) {
					if (selfPoke.item.zMoveType && selfPoke.item.zMoveType === move.type) continue;
					if (selfPoke.item.zMoveFrom && selfPoke.item.zMoveFrom === move.name) continue;
				}
			}

			let foeCanProtect = false;
			if (!(move.id in { 'gmaxoneblow': 1, 'gmaxrapidflow': 1 }) && !ProtectionMoves.includes(battle.foe.active[0].helpers.lastMove) && !['frz', 'slp'].includes(foePoke.status || '')) {
				let movesB = battle.foe.active[0].moves;
				if (foeConditions.volatiles.dynamax) {
					for (let j = 0; j < movesB.length; j++) {
						if (movesB[j].category === 'Status') foeCanProtect = true;
					}
				} else if (move?.flags?.protect && (!move.flags['contact'] || !selfPoke.hasAbility('unseenfist'))) {
					for (let j = 0; j < movesB.length; j++) {
						if (ProtectionMoves.includes(movesB[j].id)) foeCanProtect = true;
					}
				}
			}

			if (pc >= 99 && !ohkoPrevent) {
				res.ohko.push(decisions[i]);
			} else if (pc <= Math.max(0, residual[0])) {
				res.immune.push(decisions[i]);
			} else if (!move?.flags?.recharge) {
				if (2 * pc >= 100 + sub + residual[0] + (foeCanProtect ? Math.max(0, residual[1]) : 0)) {
					res.thko.push(decisions[i]);
				} else if (3 * pc >= 100 + sub + residual[0] + residual[1]) {
					res['3hko'].push(decisions[i]);
				} else if (pc > maxBadDamage) {
					maxBadDamage = pc;
					res.bad = [decisions[i]];
				}
			}

			if (bypasssub) {
				res.canBypassSub = true;
			} else {
				if (multihit) res.hasMultihit = true;
				if (dmg > 25) res.subbreak.push(decisions[i]);
			}
			if (move?.flags?.defrost && pc > maxDefrostDamage) {
				maxDefrostDamage = pc;
				res.defrost = [decisions[i]];
			}
		}
		return res;
	};

	getMovesData(battle: Battle, decisions: Decision[][], selfPoke: Pokemon): MoveDecision[][] {
		const moveDecisions: MoveDecision[][] = [];

		for (let i = 0; i < decisions.length; i++) {
			if (decisions[i][0].type !== 'move') continue;
			let des = decisions[i][0] as MoveDecision;

			let baseMoveName = battle.request.side.pokemon[0].moves[des.moveId];
			des.moveData = { ...getMove(des.move, battle.gen, battle.id) };

			if (des.moveData.category !== 'Status') {
				if (des.transformation === 'zmove') {
					let baseMove = getMove(baseMoveName, battle.gen, battle.id);
					if (selfPoke.item && selfPoke.item.zMoveType && selfPoke.item.zMoveType === baseMove.type) {
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
					const baseMove = getMove(baseMoveName, battle.gen, battle.id);
					des.moveData = { ...des.moveData, category: baseMove.category };
					if (baseMove.gmaxPower) {
						des.moveData.basePower = baseMove.gmaxPower;
					} else if (baseMove.isMax) {
						des.moveData.basePower = 1;
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

			moveDecisions.push([des]);
		}

		return moveDecisions;
	}

	filterRedundantMaxMoves(decisions: MoveDecision[][]): Decision[][] {
		const maxMoveMaxPower = {};
		for (let des of decisions) {
			if (des[0].moveData && des[0].moveData.isMax && des[0].moveData.category !== 'Status') {
				let typeAndCategory = des[0].moveData.type + '|' + des[0].moveData.category;
				if (!maxMoveMaxPower[typeAndCategory]) maxMoveMaxPower[typeAndCategory] = des[0].moveData.basePower;
				else maxMoveMaxPower[typeAndCategory] = Math.max(maxMoveMaxPower[typeAndCategory], des[0].moveData.basePower);
			}
		}
		decisions = decisions.filter(des => (!(des[0].moveData && des[0].moveData.isMax && des[0].moveData.category !== 'Status') || des[0].moveData.basePower >= maxMoveMaxPower[des[0].moveData.type + '|' + des[0].moveData.category]));

		let maxGuardMaxPP = 0;
		for (let des of decisions) {
			if (des[0].move === 'maxguard') maxGuardMaxPP = Math.max(maxGuardMaxPP, des[0].movePP);
		}
		decisions = decisions.filter(des => (des[0].move !== 'maxguard' || des[0].movePP >= maxGuardMaxPP));

		return decisions;
	}

	toLogString(poke: Pokemon): string {
		const { template, stats, evs, ivs, dvs, ...toLog } = poke;
		toLog.ability = poke.ability?.id;
		toLog.item = poke.item?.id;
		return JSON.stringify(toLog);
	}

	logDecisions(selfPoke: Pokemon, foePoke: Pokemon, bestSw: SwitchDecision[] | null, damageMoves: DamageViabilityCategories, supportMoves: SupportViabilityCategoties): void {
		debug(this.toLogString(selfPoke) + '\nVS\n' + this.toLogString(foePoke));

		debug('Best switch: ' + (bestSw?.[0]?.poke || 'none'));

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

	sample<T>(arr: readonly T[]): T {
		return arr[Math.floor(Math.random() * arr.length)];
	}

	getBestMove(battle: Battle, decisions: Decision[][]): Decision[] {
		let selfPoke = battle.parseRequestPokemon(0, true);
		let foePoke = this.supposeActiveFoe(battle);
		decisions = this.filterRedundantMaxMoves(this.getMovesData(battle, decisions, selfPoke));

		let bestSwitch: SwitchDecision[] | MoveDecision[] | null = this.getBestSwitch(battle, decisions);
		let damageMoves = this.getViableDamageMoves(battle, decisions);
		let supportMoves = this.getViableSupportMoves(battle, decisions);
		this.logDecisions(selfPoke, foePoke, bestSwitch, damageMoves, supportMoves);

		let ev = this.evaluatePokemon(battle, 0);

		let selfConditions = new Conditions({
			side: battle.self.side,
			pokemon: battle.self.pokemon,
			volatiles: battle.self.active[0].volatiles,
			boosts: battle.self.active[0].boosts
		});
		let foeConditions = new Conditions({
			side: battle.foe.side,
			pokemon: battle.foe.pokemon,
			volatiles: battle.foe.active[0].volatiles,
			boosts: battle.foe.active[0].boosts
		});
		let movesB = battle.foe.active[0].moves;

		let selfSpe = selfPoke.getFullSpe(battle, selfConditions, false);
		let selfSpeNoBoost = selfPoke.getFullSpe(battle, selfConditions, true);
		let foeSpe = foePoke.getFullSpe(battle, foeConditions, false);
		if (battle.conditions['trickroom']) {
			selfSpe = -1 * selfSpe;
			selfSpeNoBoost = -1 * selfSpeNoBoost;
			foeSpe = -1 * foeSpe;
		}
		let supressedWeather = this.isWeatherSupressed(selfPoke, foePoke);

		/* Special switch cases */

		let switchIfNoOption = false;
		if (bestSwitch) {
			// No switch if you die
			if (getHazardsDamage(selfPoke, selfConditions, battle.conditions, battle.gen, battle.id) > selfPoke.hp + (selfPoke.hasAbility('regenerator') ? 33.3 : 0)) bestSwitch = null;
			// No switch behind sub
			if (selfConditions.volatiles['substitute'] && (damageMoves.ohko.length || damageMoves.thko.length || damageMoves['3hko'].length)) bestSwitch = null;
			// No switch when dynamaxed
			if (selfConditions.volatiles.dynamax) bestSwitch = null;

			if (foeConditions.volatiles['substitute'] && !damageMoves.subbreak.length && !damageMoves.hasMultihit && !damageMoves.canBypassSub && !supportMoves.canBypassSub) switchIfNoOption = true;
			if (selfPoke.status === 'tox' && battle.turn - battle.self.active[0].helpers.sw >= 3 && !selfPoke.hasAbility({ 'magicguard': 1, 'poisonheal': 1 })) switchIfNoOption = true;
			if (selfPoke.status && selfPoke.hasAbility('naturalcure')) switchIfNoOption = true;
			if (selfConditions.volatiles['curse'] || selfConditions.volatiles['leechseed'] || (!battle.conditions['trickroom'] && selfSpeNoBoost > foeSpe && selfSpe < foeSpe && selfConditions.boosts.spe < 0)) switchIfNoOption = true;

			let movesA = battle.request.side.pokemon[0].moves;
			for (let moveId of movesA) {
				if (moveId === 'photongeyser') continue;
				let move = getMove(moveId, battle.gen, battle.id);
				if ((move.category === 'Physical' && selfConditions.boosts.atk < 0) || (move.category === 'Special' && selfConditions.boosts.spa < 0)) {
					switchIfNoOption = true;
				}
			}

			if (bestSwitch) {
				if (supportMoves.switching.length) bestSwitch = this.sample(supportMoves.switching);
				if (selfConditions.volatiles?.perish1 || selfPoke.hasAbility('zerotohero')) return bestSwitch;
			}
		}

		let damageMoveCategories = [supportMoves.sleepTalk];
		if (selfPoke.status === 'frz') damageMoveCategories.push(damageMoves.defrost);
		damageMoveCategories = damageMoveCategories.concat([damageMoves.ohko, damageMoves.thko, damageMoves['3hko'], damageMoves.bad]);

		let finalDamageMoves = [];
		for (let category of damageMoveCategories) {
			if (category.length) {
				finalDamageMoves = category.slice();
				break;
			}
		}

		let filteredMoves = [];

		// multihit or bypasssub if sub
		if (foeConditions.volatiles['substitute'] && !selfPoke.hasAbility({ 'infiltrator': 1, 'parentalbond': 1 })) {
			filteredMoves = [];
			for (let i = 0; i < finalDamageMoves.length; i++) {
				const move = finalDamageMoves[i][0].moveData;
				if (move.multihit || move.id === 'beatup') filteredMoves.push(finalDamageMoves[i]);
			}
			if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;

			filteredMoves = [];
			for (let i = 0; i < finalDamageMoves.length; i++) {
				const move = finalDamageMoves[i][0].moveData;
				if (move.flags?.bypasssub) filteredMoves.push(finalDamageMoves[i]);
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
				foeConditions.volatiles['substitute'] ||
				(foePoke.template.species === 'Mimikyu' && foePoke.hasAbility('disguise')) ||
				(foePoke.template.species === 'Eiscue' && foePoke.hasAbility('iceface'))
			) && !selfPoke.hasAbility({ 'infiltrator': 1, 'parentalbond': 1 })
		) {
			filteredMoves = [];
			for (let i = 0; i < finalDamageMoves.length; i++) {
				const move = finalDamageMoves[i][0].moveData;
				if (move.multihit || move.id === 'beatup' || (foePoke.hasAbility('iceface') && move.category !== 'Physical')) filteredMoves.push(finalDamageMoves[i]);
			}
			if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
		}

		// max priority
		let maxPriority = -10;
		filteredMoves = [];
		for (let i = 0; i < finalDamageMoves.length; i++) {
			const move = finalDamageMoves[i][0].moveData;
			let priority = move.priority;
			if (move.drain && selfPoke.hasAbility('triage')) priority += 3;
			if (move.id === 'grassyglide' && battle.conditions['grassyterrain'] && selfPoke.isGrounded(selfConditions)) priority++;
			if (move.id === 'naturepower' && selfPoke.hasAbility('prankster')) priority++;
			if (move.type === 'Flying' && (battle.gen <= 6 || selfPoke.hp >= 100) && selfPoke.hasAbility('galewings')) priority++;
			if (priority === maxPriority) {
				filteredMoves.push(finalDamageMoves[i]);
			} else if (priority > maxPriority) {
				maxPriority = move.priority;
				filteredMoves = [finalDamageMoves[i]];
			}
		}
		if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
		if (maxPriority < 1 && damageMoves.ohko.length === 0 && supportMoves.obligatory.length > 0 && selfPoke.hasAbility('prankster')) maxPriority = 1;

		// no charge/recharge
		filteredMoves = [];
		for (let i = 0; i < finalDamageMoves.length; i++) {
			const move = finalDamageMoves[i][0].moveData;
			if (!(move.flags && (move.flags['recharge'] || (move.flags['charge'] && !selfPoke.hasItem('whiteherb'))))) filteredMoves.push(finalDamageMoves[i]);
			if (move.id in { 'solarbeam': 1, 'solarblade': 1 } && !supressedWeather && toId(battle.conditions.weather) in { 'desolateland': 1, 'sunnyday': 1 }) filteredMoves.push(finalDamageMoves[i]);
		}
		if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;

		// self attack/speed stat increase
		if (!selfPoke.hasAbility('contrary')) {
			filteredMoves = [];
			for (let i = 0; i < finalDamageMoves.length; i++) {
				const move = finalDamageMoves[i][0].moveData;
				if (!selfPoke.hasAbility('sheerforce') && move.secondary && (move.secondary.chance >= 50 || (move.secondary.chance >= 25 && selfPoke.hasAbility('serenegrace'))) && move.secondary.self && move.secondary.self.boosts && (move.secondary.self.boosts.atk || move.secondary.self.boosts.spa || move.secondary.self.boosts.spe)) filteredMoves.push(finalDamageMoves[i]);
				if (move.id === 'maxairstream' || (move.id === 'maxknuckle' && selfPoke.template.baseStats.atk >= selfPoke.template.baseStats.spa) || (move.id === 'maxooze' && selfPoke.template.baseStats.atk <= selfPoke.template.baseStats.spa)) filteredMoves.push(finalDamageMoves[i]);
				if (move.id === 'fellstinger' && damageMoves.ohko.length) filteredMoves.push(finalDamageMoves[i]);
			}
			if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
		}

		// foe defense/speed stat decrease
		if (!damageMoves.ohko.length && !foePoke.hasAbility('contrary')) {
			filteredMoves = [];
			for (let i = 0; i < finalDamageMoves.length; i++) {
				const move = finalDamageMoves[i][0].moveData;
				if (!selfPoke.hasAbility('sheerforce') && move.secondary && (move.secondary.chance >= 50 || (move.secondary.chance >= 25 && selfPoke.hasAbility('serenegrace'))) && move.secondary.boosts && (move.secondary.boosts.def || move.secondary.boosts.spd || (move.secondary.boosts.spe && selfSpe <= foeSpe))) filteredMoves.push(finalDamageMoves[i]);
				if (move.id in { 'maxdarkness': 1, 'maxphantasm': 1 }) filteredMoves.push(finalDamageMoves[i]);
				if (selfSpe <= foeSpe && move.id in { 'maxstrike': 1, 'gmaxfoamburst': 1 }) filteredMoves.push(finalDamageMoves[i]);
			}
			if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
		}

		// no recoil
		filteredMoves = [];
		for (let i = 0; i < finalDamageMoves.length; i++) {
			const move = finalDamageMoves[i][0].moveData;
			if ((!move.recoil || foePoke.hp * move.recoil[0] / move.recoil[1] < selfPoke.hp) && !move.mindBlownRecoil) filteredMoves.push(finalDamageMoves[i]);
		}
		if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;

		// max accuracy
		if (!(selfConditions.boosts.accuracy > 0) && !(foeConditions.boosts.evasion < 0) && !selfPoke.hasAbility({ 'compoundeyes': 1, 'noguard': 1, 'victorystar': 1 })) {
			let maxAccuracy = 0;
			for (let i = 0; i < finalDamageMoves.length; i++) {
				const move = finalDamageMoves[i][0].moveData;
				let accuracy = move.finalDamageMoves;
				if (move.id in { 'tripleaxel': 1, 'triplekick': 1 } && !selfPoke.hasAbility('skilllink')) accuracy = 73;
				if (!supressedWeather) {
					if (move.id in { 'hurricane': 1, 'thunder': 1 }) {
						if (toId(battle.conditions.weather) in { 'primordealsea': 1, 'raindance': 1 }) accuracy = true;
						if (toId(battle.conditions.weather) in { 'desolateland': 1, 'sunnyday': 1 }) accuracy = 50;
					}
					if (move.id === 'blizzard' && ['hail', 'snow'].includes(toId(battle.conditions.weather))) accuracy = true;
				}
				if (typeof accuracy !== 'number') {
					// z and max moves are considered normal accuracy to prevent them from being chosen on this step (should be used sparingly)
					if (move.isZ || (move.isMax && !this.selfLastPokemon(battle))) accuracy = 100;
					else accuracy = 101;
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
		for (let i = 0; i < finalDamageMoves.length; i++) {
			const move = finalDamageMoves[i][0].moveData;
			if (!(move.self && move.self.volatileStatus)) filteredMoves.push(finalDamageMoves[i]);
		}
		if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;

		// no self stat decrease
		if (!selfPoke.hasAbility('contrary')) {
			filteredMoves = [];
			for (let i = 0; i < finalDamageMoves.length; i++) {
				const move = finalDamageMoves[i][0].moveData;
				if (!(move.self && move.self.boosts)) filteredMoves.push(finalDamageMoves[i]);
			}
			if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
		}

		// prefer terastal
		filteredMoves = [];
		for (let i = 0; i < finalDamageMoves.length; i++) {
			if (finalDamageMoves[i][0].transformation?.terastallize) filteredMoves.push(finalDamageMoves[i]);
		}
		if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;

		// no z or max
		filteredMoves = [];
		for (let i = 0; i < finalDamageMoves.length; i++) {
			if (!['zmove', 'dynamax'].includes(finalDamageMoves[i][0].transformation)) filteredMoves.push(finalDamageMoves[i]);
		}
		if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;

		// knock off item
		if (foePoke.item && foePoke.item.id) {
			filteredMoves = [];
			for (let i = 0; i < finalDamageMoves.length; i++) {
				const move = finalDamageMoves[i][0].moveData;
				if (move.id === 'knockoff' || (move.id === 'incinerate' && (foePoke.item.isBerry || foePoke.item.isGem))) filteredMoves.push(finalDamageMoves[i]);
			}
			if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
		}

		// flinch
		if (!damageMoves.ohko.length && !foeConditions.volatiles.dynamax && !selfPoke.hasAbility('sheerforce') && !selfPoke.hasItem({ 'kingsrock': 1, 'razorfang': 1 })) {
			filteredMoves = [];
			for (let i = 0; i < finalDamageMoves.length; i++) {
				const move = finalDamageMoves[i][0].moveData;
				if ((move.secondary && move.secondary.volatileStatus === 'flinch') || move.id in { 'firefang': 1, 'icefang': 1, 'thunderfang': 1 }) filteredMoves.push(finalDamageMoves[i]);
			}
			if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
		}

		// drain or heal
		if (selfPoke.hp <= 85 && !selfConditions.volatiles['healblock']) {
			filteredMoves = [];
			for (let i = 0; i < finalDamageMoves.length; i++) {
				const move = finalDamageMoves[i][0].moveData;
				if (move.drain && !foePoke.hasAbility('liquidooze')) filteredMoves.push(finalDamageMoves[i]);
				if (move.id === 'gmaxfinale') filteredMoves.push(finalDamageMoves[i]);
				if (move.id === 'maxovergrowth' && selfPoke.isGrounded(selfConditions) && !foePoke.isGrounded(selfConditions)) filteredMoves.push(finalDamageMoves[i]);
				if (move.id === 'sappyseed' && !foePoke.hasType('Grass', foeConditions) && !foePoke.hasAbility({ 'liquidooze': 1, 'magicguard': 1 })) filteredMoves.push(finalDamageMoves[i]);
			}
			if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
		}

		// self defense stat increase
		if (!selfPoke.hasAbility('contrary')) {
			filteredMoves = [];
			for (let i = 0; i < finalDamageMoves.length; i++) {
				const move = finalDamageMoves[i][0].moveData;
				if (!selfPoke.hasAbility('sheerforce') && move.secondary && (move.secondary.chance >= 50 || (move.secondary.chance >= 25 && selfPoke.hasAbility('serenegrace'))) && move.secondary.self && move.secondary.self.boosts && (move.secondary.self.boosts.def || move.secondary.self.boosts.spd)) filteredMoves.push(finalDamageMoves[i]);
				if (move.id in { 'maxquake': 1, 'maxsteelspike': 1 }) filteredMoves.push(finalDamageMoves[i]);
			}
			if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
		}

		// foe attack stat decrease
		if (!damageMoves.ohko.length && !foePoke.hasAbility('contrary')) {
			filteredMoves = [];
			for (let i = 0; i < finalDamageMoves.length; i++) {
				const move = finalDamageMoves[i][0].moveData;
				if (!selfPoke.hasAbility('sheerforce') && move.secondary && (move.secondary.chance >= 50 || (move.secondary.chance >= 25 && selfPoke.hasAbility('serenegrace'))) && move.secondary.boosts && (move.secondary.boosts.atk || move.secondary.boosts.spa)) filteredMoves.push(finalDamageMoves[i]);
				if (move.id in { 'maxflutterby': 1, 'maxwyrmwind': 1 }) filteredMoves.push(finalDamageMoves[i]);
			}
			if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
		}

		// no LO recoil with sheer force
		if (selfPoke.hasAbility('sheerforce') && selfPoke.hasItem('lifeorb')) {
			filteredMoves = [];
			for (let i = 0; i < finalDamageMoves.length; i++) {
				const move = finalDamageMoves[i][0].moveData;
				if (move.secondary || move.secondaries) filteredMoves.push(finalDamageMoves[i]);
			}
			if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
		}

		// no contact
		if (!selfPoke.hasAbility({ 'toughclaws': 1, 'unseenfist': 1 }) && !selfPoke.hasItem({ 'protectivepads': 1, 'punchingglove': 1 })) {
			filteredMoves = [];
			for (let i = 0; i < finalDamageMoves.length; i++) {
				const move = finalDamageMoves[i][0].moveData;
				if (!move.flags || !move.flags['contact']) filteredMoves.push(finalDamageMoves[i]);
			}
			if (filteredMoves.length > 0) finalDamageMoves = filteredMoves;
		}

		debug('Final damage moves: ' + JSON.stringify(finalDamageMoves.map(d => d[0].move)));

		let foeHasSwitch = false;
		for (let i = 0; i < movesB.length; i++) {
			if (movesB[i].selfSwitch) {
				if (movesB[i].id === 'partingshot' && selfPoke.hasAbility({ 'contrary': 1, 'magicbounce': 1 })) continue;
				if (movesB[i].category !== 'Status') {
					if ((movesB[i].type === 'Electric' && selfPoke.hasType('Ground', selfConditions)) || selfPoke.hasAbility('wonderguard')) continue;
				}
				if (movesB[i].flags?.contact && (selfPoke.hasAbility({ 'ironbarbs': 1, 'roughskin': 1 }) || selfPoke.hasItem('rockyhelmet'))) continue;
				foeHasSwitch = true;
			}
		}

		if (!foeHasSwitch && ev.receivedPercentage >= 85 && ((selfSpe <= foeSpe && maxPriority <= 0) || (damageMoves.ohko.length === 0 && supportMoves.obligatory.length === 0))) {
			if (bestSwitch) {
				debug('Returning best switch');
				if (bestSwitch[0].type === 'move') return bestSwitch;
				let evBestSwitch = this.evaluatePokemon(battle, (bestSwitch[0] as SwitchDecision).pokeId);
				if (
					evBestSwitch.receivedPercentage < 50 &&
					(evBestSwitch.received < ev.received || (evBestSwitch.received === ev.received && evBestSwitch.inflicted > ev.inflicted))
				) {
					return bestSwitch;
				}
			}
		}

		if (bestSwitch && (ev.receivedPercentage <= 25 || (ev.receivedPercentage <= 85 && ev.received <= 33.3 && selfPoke.hasAbility('regenerator'))) && supportMoves.slowswitching.length) bestSwitch = this.sample(supportMoves.slowswitching);

		if (damageMoves.ohko.length) {
			return this.sample(finalDamageMoves);
		} else if (supportMoves.obligatory.length) {
			return this.sample(supportMoves.obligatory);
		} else if (damageMoves.thko.length) {
			if (supportMoves.viable.length > 0 && maxPriority <= 0 && Math.random() >= 0.5) {
				return this.sample(supportMoves.viable);
			} else {
				return this.sample(finalDamageMoves);
			}
		} else if (damageMoves['3hko'].length > 0 || supportMoves.viable.length > 0 || damageMoves.bad.length > 0) {
			if (bestSwitch) {
				if (bestSwitch[0].type === 'move' && (bestSwitch[0] as MoveDecision).move !== 'batonpass') return bestSwitch;
				if (switchIfNoOption && damageMoves['3hko'].length === 0) return bestSwitch;
				let evBestSwitch = this.evaluatePokemon(battle, (bestSwitch[0] as SwitchDecision).pokeId);
				if (
					evBestSwitch.receivedPercentage < 50 &&
					(evBestSwitch.received < ev.received || (evBestSwitch.received === ev.received && evBestSwitch.inflicted > ev.inflicted))
				) {
					return bestSwitch;
				}
			}

			let finalMoves = supportMoves.viable;
			if (damageMoves['3hko'].length > 0 || finalMoves.length === 0) finalMoves = finalMoves.concat([this.sample(finalDamageMoves)]);
			return this.sample(finalMoves);
		} else if (bestSwitch) {
			battle.self.active[0].helpers.hasNoViableMoves = battle.foe.active[0].name;
			return bestSwitch;
		} else if (supportMoves.unviable.length) {
			return this.sample(supportMoves.unviable);
		}

		return this.sample(decisions);
	};

	/*
	* Switches
	*/

	getBestSwitch(battle: Battle, decisions: Decision[][]): SwitchDecision[] | null {
		debug('Switch options | Foe: ' + battle.foe.active[0].name);
		let switches: { decision: SwitchDecision[], ev: Matchup }[] = [];
		for (let i = 0; i < decisions.length; i++) {
			if (decisions[i][0].type !== 'switch') continue;

			const decision = (decisions[i] as SwitchDecision[]);
			if (battle.foe.active[0] && !battle.foe.active[0].fainted && battle.self.pokemon[decision[0].pokeId]) {
				let pk = battle.self.pokemon[decision[0].pokeId];
				if (pk.helpers.hasNoViableMoves === battle.foe.active[0].name) continue;
			}

			const switchOption = {
				decision,
				ev: this.evaluatePokemon(battle, decision[0].pokeId),
			};
			debug('Switch option | Pokemon: ' + switchOption.decision[0].poke + ' | Evaluation: ' + JSON.stringify(switchOption.ev));
			switches.push(switchOption);
		}

		if (!switches.length) return null;

		switches.sort((a, b) => 10000 * (a.ev.received - b.ev.received) + (b.ev.inflicted - a.ev.inflicted));

		if (battle.foe.active[0] && battle.foe.active[0].volatiles['substitute']) {
			debug('Returning sub breaker');
			const subBreakers = switches.filter(switchOption => (switchOption.ev.inflicted > 25));
			if (subBreakers.length) return subBreakers[0].decision;
		}

		let minR = switches[0].ev.received;
		if (minR < 100) switches = switches.filter(switchOption => (switchOption.ev.received < Math.min(100, minR + 10)));
		switches.sort((a, b) => (b.ev.inflicted - a.ev.inflicted));
		return switches[0].decision;
	};

	getBestLead(battle: Battle, decisions: TeamDecision[][]): Decision[] {
		const sideIdToPokemon = decisions.map(decision => decision[0].team[0]).reduce((acc: Record<number, Pokemon>, v) => {
			acc[v] = battle.parseRequestPokemon(v, true);
			return acc;
		}, {});

		let leads: TeamDecision[][] = [];

		// trickroom setters
		for (let i = 0; i < decisions.length; i++) {
			const sideId = decisions[i][0].team[0];
			const moves = battle.request.side.pokemon[sideId].moves;
			for (let j = 0; j < moves.length; j++) {
				if (moves[j] === 'trickroom') {
					leads.push(decisions[i]);
				}
			}
		}

		// weather setters
		if (leads.length === 0) {
			for (let i = 0; i < decisions.length; i++) {
				const sideId = decisions[i][0].team[0];
				const poke = sideIdToPokemon[sideId];
				if (poke.hasAbility({ 'drizzle': 1, 'drought': 1, 'orichalcumpulse': 1, 'sandstream': 1, 'snowwarning': 1, 'electricsurge': 1, 'hadronengine': 1 }) && !poke.hasItem({ 'blueorb': 1, 'redorb': 1 })) {
					leads.push(decisions[i]);
				} else {
					for (let move of battle.request.side.pokemon[sideId].moves) {
						if (move === 'chillyreception') {
							leads.push(decisions[i]);
							break;
						}
					}
				}
			}
		}

		// hazard setters
		if (leads.length === 0) {
			for (let i = 0; i < decisions.length; i++) {
				const sideId = decisions[i][0].team[0];
				const moves = battle.request.side.pokemon[sideId].moves;
				for (let move of moves) {
					if (['spikes', 'ceaselessedge', 'stealthrock', 'stoneaxe', 'stickyweb', 'toxicspikes'].includes(move)) {
						leads.push(decisions[i]);
						break;
					}
				}
			}
		}

		// screen setters
		if (leads.length === 0) {
			for (let i = 0; i < decisions.length; i++) {
				const sideId = decisions[i][0].team[0];
				const poke = sideIdToPokemon[sideId];
				for (let move of battle.request.side.pokemon[sideId].moves) {
					if (['lightscreen', 'reflect'].includes(move) || (move === 'auroraveil' && poke.hasAbility('snowwarning'))) {
						leads.push(decisions[i]);
						break;
					}
				}
			}
		}

		// hazard removers/deflectors
		if (leads.length === 0) {
			for (let i = 0; i < decisions.length; i++) {
				const sideId = decisions[i][0].team[0];
				const poke = sideIdToPokemon[sideId];
				if (poke.hasAbility('magicbounce')) {
					leads.push(decisions[i]);
					continue;
				}
				for (let move of battle.request.side.pokemon[sideId].moves) {
					if (['defog', 'magiccoat', 'mortalspin', 'rapidspin', 'tidyup'].includes(move)) {
						leads.push(decisions[i]);
						break;
					}
				}
			}
		}

		// focus sash, pivots and anti-leads
		if (leads.length === 0) {
			for (let i = 0; i < decisions.length; i++) {
				const sideId = decisions[i][0].team[0];
				const poke = sideIdToPokemon[sideId];
				if (poke.hasItem('focussash') || poke.hasAbility('intimidate')) {
					leads.push(decisions[i]);
				} else {
					for (let move of battle.request.side.pokemon[sideId].moves) {
						if (['flipturn', 'partingshot', 'shedtail', 'taunt', 'teleport', 'uturn', 'voltswitch'].includes(move)) {
							leads.push(decisions[i]);
							break;
						}
					}
				}
			}
		}

		decisions = leads || decisions;
		leads = [];
		for (let i = 0; i < decisions.length; i++) {
			const sideId = decisions[i][0].team[0];
			const poke = sideIdToPokemon[sideId];
			if (poke.hasAbility({ 'dauntlessshield': 1, 'intrepidsword': 1, 'supremeoverlord': 1, 'unburden': 1 })) continue;
			if (poke.hasItem({ 'powerherb': 1, 'throatspray': 1, 'whiteherb': 1 })) continue;
			if (battle.request.side.pokemon[sideId].moves
				.some(move => ['bellydrum', 'clangoroussoul', 'filletaway', 'lastrespects', 'revivalblessing', 'shellsmash'].includes(move))) continue;
			leads.push(decisions[i]);
		}

		return this.sample(leads || decisions);
	};

	/*
	* Swapper
	*/

	decide(battle: Battle, decisions: Decision[][]): Decision[] | null {
		if (battle.gametype !== 'singles') throw new Error('This module only works for singles gametype');
		if (battle.request?.forceSwitch) {
			return this.getBestSwitch(battle, decisions);
		} else if (battle.request?.active) {
			return this.getBestMove(battle, decisions);
		} else {
			return this.getBestLead(battle, decisions as TeamDecision[][]);
		}
	};
};