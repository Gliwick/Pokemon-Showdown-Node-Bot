/*
	Tournaments Manager Feature
*/

import { Feature } from '../index';
import { LeaderboardsManager } from './leaderboards';

const CurrentGen = 9;

interface TournamentDetails {
	format: string;
	type: string;
	eliminationCount: number;
	maxUsers: number;
	timeToStart: number;
	autodq: boolean;
	scoutProtect: boolean;
}

export class Tournament {
	format;
	type;
	eliminationCount;
	users = 0;
	maxUsers: number | null;
	signups = false;
	started = false;
	startTimer: NodeJS.Timeout | null = null;
	room;
	timeToStart;
	autodq;
	scoutProtect;

	constructor(room: string, details: TournamentDetails) {
		this.format = details.format || 'gen' + CurrentGen + 'randombattle';
		this.type = details.type || 'elimination';
		this.eliminationCount = details.eliminationCount || 1;
		this.maxUsers = details.maxUsers || null;
		this.room = room || 'lobby';
		this.timeToStart = details.timeToStart || 30 * 1000;
		this.autodq = details.autodq || false;
		this.scoutProtect = details.scoutProtect || false;
	}

	createTour(): void {
		Bot.say(
			this.room,
			'/tournament create ' +
				this.format +
				', ' +
				this.type +
				(this.type === 'elimination' ? ',, ' + this.eliminationCount : '')
		);
	}

	startTimeout(): void {
		if (!this.timeToStart) return;
		this.signups = true;
		if (this.scoutProtect) Bot.say(this.room, '/tournament setscouting disallow');
		this.startTimer = setTimeout(
			((): void => {
				this.startTour();
				this.started = true;
				this.startTimer = null;
			}).bind(this),
			this.timeToStart
		);
	}

	startTour(): void {
		Bot.say(this.room, '/tournament start');
	}

	checkUsers(): void {
		if (!this.maxUsers) return;
		if (this.maxUsers <= this.users) this.startTour();
	}

	setAutodq(): void {
		if (!this.autodq) return;
		Bot.say(this.room, '/tournament autodq ' + this.autodq);
	}

	endTour(): void {
		Bot.say(this.room, '/tournament end');
	}
}

export interface BracketNode {
	team: string;
	state?: string;
	children?: BracketNode[];
}

interface BracketData {
	rootNode: BracketNode;
}

export interface TourData {
	isStarted: boolean;
	generator: string;
	bracketData: BracketData;
	results: string[][];
	isOfficialTour: boolean;
	format: string;
}

export class TournamentsManager implements Feature {
	id = 'tours';
	desc = 'A tool to ease tournaments creation';

	tournaments: Record<string, Tournament> = {};
	tourData: Record<string, TourData> = {};

	leaderboards: LeaderboardsManager;

	constructor() {
		this.leaderboards = new LeaderboardsManager();
	}

	newTour(room: string, details: TournamentDetails): void {
		this.tournaments[room] = new Tournament(room, details);
		this.tournaments[room].createTour();
	}

	init(): void {
		for (const i in this.tournaments) {
			try {
				const timer = this.tournaments[i].startTimer;
				if (timer) clearTimeout(timer);
			} catch (e) {}
			delete this.tournaments[i];
		}
		this.tourData = {};
	}

	parse(room: string, message: string, isIntro: boolean, spl: string[]): void {
		if (spl[0] !== 'tournament') return;
		if (isIntro) return;
		let timer: NodeJS.Timeout | null;
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
					const timer = this.tournaments[room].startTimer;
					if (timer) clearTimeout(timer);
					this.tournaments[room].setAutodq();
				}
				break;
			case 'update':
				try {
					const data = JSON.parse(spl[2]) as TourData;
					this.tourData[room] = Object.assign(this.tourData[room] || {}, data);
				} catch (e) {}
				break;
			case 'updateEnd':
				if (!this.tournaments[room]) break;
				if (this.tournaments[room].started && !this.tourData[room].isStarted) {
					this.tournaments[room].startTour();
				}
				break;
			case 'end':
				try {
					const data = JSON.parse(spl[2]) as TourData;
					this.tourData[room] = Object.assign(this.tourData[room] || {}, data);
				} catch (e) {}
				this.leaderboards.onTournamentEnd(room, this.tourData[room]);
				delete this.tourData[room];
				timer = this.tournaments[room]?.startTimer;
				if (timer) clearTimeout(timer);
				if (this.tournaments[room]) delete this.tournaments[room];
				break;
			case 'forceend':
				delete this.tourData[room];
				timer = this.tournaments[room]?.startTimer;
				if (timer) clearTimeout(timer);
				if (this.tournaments[room]) delete this.tournaments[room];
				break;
		}
	}

	destroy(): void {
		if (Features[this.id]) delete Features[this.id];
	}
}

export const feature = new TournamentsManager();
