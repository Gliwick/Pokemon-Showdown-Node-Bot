/*
 * Battle manager
 */

const battleAutojoinFile = AppOptions.data + "_temp/" + "battle-autojoin-tmp.json";

import { debug } from "../../../console-reports";
import { Battle } from "./battle";

import { createStream } from "./battle-log";

export class BattleBot {
	battles: Record<string, Battle> = {};
	battlesCount = 0;

	autojoinFFM;
	autoJoinData = {};

	constructor() {
		this.autojoinFFM = new Settings.FlatFileManager(battleAutojoinFile);
	};

	init() {
		for (let room in this.battles) {
			try {
				this.battles[room].destroy();
			} catch (e) { }
			delete this.battles[room];
		}
		this.battlesCount = 0;
	};

	tryJoinAbandonedBattles() {
		if (!Config.abandonedBattleAutojoin) return;
		try {
			this.autoJoinData = this.autojoinFFM.readObj();
		} catch (e) { error(e.stack); }
		debug(JSON.stringify(this.autoJoinData));
		const cmds: string[] = [];
		for (let i in this.autoJoinData) {
			if (!this.battles[i]) {
				cmds.push('|/join ' + i);
				cmds.push(i + '|/joinbattle');
			}
			delete this.autoJoinData[i];
		}
		this.autojoinFFM.writeObj(this.autoJoinData);
		return cmds;
	};

	updateBattleAutojoin() {
		if (!Config.abandonedBattleAutojoin) return;
		for (let i in this.autoJoinData) {
			delete this.autoJoinData[i];
		}
		for (let room in this.battles) {
			this.autoJoinData[room] = 1;
		}
		this.autojoinFFM.writeObj(this.autoJoinData);
	};

	receive(room, data, isIntro?: boolean) {
		if (data.charAt(0) === ">") return;
		const spl = data.substr(1).split("|");
		if (spl[0] === 'init') {
			if (this.battles[room]) {
				try {
					this.battles[room].destroy();
				} catch (e) { }
			}
			this.battles[room] = new Battle(room);
			createStream(this.battles[room]);
			this.battlesCount++;
			this.updateBattleAutojoin();
		}
		if (this.battles[room]) {
			this.battles[room].add(data, isIntro);
		}
		if (spl[0] === 'deinit' || spl[0] === 'expire') {
			if (this.battles[room]) {
				try {
					this.battles[room].destroy();
				} catch (e) { }
				delete this.battles[room];
				this.battlesCount--;
				this.updateBattleAutojoin();
			}
		}
	};

	destroy() {
		for (let room in this.battles) {
			try {
				this.battles[room].destroy();
			} catch (e) { }
			delete this.battles[room];
			this.battlesCount--;
		}
	}
};