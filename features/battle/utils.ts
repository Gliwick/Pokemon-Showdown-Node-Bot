// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function deepcopy(prop: any): any {
	if (prop === null) return null;
	if (Array.isArray(prop)) return [...prop];
	if (typeof prop === 'object') return { ...prop };
	return prop;
}
