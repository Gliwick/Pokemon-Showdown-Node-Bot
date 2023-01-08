export interface AppOptionsType {
	help?: boolean;
	debugmode?: number;
	testmode?: boolean;
	config: string;
	data: string;
}

export type KeyOfValueType<T, V> = { [K in keyof T]-?: V extends T[K] ? K : never }[keyof T];
