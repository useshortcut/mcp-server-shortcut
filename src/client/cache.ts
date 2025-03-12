export class Cache<TId, TValue> {
	private cache: Map<TId, TValue>;
	private age: number;

	constructor() {
		this.cache = new Map();
		this.age = 0;
	}

	get(key: TId) {
		return this.cache.get(key) ?? null;
	}

	setMany(values: [TId, TValue][]) {
		this.cache.clear();
		for (const [key, value] of values) {
			this.cache.set(key, value);
		}
		this.age = Date.now();
	}

	clear() {
		this.cache.clear();
		this.age = 0;
	}

	get isStale() {
		return Date.now() - this.age > 1000 * 60 * 5;
	}
}
