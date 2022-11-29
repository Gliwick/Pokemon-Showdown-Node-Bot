/*
	Majors
*/

import { Move, Pokemon, getPokemon, getMove, getEffect } from './battle-data';

export const majors: { [key: string]: ((args: string[], kwargs: { [key: string]: string }, isIntro?: boolean) => void) | string } = {
	rated: function (args, kwargs) {
		this.rated = true;
	},

	request: function (args, kwargs) {
		args.shift();
		this.request = {};
		args = args.join("|");
		if (args.length) this.request = JSON.parse(args);
		this.rqid = this.request ? this.request.rqid : -1;
	},

	start: function (args, kwargs) {
		this.started = true;
		this.checkTimer();
	},

	turn: function (args, kwargs) {
		this.turn = parseInt(args[1]) || 0;
		this.checkTimer();
		this.makeDecision();
	},

	upkeep: function (args, kwargs) {
		this.checkTimer();
		this.makeDecision();
	},

	tier: function (args, kwargs) {
		if (!args[1]) args[1] = '';
		for (let key in kwargs) args[1] += '[' + key + '] ' + kwargs[key];
		this.tier = args[1];
		if (toId(this.tier) === "inversebattle") {
			this.conditions["inversebattle"] = true;
		}
		this.start();
	},

	gametype: function (args, kwargs) {
		this.gametype = args[1];
		this.conditions["gametype"] = args[1];
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

	variation: function (args, kwargs) {
		this.variations.push(args[1]);
	},

	rule: function (args, kwargs) {
		this.rules.push(args[1].split(':')[0]);
	},

	inactive: function (args, kwargs) {
		this.timer = true;
		if (args[1]) {
			if (args[1].indexOf("Battle timer is ON") === 0 || args[1].indexOf("You have") === 0 || toId(args[1]).indexOf(toId(Bot.status.nickName)) >= 0) this.makeDecision();
		}
	},

	inactiveoff: function (args, kwargs) {
		this.timer = false;
	},

	j: "join",
	join: function (args, kwargs) {
		this.users[toId(args[1])] = args[1];
	},

	l: "leave",
	leave: function (args, kwargs) {
		if (this.users[toId(args[1])]) delete this.users[toId(args[1])];
	},

	player: function (args, kwargs) {
		const id = args[1];
		const name = args[2];
		const avatar = args[3];
		if (this.players[id]) {
			this.players[id].setName(name || "");
			this.players[id].avatar = avatar || 0;
			if (this.players[id].userid) {
				if (this.players[id].userid === toId(Bot.status.nickName)) {
					this.self = this.players[id];
				} else {
					this.foe = this.players[id];
				}
			}
		}
	},

	win: function (args, kwargs, isIntro?: boolean) {
		if (!isIntro) this.win(args[1]);
		this.ended = true;
		this.leave();
	},

	tie: function (args, kwargs, isIntro?: boolean) {
		this.ended = true;
		if (!isIntro) this.message("tie");
		this.leave();
	},

	prematureend: function (args, kwargs) {
		this.ended = true;
		this.leave();
	},

	clearpoke: function (args, kwargs) {
		this.players.p1.teamPv = [];
		this.players.p2.teamPv = [];
		for (let i = 0; i < this.players.p1.active.length; i++) {
			this.players.p1.active[i] = null;
			this.players.p1.active[i] = null;
		}
	},

	poke: function (args, kwargs) {
		const p = args[1];
		if (!this.players[p]) return;
		this.players[p].teamPv.push(this.parseDetails(args[2]));
	},

	detailschange: function (args, kwargs) {
		const poke = this.getActive(args[1]);
		const details = this.parseDetails(args[2]);
		poke.removeVolatile('formechange');
		poke.removeVolatile('typeadd');
		poke.removeVolatile('typechange');
		for (let attr in details) poke[attr] = details[attr];
		poke.template = getPokemon(details.species, this.gen, this.id);
	},

	teampreview: function (args, kwargs) {
		if (args[1]) this.teamPreview = parseInt(args[1]) || 1;
		this.makeDecision();
		this.checkTimer();
	},

	drag: "switch",
	"replace": "switch",
	"switch": function (args, kwargs) {
		const spl = args[1].split(": ");
		const p = spl[0].substr(0, 2);
		const slot = this.parseSlot(spl[0].substr(2, 1));
		const name = Tools.toName(spl[1]);
		const details = this.parseDetails(args[2]);
		const health = this.parseStatus(args[3]);
		/* Get the pokemon or create a new one */
		let poke: Pokemon | null = null;
		for (let i = 0; i < this.players[p].pokemon.length; i++) {
			if (this.players[p].pokemon[i].name === name) poke = this.players[p].pokemon[i];
		}
		if (!poke) {
			poke = new Pokemon(getPokemon(details.species, this.gen, this.id), { name: name });
			this.players[p].pokemon.push(poke);
		}
		poke.active = true;
		poke.slot = slot;
		for (let attr in details) {
			poke[attr] = details[attr];
		}
		poke.hp = health.hp;
		poke.status = health.status;
		poke.helpers.sw = this.turn;
		/* Get the active */
		const active = this.players[p].active[slot];
		if (!active) {
			/* Forced switch */
			this.players[p].active[slot] = poke;
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
				for (let vol in active.volatiles) poke.addVolatile(vol);
				for (let b in active.boosts) poke.boosts[b] = active.boosts[b];
				active.passing = false;
			}
			active.removeAllVolatiles();
			active.removeAllBoosts();
			if (active.transformed) active.unTransform();
			active.supressedAbility = false;
			active.ability = active.baseAbility;
			active.active = false;
			active.slot = -1;
			this.players[p].active[slot] = poke;
		}
	},

	faint: function (args, kwargs, isIntro?: boolean) {
		const poke = this.getActive(args[1]);
		const det = this.parsePokemonIdent(args[1]);
		poke.fainted = true;
		poke.active = false;
		poke.passing = false;
		poke.hp = 0;
		if (!isIntro) this.message("faint", det.side, poke.name);
	},

	swap: function (args, kwargs) {
		const poke = this.parsePokemonIdent(args[1]);
		const to = parseInt(args[2]) || 0;
		const player = this.players[poke.side];
		const temp = player.active[poke.slot];
		player.active[poke.slot] = player.active[to];
		player.active[to] = temp;
	},

	move: function (args, kwargs) {
		const poke = this.getActive(args[1]);
		const det = this.parsePokemonIdent(args[1]);
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
			this.players[det.side].side.wish = {
				move: move.id,
				turn: this.turn,
				poke: poke
			};
		}
		if (move.id === 'batonpass') {
			poke.passing = this.turn;
		}
		if (!noDeductPP && kwargs.from !== 'lockedmove') {
			if (args[1] !== args[3] && poke2 && poke2.ability && poke2.ability.id === "pressure") {
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

	cant: function (args, kwargs, isIntro?: boolean) {
		const poke = this.getActive(args[1]);
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
				if (!isIntro) this.message(effect.id, det.side, poke.name); // hax
				return;
			case 'par':
			case 'frz':
			case 'flinch':
			case 'attract':
				if (!isIntro) this.message(effect.id, det.side, poke.name); // hax
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

	gen: function (args, kwargs) {
		this.gen = parseInt(args[1], 10);
	},

	title: function (args, kwargs) {
		this.title = parseInt(args[1], 10);
	},

	callback: function (args, kwargs) {
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
