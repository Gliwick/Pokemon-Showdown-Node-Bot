/*
	Tournaments parser
*/

import { Parser } from '..';
import { toId } from '../../tools';
import { TeamBuilder } from "./teambuilder";

const ACTION_INTERVAL = 1500;

export class TourManager implements Parser {
	tourData: Record<string, Record<string, any>> = {};
	lastAction: Record<string, number> = {};

	teamBuilder: TeamBuilder;

	constructor(teamBuilder: TeamBuilder) {
		this.teamBuilder = teamBuilder;
	};

	canSendCommands(room: string): boolean {
		let res = true;
		if (this.lastAction[room] && Date.now() - this.lastAction[room] < ACTION_INTERVAL) res = false;
		this.lastAction[room] = Date.now();
		return res;
	};

	clearData() {
		this.tourData = {};
	};

	parse(room: string, message: string, isIntro: boolean, spl: string[]) {
		if (spl[0] !== 'tournament') return;
		if (!this.tourData[room]) this.tourData[room] = {};
		switch (spl[1]) {
			case 'update':
				try {
					const data = JSON.parse(spl[2]);
					Object.assign(this.tourData[room], data);
				} catch (e) { }
				break;
			case 'updateEnd':
				if (!Settings.lockdown && Settings.settings.jointours && Settings.settings.jointours[room] && this.tourData[room].format && !this.tourData[room].isJoined && !this.tourData[room].isStarted) {
					const format = toId(this.tourData[room].format);
					if (Formats[format] && !Formats[format].team) {
						Bot.say(room, '/tour join');
					} else {
						if (this.teamBuilder.hasTeam(this.tourData[room].format)) Bot.say(room, '/tour join');
					}
				}
				if (!Settings.lockdown && this.tourData[room].challenges && this.tourData[room].challenges.length) {
					if (this.canSendCommands(room)) {
						const team = this.teamBuilder.getTeam(this.tourData[room].format);
						if (team) Bot.say(room, '/useteam ' + team);
						for (let i = 0; i < this.tourData[room].challenges.length; i++) {
							Bot.say(room, '/tour challenge ' + this.tourData[room].challenges[i]);
						}
					}
				} else if (!Settings.lockdown && this.tourData[room].challenged) {
					if (this.canSendCommands(room)) {
						const team = this.teamBuilder.getTeam(this.tourData[room].format);
						if (team) Bot.say(room, '/useteam ' + team);
						Bot.say(room, '/tour acceptchallenge');
					}
				}
				break;
			case 'end':
			case 'forceend':
				delete this.tourData[room];
				break;
		}
	};
};