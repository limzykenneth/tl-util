export function createIterator(limit: number = Infinity) {
  return {
    [Symbol.iterator]() {
      let currentIndex = 0;
      return {
        next() {
          const result = {
            value: Symbol(currentIndex.toString()),
            done: currentIndex >= limit
          };

          currentIndex++;
          return result;
        }
      };
    }
  };
}

if (import.meta.vitest) {
  const { suite, it, assert } = import.meta.vitest;

  suite("createIterator", () => {
    it("should create an iterator that returns symbols", () => {
      const iterator = createIterator();
      const [first, second] = iterator;
      assert.typeOf(first, "symbol");
      assert.equal(first.description, "0");
      assert.equal(second.description, "1");

      const [third, fourth, fifth] = iterator;
      assert.equal(third.description, "0");
      assert.equal(fourth.description, "1");
      assert.equal(fifth.description, "2");
    });

    it("should create an iterator with fixed size when provided with argument", () => {
      const [first, second, third] = createIterator(2);
      assert.typeOf(first, "symbol");
      assert.equal(first.description, "0");
      assert.equal(second.description, "1");
      assert.strictEqual(third, undefined);
    });
  });
}
