/*
	Tournaments Manager Feature
*/

import { Feature } from '../index';

import { LeaderboardsManager } from './leaderboards';

const CurrentGen = 9;

export class Tournament {
	format;
	type;
	eliminationCount;
	users = 0;
	maxUsers;
	signups = false;
	started = false;
	startTimer: number | null = null;
	room;
	timeToStart;
	autodq;
	scoutProtect;

	constructor(room, details) {
		this.format = details.format || 'gen' + CurrentGen + 'randombattle';
		this.type = details.type || 'elimination';
		this.eliminationCount = details.eliminationCount || 1;
		this.maxUsers = details.maxUsers || null;
		this.room = room || 'lobby';
		this.timeToStart = details.timeToStart || 30 * 1000;
		this.autodq = details.autodq || false;
		this.scoutProtect = details.scoutProtect || false;
	}

	createTour() {
		Bot.say(this.room, '/tournament create ' + this.format + ', ' + this.type + (this.type === 'elimination' ? ',, ' + this.eliminationCount : ''));
	};

	startTimeout() {
		if (!this.timeToStart) return;
		this.signups = true;
		if (this.scoutProtect) Bot.say(this.room, '/tournament setscouting disallow');
		this.startTimer = setTimeout((() => {
			this.startTour();
			this.started = true;
			this.startTimer = null;
		}).bind(this), this.timeToStart);
	};

	startTour() {
		Bot.say(this.room, '/tournament start');
	};

	checkUsers() {
		if (!this.maxUsers) return;
		if (this.maxUsers <= this.users) this.startTour();
	};

	setAutodq() {
		if (!this.autodq) return;
		Bot.say(this.room, '/tournament autodq ' + this.autodq);
	};

	endTour() {
		Bot.say(this.room, '/tournament end');
	};
};

export class TournamentsManager implements Feature {
	id = 'tours';
	desc = 'A tool to ease tournaments creation';

	tournaments: { [key: string]: Tournament } = {};
	tourData = {};

	leaderboards: LeaderboardsManager;

	constructor() {
		this.leaderboards = new LeaderboardsManager();
	}

	newTour(room, details) {
		this.tournaments[room] = new Tournament(room, details);
		this.tournaments[room].createTour();
	};

	init() {
		for (let i in this.tournaments) {
			try {
				if (this.tournaments[i].startTimer) clearTimeout(this.tournaments[i].startTimer);
			} catch (e) { }
			delete this.tournaments[i];
		}
		for (let i in this.tourData) {
			delete this.tourData[i];
		}
	};

	parse(room, message, isIntro, spl) {
		if (spl[0] !== 'tournament') return;
		if (isIntro) return;
		if (!this.tourData[room]) this.tourData[room] = {};
		switch (spl[1]) {
			case 'create':
				if (!this.tournaments[room]) break;
				this.tournaments[room].startTimeout();
				break;
			case 'join':
				if (!this.tournaments[room]) break;
				this.tournaments[room].users++;
				this.tournaments[room].checkUsers();
				break;
			case 'leave':
				if (!this.tournaments[room]) break;
				this.tournaments[room].users--;
				this.tournaments[room].checkUsers();
				break;
			case 'start':
				if (!this.tournaments[room]) break;
				if (this.tournaments[room].signups) {
					this.tournaments[room].signups = false;
					clearTimeout(this.tournaments[room].startTimer);
					this.tournaments[room].setAutodq();
				}
				break;
			case 'update':
				try {
					var data = JSON.parse(spl[2]);
					for (var i in data)
						this.tourData[room][i] = data[i];
				} catch (e) { }
				break;
			case 'updateEnd':
				if (!this.tournaments[room]) break;
				if (this.tournaments[room].started && !this.tourData[room].isStarted) {
					this.tournaments[room].startTour();
				}
				break;
			case 'end':
				try {
					var data = JSON.parse(spl[2]);
					for (var i in data)
						this.tourData[room][i] = data[i];
				} catch (e) { }
				this.leaderboards.onTournamentEnd(room, this.tourData[room]);
				delete this.tourData[room];
				if (this.tournaments[room] && this.tournaments[room].startTimer) clearTimeout(this.tournaments[room].startTimer);
				if (this.tournaments[room]) delete this.tournaments[room];
				break;
			case 'forceend':
				delete this.tourData[room];
				if (this.tournaments[room] && this.tournaments[room].startTimer) clearTimeout(this.tournaments[room].startTimer);
				if (this.tournaments[room]) delete this.tournaments[room];
				break;
		}
	};

	destroy() {
		if (Features[this.id]) delete Features[this.id];
	};
};