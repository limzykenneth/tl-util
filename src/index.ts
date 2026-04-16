interface BucketItem {
  lang: string;
  label: string;
  strings: string[];
  placeholders: string[];
}

export class TL {
  /**
   * Data structure to internally keep track of registered strings and
   * translations.
   *
   * Structured as a table to eventually use indexed queries.
   *
   * @private
   */
  static bucket: BucketItem[] = [];

  /**
   * Bulk add translations.
   */
  static addTranslations(lang: string, translations: Record<string, any>) {
    const regex = /\$\{(.+?)\}/gm;

    for (const [key, val] of Object.entries(translations)) {
      const arr = val.split(regex);
      const strings = [];
      const placeholders = [];

      for (let i = 0; i < arr.length; i++) {
        if (i % 2 === 0) {
          strings.push(arr[i]);
        } else {
          placeholders.push(arr[i]);
        }
      }

      TL.bucket.push({
        lang,
        label: key,
        strings,
        placeholders
      });
    }
  }

  /**
   * Tagged template literal utility function. This should be used with
   * tagged templates to create a new TL object. It essentially behaves as a
   * factory function for the TL object.
   *
   * @param strings
   * @param values
   * @returns TL
   */
  static tl(strings: TemplateStringsArray, ...values: any[]) {
    return new TL(Array.from(strings), values);
  }

  strings: string[];
  values: any[];

  constructor(strings: string[], values: any[]) {
    this.strings = strings;
    this.values = values;
  }

  /**
   * Serializes the TL object into a string with the previously set values.
   *
   * If a language code is passed in with the `lang` parameter, it will attempt
   * to find the relevant translation and if not found, return the orignal
   * string untranslated.
   *
   * If the `lang` parameter is not provided, return the original string
   * untranslated.
   *
   * @param lang
   * @returns string
   */
  toString(lang?: string) {
    // TODO: Take into account mismatch number of placeholder, target language
    // can have fewer placeholder

    // Identify what the language of `this` is then well map the values array
    const item = TL.bucket.find((item) => {
      return item.strings.join("---") === this.strings.join("---");
    });

    if (!item) {
      // No matching string found in bucket, stringify as is
      let results = "";
      for (let i = 0; i < this.strings.length; i++) {
        results += this.strings[i];

        if (this.values[i])
          results +=
            this.values[i] instanceof TL
              ? this.values[i].toString(lang)
              : this.values[i];
      }
      return results;
    }

    const targetLangItem =
      TL.bucket.find((targetItem) => {
        return (
          targetItem.label === item.label &&
          targetItem.lang === (lang ?? item.lang)
        );
      }) ?? item;

    // Re-map position of `this.values`
    const values: any[] = [];
    item.placeholders.forEach((placeholder) => {
      const index = targetLangItem.placeholders.indexOf(placeholder);
      values.push(this.values[index]);
    });

    let results = "";
    for (let i = 0; i < targetLangItem.strings.length; i++) {
      results += targetLangItem.strings[i];

      if (values[i])
        results +=
          values[i] instanceof TL
            ? values[i].toString(targetLangItem.lang)
            : values[i];
    }
    return results;
  }
}

if (import.meta.vitest) {
  const { suite, it, assert, beforeAll } = import.meta.vitest;

  beforeAll(() => {
    TL.addTranslations("en", {
      basic: "This has no placeholder",
      greeting: "Hello ${name}.",
      debug: "Expected ${expected-type} at the ${position} parameter",
      first: "first"
    });

    TL.addTranslations("zh", {
      basic: "此处没有占位符",
      greeting: "你好 ${name}",
      debug: "${position}参数应为${expected-type}",
      first: "第一个"
    });
  });

  suite("Self serialization", () => {
    let myString: TL;
    let myString2: TL;

    beforeAll(() => {
      myString = TL.tl`This has no placeholder`;
      myString2 = TL.tl`此处没有占位符`;
    });

    it("should serialize into original string as defined", () => {
      assert.equal(
        myString.toString(),
        "This has no placeholder",
        "English string self serialize without language tag"
      );
      assert.equal(
        myString2.toString(),
        "此处没有占位符",
        "Chinese string self serialize without language tag"
      );
    });

    it("should serialize into original string when no translation exist", () => {
      const str = TL.tl`Hello`;
      assert.equal(str.toString(), "Hello");
    });
  });

  suite("Translate to other languages", () => {
    let name = "Alex";
    let expectedType = "string";
    let position: TL;
    let myString: TL;
    let myString2: TL;
    let myString3: TL;
    let myString4: TL;

    beforeAll(() => {
      myString = TL.tl`Hello ${name}.`;
      myString2 = TL.tl`你好 ${name}`;

      position = TL.tl`first`;
      myString3 = TL.tl`Expected ${expectedType} at the ${position} parameter`;
      myString4 = TL.tl`${position}参数应为${expectedType}`;
    });

    it("should translate into itself", () => {
      assert.equal(
        myString.toString("en"),
        "Hello Alex.",
        "English serialize to English"
      );
      assert.equal(
        myString2.toString("zh"),
        "你好 Alex",
        "Chinese serialize to Chinese"
      );
    });

    it("should default to original language string if language don't exist", () => {
      assert.equal(
        myString.toString("hi"),
        "Hello Alex.",
        "English serialize to non-existant Hindi"
      );
      assert.equal(
        myString2.toString("hi"),
        "你好 Alex",
        "Chinese serialize to non-existant Hindi"
      );
    });

    it("should translate into existing language", () => {
      assert.equal(
        myString.toString("zh"),
        "你好 Alex",
        "English serialize to Chinese"
      );
      assert.equal(
        myString2.toString("en"),
        "Hello Alex.",
        "Chinese serialize to English"
      );
    });

    it("should translate into existing language that has different variable order", () => {
      assert.equal(
        myString3.toString("zh"),
        "第一个参数应为string",
        "English serialize to Chinese"
      );
      assert.equal(
        myString4.toString("en"),
        "Expected string at the first parameter",
        "Chinese serialize to English"
      );
    });
  });

  suite("Native compatibility", () => {
    let name = "Alex";
    let expectedType = "string";
    let position: TL;
    let myString: TL;
    let myString2: TL;
    let myString3: TL;
    let myString4: TL;

    beforeAll(() => {
      myString = TL.tl`Hello ${name}.`;
      myString2 = TL.tl`你好 ${name}`;

      position = TL.tl`first`;
      myString3 = TL.tl`Expected ${expectedType} at the ${position} parameter`;
      myString4 = TL.tl`${position}参数应为${expectedType}`;
    });

    it("should work with primitive type coersion", () => {
      assert.equal(myString + "", "Hello Alex.", "English coerce into English");
      assert.equal(myString2 + "", "你好 Alex", "Chinese coerce into Chinese");
    });

    it("should work with other template literals", () => {
      assert.equal(
        `__${myString}__`,
        "__Hello Alex.__",
        "English interpolates into English"
      );
      assert.equal(
        `__${myString2}__`,
        "__你好 Alex__",
        "Chinese interpolates into Chinese"
      );
    });

    it("should work with translation template literals", () => {
      assert.equal(
        myString3.toString(),
        "Expected string at the first parameter",
        "English string with ordinal first being TL object"
      );
      assert.equal(
        myString4.toString(),
        "第一个参数应为string",
        "Chinese string with ordinal first being TL object"
      );
    });
  });
}
