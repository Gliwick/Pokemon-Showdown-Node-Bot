/*
	Log system (battle)
*/

import { errlog } from '../../../log';
import { checkDir, LOGS_PATH, sweep } from '../../../security-log';
import { pad } from '../../../tools';
import { Battle } from './battle';

checkDir(LOGS_PATH);
checkDir(LOGS_PATH + 'battle-log/');

export function createStream(battle: Battle): void {
	if (!Config.battleLog) return;
	const f = new Date();
	const fstr = pad(f.getFullYear(), 4) + '_' + pad(f.getMonth() + 1, 2) + '_' + pad(f.getDate(), 2);
	try {
		battle.createLogStream(LOGS_PATH + 'battle-log/' + battle.id + '_' + fstr + '.log');
	} catch (e: any) {
		errlog(e.stack);
		errlog(e.message);
	}
	sweep(LOGS_PATH + 'battle-log/', Config.battleLog);
}
