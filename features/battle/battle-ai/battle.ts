/*
 * Battle data parsing system
 * Battle Bot 2.0
 */

const MAX_RECURSIVE = 5;
const MIN_TIME_LOCK = 3 * 1000; // 3 secods to avoid send spam

import { majors } from './battle-majors';
import { minors } from './battle-minors';

import { choose } from './modules';
import { getDecisions } from './decision';


import { Player, getPokemon, getItem, getAbility, CurrentGen } from './battle-data';

import { Pokemon } from './calc';

interface Players {
	p1: Player;
	p2: Player;
}

interface LastSend {
	rqid: number;
	time: number;
	decision: any;
}

interface Helpers {
	self: any;
	foe: any;
}

export class Battle {
	id: string;
	title: string = "";
	players: Players = {
		p1: new Player("p1"),
		p2: new Player("p2")
	};
	users = {};

	self: { [key: string]: any } | null = null;
	foe: { [key: string]: any } | null = null;

	gametype: string = "singles";
	gen: number = CurrentGen;
	tier: string = "gen8ou";
	rules = [];
	variations = [];

	started: boolean = false;
	timer: boolean = false;
	sentTimerReq: number = 0;
	turn: number = 0;
	request: { [key: string]: any } | null = null;
	rqid: number = 0;
	teamPreview: number = 1;

	conditions = {};

	file = null;
	stream = null;
	lastSend: LastSend = {
		rqid: -1,
		time: 0,
		decision: null
	};
	lock: boolean = false;
	leaveInterval = null;

	helpers: Helpers = { self: {}, foe: {} };

	constructor(id) {
		this.id = id;
	}

	createLogStream = function (file) {
		fs.writeFileSync(file, ""); // Clear File
		this.stream = fs.createWriteStream(file, { flags: 'a+' });
		this.file = file;
	};

	send = function (data) {
		Bot.sendRoom(this.id, data, 2000);
	};

	eval = function (str) {
		return eval(str);
	};

	sendDecision = function (decision) {
		if (!decision || !decision.length) return;
		debug("Send Decision: ".cyan + JSON.stringify(decision));
		var str = "/choose ";
		for (var i = 0; i < decision.length; i++) {
			switch (decision[i].type) {
				case "team":
					var team = [];
					for (var j = 0; j < decision[i].team.length; j++) team.push(decision[i].team[j] + 1);
					var first = team[0] || 1;
					for (var j = first - 1; j > 0; j--) {
						if (team.indexOf(j) === -1) {
							team.push(j);
						}
					}
					if (this.request?.side?.pokemon) {
						for (var j = 1; j <= this.request.side.pokemon.length; j++) {
							if (team.indexOf(j) === -1) {
								team.push(j);
							}
						}
					}
					str += "team " + team.join("");
					break;
				case "move":
					str += "move " + (decision[i].moveId + 1);
					const transformation = decision[i].transformation;
					if (typeof transformation === 'string') {
						str += (" " + decision[i].transformation);
					} else if (transformation) {
						str += (" " + Object.keys(decision[i].transformation)[0]);
					}
					if (decision[i].target !== null) {
						if (decision[i].target >= 0) str += " " + (decision[i].target + 1);
						else str += (" " + (decision[i].target));
					}
					break;
				case "switch":
					str += "switch " + (decision[i].pokeId + 1);
					break;
				case "pass":
					str += "pass";
					break;
				case "shift":
					str += "shift";
					break;
			}
			if (i < decision.length - 1) str += ", ";
		}
		this.lastSend = {
			rqid: this.rqid,
			time: Date.now(),
			decision: decision
		};
		this.send(str + "|" + this.rqid);
	};

	checkTimer = function () {
		if (!this.self || !this.request) return; // Not playing
		if (!this.timer) {
			if (this.sentTimerReq && Date.now() - this.sentTimerReq < MIN_TIME_LOCK) return; // Do not spam timer commands
			this.sentTimerReq = Date.now();
			if (!this.tier.endsWith("survival")) this.send("/timer on");
		}
	};

	leave = function () {
		if (!this.leaveInterval) {
			this.leaveInterval = setInterval(function () {
				this.send("/leave");
			}.bind(this), 5000);
		}
		this.send('/leave');
	};

	start = function () {
		if (!this.self || !this.request) return; // Not playing
		var wmsg = Config.initBattleMsg;
		if (wmsg && wmsg.length) {
			var msg = wmsg[Math.floor(Math.random() * wmsg.length)];
			msg = msg.replace(/#date/g, (new Date()).toString().split(' GMT')[0]);
			msg = msg.replace(/#battleid/g, 'battle-' + this.id.split('-')[2]);
			this.send(msg);
		}
	};

	win = function (winner) {
		if (!this.self) return; // Not playing
		var win = (toId(winner) === toId(Bot.status.nickName));
		if (win) {
			var winmsg = Config.winmsg;
			if (winmsg && winmsg.length) {
				var msg = winmsg[Math.floor(Math.random() * winmsg.length)];
				msg = msg.replace(/#date/g, (new Date()).toString().split(' GMT')[0]);
				msg = msg.replace(/#battleid/g, 'battle-' + this.id.split('-')[2]);
				this.send(msg);
			}
		} else {
			var losemsg = Config.losemsg;
			if (losemsg && losemsg.length) {
				var msg = losemsg[Math.floor(Math.random() * losemsg.length)];
				msg = msg.replace(/#date/g, (new Date()).toString().split(' GMT')[0]);
				msg = msg.replace(/#battleid/g, 'battle-' + this.id.split('-')[2]);
				this.send(msg);
			}
		}
	};

	message = function (type, player, poke) {
		if (!this.self) return; // Not playing
		if (!Config.battleMessages || !Config.battleMessages[type]) return;

		if (!player) {
			if (Config.battleMessages[type]["self"]) {
				this.send(Config.battleMessages[type]["self"][Math.floor(Math.random() * Config.battleMessages[type]["self"].length)]);
				return;
			}
			this.send(Config.battleMessages[type][Math.floor(Math.random() * Config.battleMessages[type].length)]);
			return;
		}

		var side = (player === this.self.id) ? "self" : "foe";
		if (Config.battleMessages[type][side]) {
			if (type === 'faint') {
				const lost = this.self.pokemon.all(poke => poke.fainted);
				if (lost) return;
			}
			var msg = Config.battleMessages[type][side][Math.floor(Math.random() * Config.battleMessages[type][side].length)];
			if (poke) msg = msg.replace(/#poke/g, poke);
			this.send(msg);
		}
	};

	makeDecision = function (forced) {
		if (!this.self) return; // Not playing
		debug(this.id + "->MakeDecision");
		if (!forced && this.lastSend.rqid >= 0 && this.lastSend.rqid === this.rqid) {
			if (Date.now() - this.lastSend.time < MIN_TIME_LOCK) return;
			if (this.lastSend.decision) {
				this.sendDecision(this.lastSend.decision);
				return;
			}
		}
		if (this.lock) return;
		this.lock = true;
		debug("Making decisions - " + this.id);
		var decisions, mod;
		try {
			decisions = getDecisions(this);
		} catch (e) {
			debug(e.stack);
			debug("Decision maker crashed: " + sys.inspect(e));
			SecurityLog.log("BATTLE D.M. CRASH: " + e.message + "\n" + e.stack);
			this.lock = false;
			return;
		}
		if (!decisions || !decisions.length) {
			debug("Nothing to do: " + this.id);
			this.lock = false;
			return;
		}
		try {
			mod = choose(this);
			if (mod) {
				var decision = mod.decide(this, decisions);
				if (decision instanceof Array) {
					this.lock = false;
					this.sendDecision(decision);
					return;
				}
			}
		} catch (e2) {
			errlog(e2.message);
			errlog(e2.stack);
			error("Module failed: " + mod.id + " | " + sys.inspect(e2));
			SecurityLog.log("BATTLE MODULE FAILED: " + e2.message + "\nmodule: " + mod.id + "\n" + e2.stack);
		}
		this.lock = false;
		this.sendDecision(decisions[Math.floor(Math.random() * decisions.length)]);
	};

	log = function (line) {
		if (this.stream) {
			this.stream.write(line + "\n");
		}
	};

	add = function (line, isIntro) {
		this.run(line, isIntro);
		this.log(line);
	};

	run = function (str, isIntro) {
		if (!str) return;
		if (str.charAt(0) !== '|' || str.substr(0, 2) === '||') {
			return;
		} else {
			var args = ['done'], kwargs = {};
			if (str !== '|') {
				args = str.substr(1).split('|');
			}
			while (args[args.length - 1] && args[args.length - 1].substr(0, 1) === '[') {
				var bracketPos = args[args.length - 1].indexOf(']');
				if (bracketPos <= 0) break;
				var argstr = args.pop();
				// default to '.' so it evaluates to boolean true
				kwargs[argstr.substr(1, bracketPos - 1)] = ((argstr.substr(bracketPos + 1)).trim() || '.');
			}
			if (args[0].substr(0, 1) === '-') {
				this.runMinor(args, kwargs, isIntro);
			} else {
				this.runMajor(args, kwargs, isIntro);
			}
		}
	};

	runMinor = function (args, kwargs, isIntro) {
		if (args) {
			if (args[2] === 'Sturdy' && args[0] === '-activate') args[2] = 'ability: Sturdy';
		}
		if (minors[args[0]]) {
			var minor = minors[args[0]];
			var r = 0;
			while (typeof minor === "string" && r <= MAX_RECURSIVE) {
				minor = minors[minor];
			}
			if (typeof minor !== "function") {
				error("Unknown minor type: " + args[0] + " - " + sys.inspect(minor) + "");
			} else {
				try {
					minor.call(this, args, kwargs, isIntro);
				} catch (e) {
					errlog(e.message);
					errlog(e.stack);
					error("Minor failed | Battle id: " + this.id + " | Minor: " + args[0]);
					SecurityLog.log("MINOR FAILED: " + e.message + "\nargs: " + args.join("|") + "\nkwargs: " + JSON.stringify(kwargs) + "\nroom: " + this.id + "\n" + e.stack);
				}
			}
		}
	};

	runMajor = function (args, kwargs, isIntro) {
		if (majors[args[0]]) {
			var major = majors[args[0]];
			var r = 0;
			while (typeof major === "string" && r <= MAX_RECURSIVE) {
				major = majors[major];
			}
			if (typeof major !== "function") {
				error("Unknown major type: " + args[0] + " - " + sys.inspect(major) + "");
			} else {
				try {
					major.call(this, args, kwargs, isIntro);
				} catch (e) {
					errlog(e.message);
					errlog(e.stack);
					error("Major failed | Battle id: " + this.id + " | Major: " + args[0]);
					SecurityLog.log("MAJOR FAILED: " + e.message + "\nargs: " + args.join("|") + "\nkwargs: " + JSON.stringify(kwargs) + "\nroom: " + this.id + "\n" + e.stack);
				}
			}
		}
	};

	parseDetails = function (str) {
		if (!str) return null;
		var details = str.split(",");
		for (var d = 0; d < details.length; d++)
			details[d] = details[d].trim();
		var poke = {
			species: "",
			level: 100,
			shiny: false,
			gender: false
		};
		if (details[details.length - 1] === "shiny") {
			poke.shiny = true;
			details.pop();
		}
		if (details[details.length - 1] === "M" || details[details.length - 1] === "F") {
			poke.gender = details[details.length - 1];
			details.pop();
		}
		if (details[1]) {
			poke.level = parseInt(details[1].substr(1), 10) || 100;
		}
		if (details[0]) {
			poke.species = details[0];
		}
		return poke;
	};

	parseSlot = function (id) {
		var slots = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5 };
		return slots[id] || 0;
	};

	parseStatus = function (str) {
		var status = {
			hp: 100,
			status: false
		};
		var sp = str.split(" ");
		if (sp[1]) status.status = toId(sp[1]);
		sp = sp[0].split("/");
		if (sp.length === 2) {
			var d = parseInt(sp[1]);
			if (d) {
				status.hp = parseInt(sp[0]) * 100 / d;
			}
		} else {
			status.hp = parseInt(sp[0]) || 0;
		}
		return status;
	};

	parseHealth = function (str) {
		var hp = 100;
		var sp = str.split(" ");
		sp = sp[0].split("/");
		if (sp.length === 2) {
			var d = parseInt(sp[1]);
			if (d) {
				hp = parseInt(sp[0]) * 100 / d;
			}
		} else {
			hp = parseInt(sp[0]) || 0;
		}
		return hp;
	};

	getSide = function (str) {
		if (!str) return null;
		str = str.split(":")[0];
		return this.players[str];
	};

	getActive = function (str) {
		if (!str) return null;
		var side = str.substr(0, 2);
		str = str.substr(2);
		var pokeId = str.substr(0, 1);
		var slot = this.parseSlot(pokeId);
		str = str.substr(1);
		var name = Tools.toName(str.substr(1));
		if (this.players[side]?.active?.[slot]) {
			this.players[side].active[slot].name = name;
			return this.players[side].active[slot];
		}
		return null;
	};

	parsePokemonIdent = function (str) {
		if (!str) return null;
		var side = str.substr(0, 2);
		str = str.substr(2);
		var pokeId = str.substr(0, 1);
		var slot = this.parseSlot(pokeId);
		str = str.substr(1);
		var name = Tools.toName(str.substr(1));
		return {
			side: side,
			slot: slot,
			name: name
		};
	};

	getCalcRequestPokemon = function (sideId, forceMega) {
		var p = this.request.side.pokemon[sideId];
		var details = this.parseDetails(p.details);
		var condition = this.parseStatus(p.condition);

		let side = (toId(this.request.side.name) === toId(Bot.status.nickName)) ? 'self' : 'foe';
		let pokeId = p.ident.split(': ')[1] + '|' + details.species;

		var pokeA = new Pokemon(
			getPokemon(details.species, this.gen, this.id),
			{ level: details.level, shiny: details.shiny, gender: details.gender, helpers: (this.helpers[side][pokeId] || {}) },
		);
		pokeA.item = getItem(p.item, this.gen);
		pokeA.ability = getAbility(p.baseAbility, this.gen);
		pokeA.status = condition.status;
		pokeA.hp = condition.hp;
		pokeA.stats = p.stats;
		if (forceMega && (p.canMegaEvo || (this.request.active?.[sideId]?.canMegaEvo))) {
			if (pokeA.item.megaStone) {
				pokeA.template = getPokemon(pokeA.item.megaStone, this.gen, this.id);
				pokeA.species = pokeA.template.species;
				pokeA.ability = getAbility(pokeA.template.abilities[0]);
			}
		}
		return pokeA;
	};

	destroy = function () {
		if (this.stream) {
			this.stream.close();
			this.stream = null;
		}
		if (this.leaveInterval) {
			clearInterval(this.leaveInterval);
			this.leaveInterval = null;
		}
	};
};
