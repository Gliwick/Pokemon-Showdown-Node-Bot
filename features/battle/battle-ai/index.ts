/*
 * Battle manager
 */

const battleAutojoinFile = AppOptions.data + '_temp/' + 'battle-autojoin-tmp.json';

import { FlatFileManager } from '../../../bll/settings';
import { debug, error } from '../../../log';
import { Battle } from './battle';
import { createStream } from './battle-log';

export class BattleBot {
	battles: Record<string, Battle> = {};
	battlesCount = 0;

	autojoinFFM: FlatFileManager;
	autoJoinData: Record<string, number> = {};

	constructor() {
		this.autojoinFFM = new FlatFileManager(battleAutojoinFile);
	}

	init(): void {
		for (const room in this.battles) {
			try {
				this.battles[room].destroy();
			} catch (e) {}
			delete this.battles[room];
		}
		this.battlesCount = 0;
	}

	tryJoinAbandonedBattles(): string[] {
		if (!Config.abandonedBattleAutojoin) return [];
		try {
			this.autoJoinData = this.autojoinFFM.readObj();
		} catch (e: any) {
			error(e.stack);
		}
		debug(JSON.stringify(this.autoJoinData));
		const cmds: string[] = [];
		for (const i in this.autoJoinData) {
			if (!this.battles[i]) {
				cmds.push('|/join ' + i);
				cmds.push(i + '|/joinbattle');
			}
			delete this.autoJoinData[i];
		}
		this.autojoinFFM.writeObj(this.autoJoinData);
		return cmds;
	}

	updateBattleAutojoin(): void {
		if (!Config.abandonedBattleAutojoin) return;
		for (const i in this.autoJoinData) {
			delete this.autoJoinData[i];
		}
		for (const room in this.battles) {
			this.autoJoinData[room] = 1;
		}
		this.autojoinFFM.writeObj(this.autoJoinData);
	}

	receive(room: string, data: string, isIntro?: boolean): void {
		if (data.charAt(0) === '>') return;
		const spl = data.substr(1).split('|');
		if (spl[0] === 'init') {
			if (this.battles[room]) {
				try {
					this.battles[room].destroy();
				} catch (e) {}
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
				} catch (e) {}
				delete this.battles[room];
				this.battlesCount--;
				this.updateBattleAutojoin();
			}
		}
	}

	destroy(): void {
		for (const room in this.battles) {
			try {
				this.battles[room].destroy();
			} catch (e) {}
			delete this.battles[room];
			this.battlesCount--;
		}
	}
}
