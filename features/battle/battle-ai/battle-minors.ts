/*
	Minors
*/

import { error } from '../../../log';
import { toId } from '../../../tools';
import { Battle } from './battle';
import { getAbility, getEffect, getItem, getMove, getPokemon, Type } from './battle-data';

export type Minor = `-${string}`;

export const minors: Record<Minor, Minor | ((args: string[], kwargs: Record<string, string>, isIntro?: boolean) => void)> = {
	'-damage': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		const hp = this.parseHealth(args[2]);
		poke.hp = hp;
		if (kwargs.from) {
			const effect = getEffect(kwargs.from, this.gen);
			const ofpoke = this.getActive(kwargs.of);
			if (effect.effectType === 'Ability' && ofpoke) {
				ofpoke.markAbility(effect.name);
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
						poke.item = getItem(effect.name, this.gen, this.id);
					} else if (effect.effectType === 'Ability') {
						poke.markAbility(effect.name);
					}
					break;
			}
		}
	},

	'-heal': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		const det = this.parsePokemonIdent(args[1]);
		const hp = this.parseHealth(args[2]);
		poke.hp = hp;
		if (kwargs.from) {
			const effect = getEffect(kwargs.from, this.gen);
			if (effect.effectType === 'Ability') {
				poke.markAbility(effect.name);
			}
			switch (effect.id) {
				case 'ingrain':
				case 'aquaring':
				case 'drain':
					break;
				case 'lunardance':
					for (let i = 0; i < poke.moves.length; i++) {
						poke.moves[i].restorePP();
					}
					this.players[det.side].side.wish = null;
					break;
				case 'healingwish':
				case 'wish':
					this.players[det.side].side.wish = null;
					break;
				case 'leftovers':
				case 'shellbell':
				case 'blacksludge':
					poke.item = getItem(effect.name, this.gen, this.id);
					break;
			}
		}
	},

	'-sethp': function (this: Battle, args, kwargs) {
		let poke, hp;
		for (let i = 1; i < args.length - 1; i += 2) {
			poke = this.getActive(args[i]);
			hp = this.parseHealth(args[i + 1]);
			poke.hp = hp;
		}
	},

	'-boost': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		const stat = args[2];
		const n = parseInt(args[3]) || 0;
		poke.addBoost(stat, n);
		if (kwargs.from) {
			const effect = getEffect(kwargs.from, this.gen);
			const ofpoke = this.getActive(kwargs.of);
			if (effect.effectType === 'Ability' && !(effect.id === 'weakarmor' && stat === 'spe')) {
				(ofpoke || poke).markAbility(effect.name);
			}
		}
	},

	'-unboost': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		const stat = args[2];
		const n = parseInt(args[3]) || 0;
		poke.addBoost(stat, -1 * n);
		if (kwargs.from) {
			const effect = getEffect(kwargs.from, this.gen);
			const ofpoke = this.getActive(kwargs.of);
			if (effect.effectType === 'Ability') {
				(ofpoke || poke).markAbility(effect.name);
			}
		}
	},

	'-setboost': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		const stat = args[2];
		const n = parseInt(args[3]) || 0;
		poke.setBoost(stat, -1 * n);
		if (kwargs.from) {
			const effect = getEffect(kwargs.from, this.gen);
			switch (effect.id) {
				case 'bellydrum':
					break;
				case 'angerpoint':
					poke.markAbility('Anger Point');
					break;
			}
		}
	},

	'-swapboost': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		const poke2 = this.getActive(args[2]);
		if (args[3]) {
			const stats = args[3].split(',');
			let stat, tmp;
			for (let i = 0; i < stats.length; i++) {
				stat = toId(stats[i]);
				tmp = poke.boosts[stat];
				poke.boosts[stat] = poke2.boosts[stat];
				poke2.boosts[stat] = tmp;
				if (!poke.boosts[stat]) delete poke.boosts[stat];
				if (!poke2.boosts[stat]) delete poke2.boosts[stat];
			}
		} else {
			const tmp = poke.boosts;
			poke.boosts = poke2.boosts;
			poke2.boosts = tmp;
		}
	},

	'-restoreboost': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		for (const i in poke.boosts) {
			if (poke.boosts[i] < 0) delete poke.boosts[i];
		}
	},

	'-copyboost': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		const poke2 = this.getActive(args[2]);
		if (args[3]) {
			const stats = args[3].split(',');
			let stat;
			for (let i = 0; i < stats.length; i++) {
				stat = toId(stats[i]);
				poke.boosts[stat] = poke2.boosts[stat];
				if (!poke.boosts[stat]) delete poke.boosts[stat];
			}
		} else {
			poke.removeAllBoosts();
			poke.boosts = { ...poke2.boosts };
		}
	},

	'-clearboost': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		poke.removeAllBoosts();
	},

	'-invertboost': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		poke.invertAllBoosts();
	},

	'-clearallboost': function (this: Battle, args, kwargs) {
		for (const p in this.players) {
			for (let i = 0; i < this.players[p].active.length; i++) {
				this.players[p].active[i].removeAllBoosts();
			}
		}
	},

	'-miss': '-crit',
	'-supereffective': '-crit',
	'-resisted': '-crit',
	'-crit': function (this: Battle, args, kwargs, isIntro) {
		// Not real information - message minors
		if (isIntro) return;
		const ident = this.parsePokemonIdent(args[1]);
		this.message(args[0].substr(1), ident.side, ident.name);
	},

	'-immune': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		const effect = getEffect(args[2], this.gen);
		const fromeffect = getEffect(kwargs.from, this.gen);
		switch (effect.id) {
			case 'confusion':
				break;
			default:
				if (fromeffect && fromeffect.effectType === 'Ability') {
					poke.markAbility(fromeffect.name);
				}
		}
	},

	'-fail': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		const effect = getEffect(args[2], this.gen);
		const fromeffect = getEffect(kwargs.from, this.gen);
		const ofpoke = this.getActive(kwargs.of);
		if (fromeffect.id === 'skydrop') {
			return;
		}
		switch (effect.id) {
			case 'brn':
			case 'tox':
			case 'psn':
			case 'slp':
			case 'par':
			case 'frz':
			case 'substitute':
				break;
			case 'hyperspacefury':
			case 'darkvoid':
			case 'magikarpsrevenge':
			case 'skydrop':
				break;
			case 'sunnyday':
			case 'raindance':
			case 'sandstorm':
			case 'hail':
				break;
			case 'unboost':
				if (fromeffect.effectType === 'Ability') {
					poke.markAbility(fromeffect.id);
				}
				break;
		}
	},

	'-prepare': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		const move = args[2];
		const target = this.parsePokemonIdent(args[1]);
		if (!poke || !target) {
			error('No active pokemon found or no target parsed');
			return;
		}
		poke.prepareMove(move, target.slot);
	},

	'-status': function (this: Battle, args, kwargs, isIntro) {
		const poke = this.getActive(args[1]);
		poke.status = args[2];
		poke.helpers.statusCounter = 0;
		if (poke.status === 'slp') {
			poke.helpers.sleepCounter = 0;
		}
		const det = this.parsePokemonIdent(args[1]);
		if (!isIntro) this.message('start-' + poke.status, det.side, poke.name); // hax
	},

	'-curestatus': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		poke.status = '';
		if (!args[2] || args[2] === 'confusion') poke.removeVolatile('confusion');
	},

	'-cureteam': function (this: Battle, args, kwargs) {
		const ident = this.parsePokemonIdent(args[1]);
		if (this.players[ident.side]) {
			const pokes = this.players[ident.side].pokemon;
			for (let i = 0; i < pokes.length; i++) {
				pokes[i].status = '';
			}
		}
	},

	'-item': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
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
					ofpoke.markAbility('Frisk');
					if (kwargs.identify) {
						// used for gen 6
						poke.itemEffect = 'frisked';
					}
					break;
				case 'magician':
				case 'pickpocket':
					poke.markAbility(effect.name);
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
		const item = getItem(args[2], this.gen, this.id);
		const effect = getEffect(kwargs.from, this.gen);
		poke.item = '';
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
		const ability = getAbility(args[2], this.gen, this.id);
		const effect = getEffect(kwargs.from, this.gen);
		poke.markAbility(ability.name, effect.id && !kwargs.fail);
		poke.supressedAbility = false;
	},

	'-endability': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		poke.supressedAbility = true;
	},

	'-transform': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		const tpoke = this.getActive(args[2]);
		const effect = getEffect(kwargs.from, this.gen);
		if (effect.effectType === 'Ability') {
			poke.markAbility(effect.name);
		}
		poke.transformInto(tpoke);
	},

	'-formechange': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		const template = getPokemon(args[2], this.gen, this.id);
		const fromeffect = getEffect(kwargs.from, this.gen);
		poke.removeVolatile('typeadd');
		poke.removeVolatile('typechange');
		if (fromeffect.effectType === 'Ability') {
			poke.markAbility(fromeffect.name);
		}
		poke.addVolatile('formechange');
		poke.volatiles.formechange = template.species;
	},

	'-mega': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		const item = getItem(args[3], this.gen, this.id);
		if (args[2] !== 'Rayquaza') {
			poke.item = item;
			const template = getPokemon(item.megaStone, this.gen, this.id);
			poke.markAbility(template.abilities[0]);
		}
	},

	'-terastallize': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		poke.terastallize = args[2] as Type;
	},

	'-start': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		const ident = this.parsePokemonIdent(args[1]);
		const effect = getEffect(args[2], this.gen);
		const ofpoke = this.getActive(kwargs.of);
		const fromeffect = getEffect(kwargs.from, this.gen);
		if (effect.id.startsWith('protosynthesis') || effect.id.startsWith('quarkdrive')) {
			const volatile = effect.id.substr(0, effect.id.length - 3);
			poke.addVolatile(volatile);
			poke.volatiles[volatile] = effect.id.substr(effect.id.length - 3);
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
					poke.volatiles.typechange = [...ofpoke.template.types];
				} else {
					poke.volatiles.typechange = args[3] ? args[3].split('/') : ['???'];
				}

				if (!fromeffect?.id) {
					const side = args[1].substr(0, 2);
					const helpers = toId(this.players[side].name) === toId(Bot.status.nickName) ? this.helpers.self : this.helpers.foe;
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
				this.players[ident.side].side.doomdesire = { turn: this.turn };
				break;
			case 'futuresight':
				this.players[ident.side].side.futuresight = { turn: this.turn };
				break;
		}
	},

	'-end': function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		const effect = getEffect(args[2], this.gen);
		const fromeffect = getEffect(kwargs.from, this.gen);
		if (effect.id.startsWith('protosynthesis') || effect.id.startsWith('quarkdrive')) {
			poke.removeVolatile(effect.id.substr(0, effect.id.length - 3));
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
		const effect = getEffect(args[2], this.gen);
		const ofpoke = this.getActive(kwargs.of);
		const ofIdent = this.parsePokemonIdent(kwargs.of);
		if (effect.effectType === 'Ability') {
			poke.markAbility(effect.name);
		}
		switch (effect.id) {
			case 'brickbreak':
			case 'psychicfangs':
				this.players[ofIdent.side].removeSideCondition('Reflect');
				this.players[ofIdent.side].removeSideCondition('LightScreen');
				this.players[ofIdent.side].removeSideCondition('AuroraVeil');
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
				if (this.gen <= 4) break;
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

	'-sidestart': function (this: Battle, args, kwargs) {
		const side = this.getSide(args[1]);
		const effect = getEffect(args[2], this.gen);
		side.addSideCondition(effect.name);
	},

	'-sideend': function (this: Battle, args, kwargs) {
		const side = this.getSide(args[1]);
		const effect = getEffect(args[2], this.gen);
		side.removeSideCondition(effect.name);
	},

	'-weather': function (this: Battle, args, kwargs) {
		const effect = getEffect(args[1], this.gen);
		const poke = this.getActive(kwargs.of);
		const ability = getEffect(kwargs.from, this.gen);
		this.conditions.weather = toId(effect.name);
		this.conditions.turnSetWeather = this.turn;
		this.conditions.upkeepWeather = !!kwargs.upkeep;
		if (poke && kwargs.from) poke.markAbility(ability.id);
	},

	'-fieldstart': function (this: Battle, args, kwargs) {
		const effect = getEffect(args[1], this.gen);
		const pw = toId(effect.name);
		this.conditions[pw] = { turn: this.turn };
	},

	'-fieldend': function (this: Battle, args, kwargs) {
		const effect = getEffect(args[1], this.gen);
		const pw = toId(effect.name);
		if (this.conditions[pw]) delete this.conditions[pw];
	},

	'-message': function (this: Battle, args, kwargs) {
		if (args[1] && args[1].includes('NOTE: This is an Inverse Battle')) {
			this.conditions['inversebattle'] = true;
			this.debug(this.id + ': Changed to inverse Battle');
		}
	},
};
