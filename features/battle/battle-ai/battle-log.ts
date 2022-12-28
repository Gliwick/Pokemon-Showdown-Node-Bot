/*
	Log system (battle)
*/

import { checkDir, sweep } from '../../../bll/security-log';
import { errlog } from '../../../log';
import { Battle } from './battle';

const LOGS_PATH = './logs/';

checkDir(LOGS_PATH);
checkDir(LOGS_PATH + 'battle-log/');

export function createStream(battle: Battle) {
	if (!Config.battleLog) return;
	const f = new Date();
	const fstr =
		Tools.addLeftZero(f.getFullYear(), 4) +
		'_' +
		Tools.addLeftZero(f.getMonth() + 1, 2) +
		'_' +
		Tools.addLeftZero(f.getDate(), 2);
	try {
		battle.createLogStream(LOGS_PATH + 'battle-log/' + battle.id + '_' + fstr + '.log');
	} catch (e: any) {
		errlog(e.stack);
		errlog(e.message);
	}
	sweep(LOGS_PATH + 'battle-log/', Config.battleLog);
}
