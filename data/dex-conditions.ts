import { BasicEffect, Effect } from './dex-types';

// type stabs to emulate missing types
type EventListener = `on${string}`;
type EventOrder = `on${string}Order` | `on${string}Priority`;
type AnyFunction = (this: Record<string, any>, arg1?: any, arg2?: any, arg3?: any, arg4?: any) => void;

export type ConditionData = Partial<Condition>;

export interface Condition
	extends Readonly<BasicEffect & Record<EventListener, AnyFunction | string | number> & Record<EventOrder, number>> {
	readonly effectType: 'Condition' | 'Weather' | 'Status' | 'Terastal';
	readonly counterMax?: number;
	readonly durationCallback?: (
		this: Record<string, any>,
		target: Record<string, any>,
		source: Record<string, any>,
		effect: Effect | null
	) => number;
}
