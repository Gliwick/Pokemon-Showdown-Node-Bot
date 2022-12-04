/*
	Majors
*/

import { toId } from '../../../tools';
import { Battle, BattleType, Side } from './battle';
import { Move, Pokemon, getPokemon, getMove, getEffect, BoostedStat } from './battle-data';

export const majors: { [key: string]: ((args: string[], kwargs: { [key: string]: string }, isIntro) => void) | string } = {
	rated: function (this: Battle, args, kwargs) {
		this.rated = true;
	},

	request: function (this: Battle, args, kwargs) {
		args.shift();
		this.request = {};
		const arg = args.join("|");
		if (arg.length) this.request = JSON.parse(arg);
		this.rqid = this.request ? this.request.rqid : -1;
	},

	start: function (this: Battle, args, kwargs) {
		this.started = true;
		this.checkTimer();
	},

	turn: function (this: Battle, args, kwargs) {
		this.turn = parseInt(args[1]) || 0;
		this.checkTimer();
		this.makeDecision();
	},

	upkeep: function (this: Battle, args, kwargs) {
		this.checkTimer();
		this.makeDecision();
	},

	tier: function (this: Battle, args, kwargs) {
		if (!args[1]) args[1] = '';
		for (let key in kwargs) args[1] += '[' + key + '] ' + kwargs[key];
		this.tier = args[1];
		if (toId(this.tier).indexOf("inversebattle") >= 0) {
			this.conditions["inversebattle"] = true;
		}
		this.start();
	},

	gametype: function (this: Battle, args, kwargs) {
		if (!(args[1] in BattleType)) {
			error('Unknown battle type: ' + args[1]);
			return;
		}

		this.gametype = BattleType[args[1] as keyof typeof BattleType];
		this.conditions["gametype"] = this.gametype;
		switch (args[1]) {
			default:
				this.players.p1.active = [null];
				this.players.p2.active = [null];
				break;
			case 'doubles':
				this.players.p1.active = [null, null];
				this.players.p2.active = [null, null];
				break;
			case 'triples':
			case 'rotation':
				this.players.p1.active = [null, null, null];
				this.players.p2.active = [null, null, null];
				break;
		}
	},

	variation: function (this: Battle, args, kwargs) {
		this.variations.push(args[1]);
	},

	rule: function (this: Battle, args, kwargs) {
		this.rules.push(args[1].split(':')[0]);
	},

	inactive: function (this: Battle, args, kwargs) {
		this.timer = true;
		if (args[1]) {
			if (args[1].indexOf("Battle timer is ON") === 0 || args[1].indexOf("You have") === 0 || toId(args[1]).indexOf(toId(Bot.status.nickName)) >= 0) this.makeDecision();
		}
	},

	inactiveoff: function (this: Battle, args, kwargs) {
		this.timer = false;
	},

	j: "join",
	join: function (this: Battle, args, kwargs) {
		this.users[toId(args[1])] = args[1];
	},

	l: "leave",
	leave: function (this: Battle, args, kwargs) {
		if (this.users[toId(args[1])]) delete this.users[toId(args[1])];
	},

	player: function (this: Battle, args, kwargs) {
		const id = args[1];
		if (!(id in this.players)) {
			error('Unknown side: ' + id);
			return;
		}

		const name = args[2];
		const avatar = args[3];
		const player = this.players[id as Side];
		if (player) {
			player.setName(name || "");
			player.avatar = avatar || 0;
			if (player.userid) {
				if (player.userid === toId(Bot.status.nickName)) {
					this.self = player;
				} else {
					this.foe = player;
				}
			}
		}
	},

	win: function (this: Battle, args, kwargs, isIntro) {
		if (!isIntro) this.win(args[1]);
		this.ended = true;
		this.leave();
	},

	tie: function (this: Battle, args, kwargs, isIntro) {
		this.ended = true;
		if (!isIntro) this.message("tie");
		this.leave();
	},

	prematureend: function (this: Battle, args, kwargs) {
		this.ended = true;
		this.leave();
	},

	clearpoke: function (this: Battle, args, kwargs) {
		this.players.p1.teamPv = [];
		this.players.p2.teamPv = [];
		for (let i = 0; i < this.players.p1.active.length; i++) {
			this.players.p1.active[i] = null;
			this.players.p1.active[i] = null;
		}
	},

	poke: function (this: Battle, args, kwargs) {
		const p = args[1];
		if (!(p in this.players)) {
			error('Unknown side: ' + p);
			return;
		}

		this.players[p as Side].teamPv.push(this.parseDetails(args[2]));
	},

	detailschange: function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		if (!poke) return;

		poke.removeVolatile('formechange');
		poke.removeVolatile('typeadd');
		poke.removeVolatile('typechange');

		const details = this.parseDetails(args[2]);
		if (!details) return;

		Object.assign(poke, details);
		poke.template = getPokemon(details.species, this.gen, this.id);
	},

	teampreview: function (this: Battle, args, kwargs) {
		if (args[1]) this.teamPreview = parseInt(args[1]) || 1;
		this.makeDecision();
		this.checkTimer();
	},

	drag: "switch",
	"replace": "switch",
	"switch": function (this: Battle, args, kwargs) {
		const spl = args[1].split(": ");
		const p = spl[0].substr(0, 2);
		if (!(p in this.players)) {
			error('Unknown side: ' + p);
			return;
		}

		const slot = this.parseSlot(spl[0].substr(2, 1));
		const name = Tools.toName(spl[1]);
		const details = this.parseDetails(args[2]);
		const health = this.parseStatus(args[3]);
		const player = this.players[p as Side];
		/* Get the pokemon or create a new one */
		let poke: Pokemon | null = null;
		for (let i = 0; i < player.pokemon.length; i++) {
			if (player.pokemon[i].name === name) poke = player.pokemon[i];
		}
		if (!poke) {
			poke = new Pokemon(getPokemon(details?.species || '', this.gen, this.id), { name: name });
			player.pokemon.push(poke);
		}
		poke.active = true;
		poke.slot = slot;
		Object.assign(poke, details);
		poke.hp = health.hp;
		poke.status = health.status;
		poke.helpers.sw = this.turn;
		/* Get the active */
		const active = player.active[slot];
		if (!active) {
			/* Forced switch */
			player.active[slot] = poke;
		} else {
			/* Normal switch */
			if (active.passing && active.passing === this.turn) {
				/* Pass the boost and volatiles */
				active.removeVolatile('airballoon');
				active.removeVolatile('attract');
				active.removeVolatile('autotomize');
				active.removeVolatile('disable');
				active.removeVolatile('foresight');
				active.removeVolatile('imprison');
				active.removeVolatile('mimic');
				active.removeVolatile('miracleeye');
				active.removeVolatile('smackdown');
				active.removeVolatile('torment');
				active.removeVolatile('typeadd');
				active.removeVolatile('typechange');
				active.removeVolatile('yawn');
				active.removeVolatile('transform');
				active.removeVolatile('formechange');
				for (let vol in active.volatiles) {
					poke.addVolatile(vol);
				}
				let stat: BoostedStat;
				for (stat in active.boosts) {
					poke.boosts[stat] = active.boosts[stat];
				}
				active.passing = null;
			}
			active.removeAllVolatiles();
			active.removeAllBoosts();
			if (active.transformed) active.unTransform();
			active.supressedAbility = false;
			active.ability = active.baseAbility;
			active.active = false;
			active.slot = -1;
			player.active[slot] = poke;
		}
	},

	faint: function (this: Battle, args, kwargs, isIntro) {
		const poke = this.getActive(args[1]);
		if (!poke) return;

		const det = this.parsePokemonIdent(args[1]);
		poke.fainted = true;
		poke.active = false;
		poke.passing = null;
		poke.hp = 0;
		if (!isIntro) this.message("faint", det?.side, poke.name);
	},

	swap: function (this: Battle, args, kwargs) {
		const poke = this.parsePokemonIdent(args[1]);
		if (!poke) return;

		const to = parseInt(args[2]) || 0;
		if (!(poke.side in this.players)) {
			error('Unknown side: ' + poke.side);
			return;
		}

		const player = this.players[poke.side as Side];
		const temp = player.active[poke.slot];
		player.active[poke.slot] = player.active[to];
		player.active[to] = temp;
	},

	move: function (this: Battle, args, kwargs) {
		const poke = this.getActive(args[1]);
		if (!poke) return;

		const poke2 = this.getActive(args[3]);
		const moveTemplate = getMove(args[2], this.gen, this.id);
		let fromeffect = null;
		let noDeductPP = false;
		if (kwargs.from) fromeffect = getEffect(kwargs.from, this.gen);
		if (fromeffect) {
			switch (fromeffect.id) {
				case 'snatch':
				case 'magicbounce':
				case 'magiccoat':
				case 'rebound':
				case 'metronome':
				case 'naturepower':
					return; // Not a real move
				case 'sleeptalk':
					noDeductPP = true; // Real move, but not really used
					break;
			}
		}
		let move: Move | null = null;
		for (let i = 0; i < poke.moves.length; i++) {
			if (poke.moves[i].id === moveTemplate.id) {
				move = poke.moves[i];
				break;
			}
		}
		if (!move) {
			move = new Move(moveTemplate);
			if (poke.transformed) move.pp = 5;
			poke.moves.push(move);
		}
		if (move.id === 'wish' || move.id === 'healingwish' || move.id === 'lunardance') {
			const det = this.parsePokemonIdent(args[1]);
			if (!det || !(det.side in this.players)) {
				error('Unknown side: ' + det?.side);
			} else {
				this.players[det.side as Side].side.wish = {
					move: move.id,
					turn: this.turn,
					poke: poke
				};
			}
		}
		if (move.id === 'batonpass') {
			poke.passing = this.turn;
		}
		if (!noDeductPP && kwargs.from !== 'lockedmove') {
			if (args[1] !== args[3] && typeof poke2?.ability !== 'string' && poke2?.ability?.id === "pressure") {
				move.pp -= 2;
			} else {
				move.pp--;
			}
		} else {
			poke.prepared = null;
		}
		poke.helpers.lastMove = move.id;
		poke.helpers.lastMoveTurn = this.turn;
	},

	cant: function (this: Battle, args, kwargs, isIntro) {
		const poke = this.getActive(args[1]);
		if (!poke) return;

		const effect = getEffect(args[2], this.gen);
		const moveTemplate = getMove(args[3] || "", this.gen, this.id);
		const det = this.parsePokemonIdent(args[1]);
		switch (effect.id) {
			case 'taunt':
			case 'gravity':
			case 'healblock':
			case 'imprison':
			case 'skydrop':
			case 'recharge':
			case 'focuspunch':
			case 'nopp':
				break;
			case 'slp':
				if (!poke.helpers.sleepCounter) poke.helpers.sleepCounter = 0;
				poke.helpers.sleepCounter++;
				if (!isIntro) this.message(effect.id, det?.side, poke.name); // hax
				return;
			case 'par':
			case 'frz':
			case 'flinch':
			case 'attract':
				if (!isIntro) this.message(effect.id, det?.side, poke.name); // hax
				return; // No move
		}
		let move: Move | null = null;
		for (let i = 0; i < poke.moves.length; i++) {
			if (poke.moves[i].id === moveTemplate.id) {
				move = poke.moves[i];
				break;
			}
		}
		if (!move) {
			move = new Move(moveTemplate);
			if (poke.transformed) move.pp = 5;
			poke.moves.push(move);
		}
	},

	gen: function (this: Battle, args, kwargs) {
		this.gen = parseInt(args[1], 10);
	},

	title: function (this: Battle, args, kwargs) {
		this.title = parseInt(args[1], 10);
	},

	callback: function (this: Battle, args, kwargs) {
		if (!this.request) {
			error('No request received yet');
			return;
		}

		args.shift();
		const pokemon = isNaN(Number(args[1])) ? this.getActive(args[1]) : this.self.active[args[1]];
		const requestData = this.request.active[pokemon.slot];
		switch (args[0]) {
			case 'trapped':
				requestData.trapped = true;
				break;
			case 'cant':
				for (let i = 0; i < requestData.moves.length; i++) {
					if (requestData.moves[i].id === args[3]) {
						requestData.moves[i].disabled = true;
					}
				}
				break;
		}
		this.makeDecision(true);
	},
};
