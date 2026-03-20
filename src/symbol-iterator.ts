export function createIterator(limit: number = Infinity) {
  return {
    [Symbol.iterator]() {
      let currentIndex = 0;
      return {
        next() {
          const result = {
            value: Symbol.for(currentIndex.toString()),
            done: currentIndex >= limit
          };

          currentIndex++;
          return result;
        }
      };
    }
  };
}
