/*
	Log system (battle)
*/

import { existsSync, mkdirSync, PathLike, readdirSync, unlinkSync } from "fs";
import { errlog, error } from "../../../console-reports";
import { dateDifference } from "../../../security-log";
import { Battle } from "./battle";

const LOGS_PATH = './logs/';

function checkDir(dir: PathLike) {
	try {
		if (!existsSync(dir))
			mkdirSync(dir);
	} catch (e) { }
}

checkDir(LOGS_PATH);
checkDir(LOGS_PATH + "battle-log/");

export function createStream(battle: Battle) {
	if (!Config.battleLog) return;
	const f = new Date();
	const fstr = Tools.addLeftZero(f.getFullYear(), 4) + '_' + Tools.addLeftZero(f.getMonth() + 1, 2) + '_' + Tools.addLeftZero(f.getDate(), 2);
	try {
		battle.createLogStream(LOGS_PATH + "battle-log/" + battle.id + "_" + fstr + ".log");
	} catch (e: any) {
		errlog(e.stack);
		errlog(e.message);
	}
	sweep(LOGS_PATH + "battle-log/");
};

export function sweep(dir: string) {
	//delete previous logs
	const ageOfLogs = Config.battleLog?.ageOfLogs || 15;
	const f = new Date();
	try {
		const logs = readdirSync(dir);
		let aux;
		for (let i = 0; i < logs.length; i++) {
			if (logs[i].substr(-4) !== ".log") continue;
			aux = logs[i].substr(0, logs[i].indexOf("."));
			aux = aux.split('_');
			if (aux.length < 4) continue;
			if (dateDifference({ "day": parseInt(aux[3]), "month": parseInt(aux[2]), "year": parseInt(aux[1]) }, { "day": f.getDate(), "month": f.getMonth() + 1, "year": f.getFullYear() }) > ageOfLogs) {
				try {
					unlinkSync(dir + logs[i]);
				} catch (e: any) {
					error('failed to delete old security logs\n' + e.stack);
				}
			}
		}
	} catch (e: any) {
		errlog(e.message);
		errlog(e.stack);
	}
};
