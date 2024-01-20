/*
	Minors
*/

import { AbilityData } from '../../../data/types-abilities';
import { BoostID } from '../../../data/types-dex';
import { ItemData } from '../../../data/types-items';
import { toId } from '../../../tools';
import { Battle } from './battle';
import { getAbility, getEffect, getItem, getMove, getPokemon, TeraType, WithID } from './battle-data';

export type Minor = `-${string}`;

export const minors: Record<Minor, Minor | ((args: string[], kwargs: Record<string, string>, isIntro?: boolean) => void)> = {
	'-damage': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		if (!poke) return;

		const hp = this.parseHealth(args[2]);
		poke.hp = hp;
		if (kwargs.from) {
			const effect = getEffect(kwargs.from, this.gen);
			const ofpoke = this.getActive(kwargs.of);
			if (effect.effectType === 'Ability' && ofpoke) {
				ofpoke.markAbility((effect as AbilityData).name);
			}
			switch (effect.id) {
				case 'stealthrock':
				case 'spikes':
				case 'rosespikes':
				case 'recoil':
				case 'sandstorm':
				case 'hail':
				case 'baddreams':
				case 'nightmare':
				case 'roughskin':
				case 'ironbarbs':
				case 'aftermath':
				case 'liquidooze':
				case 'dryskin':
				case 'solarpower':
				case 'confusion':
				case 'leechseed':
				case 'flameburst':
				case 'firepledge':
				case 'jumpkick':
				case 'highjumpkick':
					break;
				case 'brn':
				case 'psn':
					if (!poke.helpers.statusCounter) poke.helpers.statusCounter = 0;
					poke.helpers.statusCounter++;
					break;
				default:
					if (ofpoke) {
						return;
					} else if (effect.effectType === 'Item') {
						poke.item = getItem((effect as ItemData).name, this.gen, this.id);
					} else if (effect.effectType === 'Ability') {
						poke.markAbility((effect as AbilityData).name);
					}
					break;
			}
		}
	},

	'-heal': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		if (!poke) return;

		const det = this.parsePokemonIdentity(args[1]);
		const hp = this.parseHealth(args[2]);
		poke.hp = hp;
		if (kwargs.from) {
			const effect = getEffect(kwargs.from, this.gen);
			if (effect.effectType === 'Ability') {
				poke.markAbility((effect as AbilityData).name);
			}
			switch (effect.id) {
				case 'ingrain':
				case 'aquaring':
				case 'drain':
					break;
				case 'lunardance':
					poke.moves.forEach((m) => m.restorePP());
					if (det) this.players[det.side].side.wish = null;
					break;
				case 'healingwish':
				case 'wish':
					if (det) this.players[det.side].side.wish = null;
					break;
				case 'leftovers':
				case 'shellbell':
				case 'blacksludge':
					poke.item = { ...(effect as WithID<ItemData>) };
					break;
			}
		}
	},

	'-sethp': function (this: Battle, args) {
		for (let i = 1; i < args.length - 1; i += 2) {
			const poke = this.getActive(args[i]);
			if (poke) poke.hp = this.parseHealth(args[i + 1]);
		}
	},

	'-boost': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		if (!poke) return;

		const stat = this.parseStat(args[2]);
		const n = parseInt(args[3]) || 0;
		if (stat) poke.addBoost(stat, n);
		if (kwargs.from) {
			const effect = getEffect(kwargs.from, this.gen);
			const ofpoke = this.getActive(kwargs.of);
			if (effect.effectType === 'Ability' && !(effect.id === 'weakarmor' && stat === 'spe')) {
				(ofpoke || poke).markAbility((effect as AbilityData).name);
			}
		}
	},

	'-unboost': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		if (!poke) return;

		const stat = this.parseStat(args[2]);
		const n = parseInt(args[3]) || 0;
		if (stat) poke.addBoost(stat, -1 * n);
		if (kwargs.from) {
			const effect = getEffect(kwargs.from, this.gen);
			const ofpoke = this.getActive(kwargs.of);
			if (effect.effectType === 'Ability') {
				(ofpoke || poke).markAbility((effect as AbilityData).name);
			}
		}
	},

	'-setboost': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		if (!poke) return;

		const stat = this.parseStat(args[2]);
		const n = parseInt(args[3]) || 0;
		if (stat) poke.setBoost(stat, -1 * n);
		if (kwargs.from) {
			const effect = getEffect(kwargs.from, this.gen);
			if (effect.id === 'angerpoint') poke.markAbility('Anger Point');
		}
	},

	'-swapboost': function (this: Battle, args) {
		const poke = this.getActive(args[1]);
		const poke2 = this.getActive(args[2]);
		if (!poke || !poke2) return;

		if (args[3]) {
			args[3]
				.split(',')
				.map(this.parseStat)
				.forEach((stat) => stat && ([poke.boosts[stat], poke2.boosts[stat]] = [poke2.boosts[stat] || 0, poke.boosts[stat] || 0]));
		} else {
			[poke.boosts, poke2.boosts] = [{ ...poke2.boosts }, { ...poke.boosts }];
		}
	},

	'-restoreboost': function (this: Battle, args) {
		const poke = this.getActive(args[1]);
		if (!poke) return;
		for (const i in poke.boosts) {
			const stat = i as BoostID;
			if ((poke.boosts[stat] || 0) < 0) delete poke.boosts[stat];
		}
	},

	'-copyboost': function (this: Battle, args) {
		const poke = this.getActive(args[1]);
		const poke2 = this.getActive(args[2]);
		if (!poke || !poke2) return;

		if (args[3]) {
			args[3]
				.split(',')
				.map(this.parseStat)
				.forEach((stat) => stat && (poke.boosts[stat] = poke2.boosts[stat] || 0));
		} else {
			poke.boosts = { ...poke2.boosts };
		}
	},

	'-clearboost': function (this: Battle, args) {
		const poke = this.getActive(args[1]);
		if (poke) poke.removeAllBoosts();
	},

	'-invertboost': function (this: Battle, args) {
		const poke = this.getActive(args[1]);
		if (poke) poke.invertAllBoosts();
	},

	'-clearallboost': function (this: Battle) {
		Object.values(this.players)
			.flatMap((p) => p.active)
			.forEach((active) => active && active.removeAllBoosts());
	},

	'-miss': '-crit',
	'-supereffective': '-crit',
	'-resisted': '-crit',
	'-crit': function (this: Battle, args, kwargs, isIntro) {
		// Not real information - message minors
		if (isIntro) return;
		const ident = this.parsePokemonIdentity(args[1]);
		this.message(args[0].substring(1), ident?.side, ident?.name);
	},

	'-immune': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		const effect = getEffect(args[2], this.gen);
		const fromeffect = getEffect(kwargs.from, this.gen);
		if (poke && effect.id !== 'confusion') {
			if (fromeffect?.effectType === 'Ability') {
				poke.markAbility((fromeffect as AbilityData).name);
			}
		}
	},

	'-fail': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		const effect = getEffect(args[2], this.gen);
		const fromeffect = getEffect(kwargs.from, this.gen);
		if (poke && fromeffect.id !== 'skydrop' && effect.id === 'unboost') {
			if (fromeffect.effectType === 'Ability') {
				poke.markAbility(fromeffect.id);
			}
		}
	},

	'-prepare': function (this: Battle, args) {
		const poke = this.getActive(args[1]);
		const move = args[2];
		const target = this.parsePokemonIdentity(args[1]);
		if (poke && target) poke.prepareMove(move, target.slot);
	},

	'-status': function (this: Battle, args, kwargs, isIntro) {
		const poke = this.getActive(args[1]);
		if (!poke) return;

		poke.status = args[2];
		poke.helpers.statusCounter = 0;
		if (poke.status === 'slp') {
			poke.helpers.sleepCounter = 0;
		}
		const det = this.parsePokemonIdentity(args[1]);
		if (!isIntro) this.message('start-' + poke.status, det?.side, poke.name); // hax
	},

	'-curestatus': function (this: Battle, args) {
		const poke = this.getActive(args[1]);
		if (!poke) return;
		poke.status = '';
		if (!args[2] || args[2] === 'confusion') poke.removeVolatile('confusion');
	},

	'-cureteam': function (this: Battle, args) {
		const ident = this.parsePokemonIdentity(args[1]);
		if (ident && this.players[ident.side]) {
			this.players[ident.side].pokemon.forEach((poke) => (poke.status = ''));
		}
	},

	'-item': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		if (!poke) return;

		const item = getItem(args[2], this.gen, this.id);
		const effect = getEffect(kwargs.from, this.gen);
		const ofpoke = this.getActive(kwargs.of);
		poke.item = item;
		poke.itemEffect = '';
		poke.removeVolatile('airballoon');
		if (item.id === 'airballoon') poke.addVolatile('airballoon');
		if (effect.id) {
			switch (effect.id) {
				case 'pickup':
					poke.markAbility('Pickup');
					poke.itemEffect = 'found';
					break;
				case 'recycle':
					poke.itemEffect = 'found';
					break;
				case 'frisk':
					if (ofpoke) ofpoke.markAbility('Frisk');
					if (kwargs.identify) {
						// used for gen 6
						poke.itemEffect = 'frisked';
					}
					break;
				case 'magician':
				case 'pickpocket':
					poke.markAbility((effect as AbilityData).name);
					poke.itemEffect = 'stolen';
					break;
				case 'thief':
				case 'covet':
					poke.itemEffect = 'stolen';
					break;
				case 'harvest':
					poke.itemEffect = 'harvested';
					poke.markAbility('Harvest');
					break;
				case 'bestow':
					poke.itemEffect = 'bestowed';
					break;
				case 'trick':
					poke.itemEffect = 'tricked';
					break;
			}
		}
	},

	'-enditem': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		if (!poke) return;

		const item = getItem(args[2], this.gen, this.id);
		const effect = getEffect(kwargs.from, this.gen);
		poke.item = null;
		poke.itemEffect = '';
		poke.prevItem = item;
		poke.prevItemEffect = '';
		poke.removeVolatile('airballoon');
		if (kwargs.eat) {
			poke.prevItemEffect = 'eaten';
		} else if (effect.id) {
			switch (effect.id) {
				case 'fling':
					poke.prevItemEffect = 'flung';
					break;
				case 'knockoff':
					poke.prevItemEffect = 'knocked off';
					break;
				case 'stealeat':
					poke.prevItemEffect = 'stolen';
					break;
				case 'gem':
					poke.prevItemEffect = 'consumed';
					break;
				case 'incinerate':
					poke.prevItemEffect = 'incinerated';
					break;
			}
		} else {
			switch (item.id) {
				case 'airballoon':
					poke.prevItemEffect = 'popped';
					poke.removeVolatile('airballoon');
					break;
				case 'focussash':
					poke.prevItemEffect = 'consumed';
					break;
				case 'focusband':
					break;
				case 'powerherb':
					poke.prevItemEffect = 'consumed';
					break;
				case 'whiteherb':
					poke.prevItemEffect = 'consumed';
					break;
				case 'ejectbutton':
					poke.prevItemEffect = 'consumed';
					break;
				case 'redcard':
					poke.prevItemEffect = 'held up';
					break;
				default:
					poke.prevItemEffect = 'consumed';
			}
		}
	},

	'-ability': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		if (!poke) return;

		const ability = getAbility(args[2], this.gen, this.id);
		const effect = getEffect(kwargs.from, this.gen);
		poke.markAbility(ability.name, !!effect.id && !kwargs.fail);
		poke.supressedAbility = false;
	},

	'-endability': function (this: Battle, args) {
		const poke = this.getActive(args[1]);
		if (poke) poke.supressedAbility = true;
	},

	'-transform': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		const tpoke = this.getActive(args[2]);
		if (!poke || !tpoke) return;

		const effect = getEffect(kwargs.from, this.gen);
		if (effect.effectType === 'Ability') {
			poke.markAbility((effect as AbilityData).name);
		}
		poke.transformInto(tpoke);
	},

	'-formechange': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		if (!poke) return;

		const template = getPokemon(args[2], this.gen, this.id);
		const fromeffect = getEffect(kwargs.from, this.gen);
		poke.removeVolatile('typeadd');
		poke.removeVolatile('typechange');
		if (fromeffect.effectType === 'Ability') {
			poke.markAbility((fromeffect as AbilityData).name);
		}
		poke.addVolatile('formechange');
		poke.volatiles.formechange = template.name;
	},

	'-mega': function (this: Battle, args) {
		const poke = this.getActive(args[1]);
		if (!poke) return;

		const item = getItem(args[3], this.gen, this.id);
		if (args[2] !== 'Rayquaza' && item.megaStone) {
			poke.item = item;
			const template = getPokemon(item.megaStone, this.gen, this.id);
			poke.markAbility(template.abilities[0]);
		}
	},

	'-terastallize': function (this: Battle, args) {
		const poke = this.getActive(args[1]);
		if (poke) poke.terastallize = args[2] as TeraType;
	},

	'-start': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		if (!poke) return;

		const ident = this.parsePokemonIdentity(args[1]);
		const effect = getEffect(args[2], this.gen);
		const ofpoke = this.getActive(kwargs.of);
		const fromeffect = getEffect(kwargs.from, this.gen);
		if (effect.id.startsWith('protosynthesis')) {
			poke.addVolatile('protosynthesis');
			poke.volatiles['protosynthesis'] = effect.id.substring('protosynthesis'.length);
		} else if (effect.id.startsWith('quarkdrive')) {
			poke.addVolatile('quarkdrive');
			poke.volatiles['quarkdrive'] = effect.id.substring('quarkdrive'.length);
		} else {
			poke.addVolatile(effect.id);
		}
		switch (effect.id) {
			case 'typechange':
				poke.removeVolatile('typeadd');

				if (fromeffect.id === 'colorchange') {
					poke.markAbility('Color Change');
				} else if (fromeffect.id === 'libero') {
					poke.markAbility('Libero');
				} else if (fromeffect.id === 'protean') {
					poke.markAbility('Protean');
				}

				if (fromeffect.id === 'reflecttype') {
					if (ofpoke) poke.volatiles.typechange = [...ofpoke.template.types];
				} else {
					poke.volatiles.typechange = args[3] ? args[3].split('/') : ['???'];
				}

				if (!fromeffect?.id) {
					const side = args[1].substring(0, 2);
					const helpers =
						(side === 'p1' || side === 'p2') && toId(this.players[side]?.name) === toId(Bot.status.nickName)
							? this.helpers.self
							: this.helpers.foe;
					const pokeId = poke.name + '|' + poke.species;
					if (!helpers[pokeId]) helpers[pokeId] = {};
					if (!helpers[pokeId].template) helpers[pokeId].template = {};
					helpers[pokeId].template.types = poke.volatiles.typechange;
				}
				break;
			case 'typeadd':
				poke.volatiles.typeadd = args[3];
				break;
			case 'disable':
				poke.volatiles.disable = args[3] || true;
				break;
			case 'stockpile2':
				poke.removeVolatile('stockpile1');
				break;
			case 'stockpile3':
				poke.removeVolatile('stockpile2');
				break;
			case 'perish0':
				poke.removeVolatile('perish1');
				break;
			case 'perish1':
				poke.removeVolatile('perish2');
				break;
			case 'perish2':
				poke.removeVolatile('perish3');
				break;
			case 'smackdown':
				poke.removeVolatile('magnetrise');
				poke.removeVolatile('telekinesis');
				break;
			case 'doomdesire':
			case 'futuresight':
				if (ident) this.players[ident.side].side[effect.id] = { turn: this.turn };
				break;
		}
	},

	'-end': function (this: Battle, args) {
		const poke = this.getActive(args[1]);
		if (!poke) return;

		const effect = getEffect(args[2], this.gen);
		if (effect.id.startsWith('protosynthesis')) {
			poke.removeVolatile('protosynthesis');
		} else if (effect.id.startsWith('quarkdrive')) {
			poke.removeVolatile('quarkdrive');
		} else {
			poke.removeVolatile(effect.id);
		}
		switch (effect.id) {
			case 'perishsong':
				poke.removeVolatile('perish3');
				break;
			case 'stockpile':
				poke.removeVolatile('stockpile1');
				poke.removeVolatile('stockpile2');
				poke.removeVolatile('stockpile3');
				break;
		}
	},

	/*"-singleturn": function (this:Battle,args, kwargs) {
		// Code here
	},
	
	"-singlemove": function (this:Battle,args, kwargs) {
		// Code here
	},*/

	'-activate': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		if (!poke) return;

		const effect = getEffect(args[2], this.gen);
		const ofpoke = this.getActive(kwargs.of);
		const ofIdent = this.parsePokemonIdentity(kwargs.of);
		if (effect.effectType === 'Ability') {
			poke.markAbility((effect as AbilityData).name);
		}
		switch (effect.id) {
			case 'brickbreak':
			case 'psychicfangs':
				if (ofIdent) ['Reflect', 'LightScreen', 'AuroraVeil'].forEach((c) => this.players[ofIdent.side].removeSideCondition(c));
				break;
			case 'spite':
				const move = getMove(args[3], this.gen, this.id).name;
				const pp = args[4];
				poke.markMove(move, Number(pp) * -1);
				break;
			case 'gravity':
				poke.removeVolatile('magnetrise');
				poke.removeVolatile('telekinesis');
				break;
			case 'skillswap':
				if (this.gen <= 4 || !ofpoke) break;
				const pokeability = args[3] ? getAbility(args[3], this.gen, this.id) : ofpoke.ability;
				const ofpokeability = args[4] ? getAbility(args[4], this.gen, this.id) : poke.ability;
				if (pokeability) {
					poke.ability = pokeability;
					if (!ofpoke.baseAbility) ofpoke.baseAbility = pokeability;
				}
				if (ofpokeability) {
					ofpoke.ability = ofpokeability;
					if (!poke.baseAbility) poke.baseAbility = ofpokeability;
				}
				break;
			case 'quickclaw':
				poke.item = getItem('quickclaw', this.gen, this.id);
				break;
			case 'focusband':
				poke.item = getItem('focusband', this.gen, this.id);
				break;
			case 'safetygoggles':
				poke.item = getItem('safetygoggles', this.gen, this.id);
				break;
		}
	},

	'-sidestart': function (this: Battle, args) {
		const side = this.getSide(args[1]);
		if (!side) return;
		const effect = getEffect(args[2], this.gen);
		side.addSideCondition(effect.id);
	},

	'-sideend': function (this: Battle, args) {
		const side = this.getSide(args[1]);
		if (!side) return;
		const effect = getEffect(args[2], this.gen);
		side.removeSideCondition(effect.id);
	},

	'-weather': function (this: Battle, args, kwargs) {
		const effect = getEffect(args[1], this.gen);
		const poke = this.getActive(kwargs.of);
		this.conditions.weather = toId(effect.name);
		this.conditions.turnSetWeather = this.turn;
		this.conditions.upkeepWeather = !!kwargs.upkeep;
		if (poke && kwargs.from) {
			const ability = getEffect(kwargs.from, this.gen);
			if (ability.effectType === 'Ability') poke.markAbility(ability.id);
		}
	},

	'-fieldstart': function (this: Battle, args) {
		const effect = getEffect(args[1], this.gen);
		const pw = toId(effect.name);
		this.conditions[pw] = { turn: this.turn };
	},

	'-fieldend': function (this: Battle, args) {
		const effect = getEffect(args[1], this.gen);
		const pw = toId(effect.name);
		if (this.conditions[pw]) delete this.conditions[pw];
	},

	'-message': function (this: Battle, args) {
		if (args[1] && args[1].includes('NOTE: This is an Inverse Battle')) {
			this.conditions['inversebattle'] = true;
			this.debug(this.id + ': Changed to inverse Battle');
		}
	},
};
