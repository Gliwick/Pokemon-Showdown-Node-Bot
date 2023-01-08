import { BasicEffect, Effect } from './types-dex';

// type stabs to emulate missing types
export type EventMethod = `on${Capitalize<string>}`;
type EventOrder = `on${string}Order` | `on${string}Priority`;
type AnyFunction = (this: any, arg1?: any, arg2?: any, arg3?: any, arg4?: any) => void;

export type ConditionData = Partial<Condition>;

export interface Condition extends Readonly<BasicEffect & Record<EventMethod, AnyFunction | string | number> & Record<EventOrder, number>> {
	readonly effectType: 'Condition' | 'Weather' | 'Status' | 'Terastal';
	readonly counterMax?: number;
	readonly durationCallback?: (this: any, target: any, source: any, effect: Effect | null) => number;
}
