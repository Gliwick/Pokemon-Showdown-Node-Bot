"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; } const Items = {
	aguavberry: {
		inherit: true,
		onUpdate() {},
		onResidualOrder: 10,
		onResidualSubOrder: 4,
		onResidual(pokemon) {
			if (pokemon.hp <= pokemon.maxhp / 2) {
				pokemon.eatItem();
			}
		},
	},
	apicotberry: {
		inherit: true,
		onUpdate() {},
		onResidualOrder: 10,
		onResidualSubOrder: 4,
		onResidual(pokemon) {
			if (pokemon.hp <= pokemon.maxhp / 4) {
				pokemon.eatItem();
			}
		},
	},
	berryjuice: {
		inherit: true,
		onUpdate() {},
		onResidualOrder: 10,
		onResidualSubOrder: 4,
		onResidual(pokemon) {
			if (pokemon.hp <= pokemon.maxhp / 2) {
				if (this.runEvent('TryHeal', pokemon) && pokemon.useItem()) {
					this.heal(20);
				}
			}
		},
		isNonstandard: "Unobtainable",
	},
	blackbelt: {
		inherit: true,
		onBasePower() {},
		onModifyAtkPriority: 1,
		onModifyAtk(atk, user, target, move) {
			if (_optionalChain([move, 'optionalAccess', _ => _.type]) === 'Fighting') {
				return this.chainModify(1.1);
			}
		},
	},
	blackglasses: {
		inherit: true,
		onBasePower() {},
		onModifySpAPriority: 1,
		onModifySpA(spa, user, target, move) {
			if (_optionalChain([move, 'optionalAccess', _2 => _2.type]) === 'Dark') {
				return this.chainModify(1.1);
			}
		},
	},
	charcoal: {
		inherit: true,
		onBasePower() {},
		onModifySpAPriority: 1,
		onModifySpA(spa, user, target, move) {
			if (_optionalChain([move, 'optionalAccess', _3 => _3.type]) === 'Fire') {
				return this.chainModify(1.1);
			}
		},
	},
	dragonfang: {
		inherit: true,
		onBasePower() {},
		onModifySpAPriority: 1,
		onModifySpA(spa, user, target, move) {
			if (_optionalChain([move, 'optionalAccess', _4 => _4.type]) === 'Dragon') {
				return this.chainModify(1.1);
			}
		},
	},
	enigmaberry: {
		name: "Enigma Berry",
		spritenum: 124,
		isBerry: true,
		num: 208,
		gen: 3,
		isNonstandard: "Unobtainable",
	},
	fastball: {
		inherit: true,
		isNonstandard: "Unobtainable",
	},
	figyberry: {
		inherit: true,
		onUpdate() {},
		onResidualOrder: 10,
		onResidualSubOrder: 4,
		onResidual(pokemon) {
			if (pokemon.hp <= pokemon.maxhp / 2) {
				pokemon.eatItem();
			}
		},
	},
	ganlonberry: {
		inherit: true,
		onUpdate() {},
		onResidualOrder: 10,
		onResidualSubOrder: 4,
		onResidual(pokemon) {
			if (pokemon.hp <= pokemon.maxhp / 4) {
				pokemon.eatItem();
			}
		},
	},
	hardstone: {
		inherit: true,
		onBasePower() {},
		onModifyAtkPriority: 1,
		onModifyAtk(atk, user, target, move) {
			if (_optionalChain([move, 'optionalAccess', _5 => _5.type]) === 'Rock') {
				return this.chainModify(1.1);
			}
		},
	},
	heavyball: {
		inherit: true,
		isNonstandard: "Unobtainable",
	},
	iapapaberry: {
		inherit: true,
		onUpdate() {},
		onResidualOrder: 10,
		onResidualSubOrder: 4,
		onResidual(pokemon) {
			if (pokemon.hp <= pokemon.maxhp / 2) {
				pokemon.eatItem();
			}
		},
	},
	kingsrock: {
		inherit: true,
		onModifyMove(move) {
			const affectedByKingsRock = [
				'aerialace', 'aeroblast', 'aircutter', 'armthrust', 'barrage', 'beatup', 'bide', 'bind', 'blastburn', 'bonerush', 'bonemerang', 'bounce', 'brickbreak', 'bulletseed', 'clamp', 'cometpunch', 'crabhammer', 'crosschop', 'cut', 'dig', 'dive', 'doublekick', 'doubleslap', 'doubleedge', 'dragonbreath', 'dragonclaw', 'dragonrage', 'drillpeck', 'earthquake', 'eggbomb', 'endeavor', 'eruption', 'explosion', 'extremespeed', 'falseswipe', 'feintattack', 'firespin', 'flail', 'fly', 'frenzyplant', 'frustration', 'furyattack', 'furycutter', 'furyswipes', 'gust', 'hiddenpower', 'highjumpkick', 'hornattack', 'hydrocannon', 'hydropump', 'hyperbeam', 'iceball', 'iciclespear', 'jumpkick', 'karatechop', 'leafblade', 'lowkick', 'machpunch', 'magicalleaf', 'magnitude', 'megakick', 'megapunch', 'megahorn', 'meteormash', 'mudshot', 'muddywater', 'nightshade', 'outrage', 'overheat', 'payday', 'peck', 'petaldance', 'pinmissile', 'poisontail', 'pound', 'psychoboost', 'psywave', 'quickattack', 'rage', 'rapidspin', 'razorleaf', 'razorwind', 'return', 'revenge', 'reversal', 'rockblast', 'rockthrow', 'rollingkick', 'rollout', 'sandtomb', 'scratch', 'seismictoss', 'selfdestruct', 'shadowpunch', 'shockwave', 'signalbeam', 'silverwind', 'skullbash', 'skyattack', 'skyuppercut', 'slam', 'slash', 'snore', 'solarbeam', 'sonicboom', 'spikecannon', 'spitup', 'steelwing', 'strength', 'struggle', 'submission', 'surf', 'swift', 'tackle', 'takedown', 'thrash', 'tickle', 'triplekick', 'twister', 'uproar', 'visegrip', 'vinewhip', 'vitalthrow', 'volttackle', 'watergun', 'waterpulse', 'waterfall', 'weatherball', 'whirlpool', 'wingattack', 'wrap',
			];
			if (affectedByKingsRock.includes(move.id)) {
				if (!move.secondaries) move.secondaries = [];
				move.secondaries.push({
					chance: 10,
					volatileStatus: 'flinch',
				});
			}
		},
	},
	lansatberry: {
		inherit: true,
		onUpdate() {},
		onResidualOrder: 10,
		onResidualSubOrder: 4,
		onResidual(pokemon) {
			if (pokemon.hp <= pokemon.maxhp / 4) {
				pokemon.eatItem();
			}
		},
	},
	laxincense: {
		inherit: true,
		onModifyAccuracy(accuracy) {
			if (typeof accuracy !== 'number') return;
			this.debug('lax incense - decreasing accuracy');
			return accuracy * 0.95;
		},
	},
	levelball: {
		inherit: true,
		isNonstandard: "Unobtainable",
	},
	liechiberry: {
		inherit: true,
		onUpdate() {},
		onResidualOrder: 10,
		onResidualSubOrder: 4,
		onResidual(pokemon) {
			if (pokemon.hp <= pokemon.maxhp / 4) {
				pokemon.eatItem();
			}
		},
	},
	lightball: {
		inherit: true,
		onModifySpA(spa, pokemon) {
			if (pokemon.species.name === 'Pikachu') {
				return this.chainModify(2);
			}
		},
		onBasePower() {},
	},
	loveball: {
		inherit: true,
		isNonstandard: "Unobtainable",
	},
	lureball: {
		inherit: true,
		isNonstandard: "Unobtainable",
	},
	magnet: {
		inherit: true,
		onBasePower() {},
		onModifySpAPriority: 1,
		onModifySpA(spa, user, target, move) {
			if (_optionalChain([move, 'optionalAccess', _6 => _6.type]) === 'Electric') {
				return this.chainModify(1.1);
			}
		},
	},
	magoberry: {
		inherit: true,
		onUpdate() {},
		onResidualOrder: 10,
		onResidualSubOrder: 4,
		onResidual(pokemon) {
			if (pokemon.hp <= pokemon.maxhp / 2) {
				pokemon.eatItem();
			}
		},
	},
	metalcoat: {
		inherit: true,
		onBasePower() {},
		onModifyAtkPriority: 1,
		onModifyAtk(atk, user, target, move) {
			if (_optionalChain([move, 'optionalAccess', _7 => _7.type]) === 'Steel') {
				return this.chainModify(1.1);
			}
		},
	},
	miracleseed: {
		inherit: true,
		onBasePower() {},
		onModifySpAPriority: 1,
		onModifySpA(spa, user, target, move) {
			if (_optionalChain([move, 'optionalAccess', _8 => _8.type]) === 'Grass') {
				return this.chainModify(1.1);
			}
		},
	},
	moonball: {
		inherit: true,
		isNonstandard: "Unobtainable",
	},
	mysticwater: {
		inherit: true,
		onBasePower() {},
		onModifySpAPriority: 1,
		onModifySpA(spa, user, target, move) {
			if (_optionalChain([move, 'optionalAccess', _9 => _9.type]) === 'Water') {
				return this.chainModify(1.1);
			}
		},
	},
	nevermeltice: {
		inherit: true,
		onBasePower() {},
		onModifySpAPriority: 1,
		onModifySpA(spa, user, target, move) {
			if (_optionalChain([move, 'optionalAccess', _10 => _10.type]) === 'Ice') {
				return this.chainModify(1.1);
			}
		},
	},
	oranberry: {
		inherit: true,
		onUpdate() {},
		onResidualOrder: 10,
		onResidualSubOrder: 4,
		onResidual(pokemon) {
			if (pokemon.hp <= pokemon.maxhp / 2) {
				pokemon.eatItem();
			}
		},
	},
	petayaberry: {
		inherit: true,
		onUpdate() {},
		onResidualOrder: 10,
		onResidualSubOrder: 4,
		onResidual(pokemon) {
			if (pokemon.hp <= pokemon.maxhp / 4) {
				pokemon.eatItem();
			}
		},
	},
	poisonbarb: {
		inherit: true,
		onBasePower() {},
		onModifyAtkPriority: 1,
		onModifyAtk(atk, user, target, move) {
			if (_optionalChain([move, 'optionalAccess', _11 => _11.type]) === 'Poison') {
				return this.chainModify(1.1);
			}
		},
	},
	quickclaw: {
		inherit: true,
		onFractionalPriority() {},
		// implemented in Pokemon#getActionSpeed()
	},
	salacberry: {
		inherit: true,
		onUpdate() {},
		onResidualOrder: 10,
		onResidualSubOrder: 4,
		onResidual(pokemon) {
			if (pokemon.hp <= pokemon.maxhp / 4) {
				pokemon.eatItem();
			}
		},
	},
	seaincense: {
		inherit: true,
		onBasePower() {},
		onModifySpAPriority: 1,
		onModifySpA(spa, user, target, move) {
			if (_optionalChain([move, 'optionalAccess', _12 => _12.type]) === 'Water') {
				return this.chainModify(1.05);
			}
		},
	},
	sharpbeak: {
		inherit: true,
		onBasePower() {},
		onModifyAtkPriority: 1,
		onModifyAtk(atk, user, target, move) {
			if (_optionalChain([move, 'optionalAccess', _13 => _13.type]) === 'Flying') {
				return this.chainModify(1.1);
			}
		},
	},
	silkscarf: {
		inherit: true,
		onBasePower() {},
		onModifyAtkPriority: 1,
		onModifyAtk(atk, user, target, move) {
			if (_optionalChain([move, 'optionalAccess', _14 => _14.type]) === 'Normal') {
				return this.chainModify(1.1);
			}
		},
	},
	silverpowder: {
		inherit: true,
		onBasePower() {},
		onModifyAtkPriority: 1,
		onModifyAtk(atk, user, target, move) {
			if (_optionalChain([move, 'optionalAccess', _15 => _15.type]) === 'Bug') {
				return this.chainModify(1.1);
			}
		},
	},
	sitrusberry: {
		inherit: true,
		onUpdate() {},
		onResidualOrder: 10,
		onResidualSubOrder: 4,
		onResidual(pokemon) {
			if (pokemon.hp <= pokemon.maxhp / 2) {
				pokemon.eatItem();
			}
		},
		onEat(pokemon) {
			this.heal(30);
		},
	},
	softsand: {
		inherit: true,
		onBasePower() {},
		onModifyAtkPriority: 1,
		onModifyAtk(atk, user, target, move) {
			if (_optionalChain([move, 'optionalAccess', _16 => _16.type]) === 'Ground') {
				return this.chainModify(1.1);
			}
		},
	},
	spelltag: {
		inherit: true,
		onBasePower() {},
		onModifyAtkPriority: 1,
		onModifyAtk(atk, user, target, move) {
			if (_optionalChain([move, 'optionalAccess', _17 => _17.type]) === 'Ghost') {
				return this.chainModify(1.1);
			}
		},
	},
	sportball: {
		inherit: true,
		isNonstandard: "Unobtainable",
	},
	starfberry: {
		inherit: true,
		onUpdate() {},
		onResidualOrder: 10,
		onResidualSubOrder: 4,
		onResidual(pokemon) {
			if (pokemon.hp <= pokemon.maxhp / 4) {
				pokemon.eatItem();
			}
		},
	},
	twistedspoon: {
		inherit: true,
		onBasePower() {},
		onModifySpAPriority: 1,
		onModifySpA(spa, user, target, move) {
			if (_optionalChain([move, 'optionalAccess', _18 => _18.type]) === 'Psychic') {
				return this.chainModify(1.1);
			}
		},
	},
	wikiberry: {
		inherit: true,
		onUpdate() {},
		onResidualOrder: 10,
		onResidualSubOrder: 4,
		onResidual(pokemon) {
			if (pokemon.hp <= pokemon.maxhp / 2) {
				pokemon.eatItem();
			}
		},
	},
}; exports.Items = Items;

 //# sourceMappingURL=sourceMaps/items.js.map