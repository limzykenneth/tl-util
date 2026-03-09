class MultiLookupMap<T, V=unknown> {
	#bucket = new Map<T[], V>();

	get(key: T): V {
		const result = this.#bucket.entries().find(([k, v]) => {
			return k.includes(key);
		});

		return result[1];
	}

	set(key: T, value: V) {

	}
}

const map = new MultiLookupMap();


map.get();