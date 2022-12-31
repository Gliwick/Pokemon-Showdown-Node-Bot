/* Global Monitor */

import { colors } from './index';
import { monitor } from './log';

export class GlobalMonitor {
	connected = false;
	retryingRename = false;
	reconnecting = false;
	updateGitLock = false;

	checkSystem(): void {
		let status = '';
		let issue: string | false = false;
		status += 'Connection: ';
		if (this.connected) {
			status += colors.green('connected');
			status += ' | Nickname: ';
			if (Bot.status.named) {
				status += colors.green(Bot.status.nickName || '');
			} else if (this.retryingRename) {
				status += colors.yellow(Bot.status.nickName || '');
			} else {
				status += colors.red(Bot.status.nickName || '');
				issue = 'login';
			}
		} else if (this.reconnecting) {
			status += colors.yellow('retrying');
		} else {
			issue = 'connect';
			status += colors.red('disconnected');
		}
		monitor(status + ' (' + Tools.getDateString() + ')', 'status');
		if (issue) {
			switch (issue) {
				case 'connect':
					monitor('Monitor failed: Connection issue. Reconnecting...');
					SecurityLog.log('Monitor failed: Connection issue. Reconnecting...');
					Bot.connect();
					break;
				case 'login':
					monitor('Monitor failed: Login issue. Logging in a random username.');
					SecurityLog.log('Monitor failed: Login issue. Logging in a random username.');
					Config.nick = '';
					Bot.rename('Bot ' + Tools.generateRandomNick(10));
					break;
			}
		}
	}
}
