/*
 * Battle manager
 */

const battleAutojoinFile = AppOptions.data + '_temp/' + 'battle-autojoin-tmp.json';

import { debug, error } from '../../../log';
import { FlatFileManager } from '../../../settings';
import { Battle } from './battle';
import { createStream } from './battle-log';
import { ModuleManager } from './modules';

export class BattleBot {
	battles: Record<string, Battle> = {};
	battlesCount = 0;

	autojoinFFM: FlatFileManager;
	autoJoinData: Record<string, number> = {};

	moduleManager: ModuleManager;

	constructor() {
		this.autojoinFFM = new FlatFileManager(battleAutojoinFile);
		this.moduleManager = new ModuleManager();
	}

	init(): void {
		for (const room in this.battles) {
			try {
				this.battles[room].destroy();
			} catch (e: any) {}
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
				} catch (e: any) {}
			}
			this.battles[room] = new Battle(this, room);
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
				} catch (e: any) {}
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
			} catch (e: any) {}
			delete this.battles[room];
			this.battlesCount--;
		}
	}
}
