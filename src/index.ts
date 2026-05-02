interface BucketItem {
  lang: string[];
  label: string;
  pattern: Pattern;
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

  static patterns = new Map([
    ["zero", (v: string) => parseFloat(v) === 0],
    ["one", (v: string) => parseFloat(v) === 1],
    ["*", () => true]
  ]);

  /**
   * Bulk add translations.
   */
  static addTranslations(
    lang: string | string[],
    translations: Record<string, string | Record<string, string>>
  ) {
    const regex = /\$\{(.+?)\}/gm;

    for (const [key, val] of Object.entries(translations)) {
      const patternObj = new Map<
        (v?: string) => boolean,
        {
          strings: string[];
          placeholders: string[];
        }
      >();
      if (typeof val === "string") {
        // Simple string matching, set as default pattern match
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

        patternObj.set(TL.patterns.get("*"), {
          strings,
          placeholders
        });
      } else {
        // More complex matching (eg. plurality)
        for (const [patternStr, str] of Object.entries(val)) {
          const match = patternStr.split("_")[1];
          const functionMatchRegex = /\[(.+?)\]/;
          const functionPattern = functionMatchRegex.exec(match)?.[1];
          const literalMatchRegex = /\((.+?)\)/;
          const literalPattern = literalMatchRegex.exec(match)?.[1];

          const arr = str.split(regex);
          const strings = [];
          const placeholders = [];

          for (let i = 0; i < arr.length; i++) {
            if (i % 2 === 0) {
              strings.push(arr[i]);
            } else {
              placeholders.push(arr[i]);
            }
          }

          patternObj.set(
            TL.patterns.get(functionPattern) ||
              (literalPattern
                ? (value: any) => value.toString() === literalPattern
                : () => true),
            {
              strings,
              placeholders
            }
          );
        }
      }

      TL.bucket.push({
        lang: Intl.getCanonicalLocales(Array.isArray(lang) ? lang : [lang]),
        label: key,
        pattern: new Pattern(patternObj)
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
  toString(lang?: string | string[]) {
    if (lang) {
      lang = Intl.getCanonicalLocales(Array.isArray(lang) ? lang : [lang]);
    }

    // Identify what the language of `this` is then we'll map the values array
    // Get translation entry matching current object in bucket
    const item = TL.bucket.find((item) => {
      return item.pattern.isMatch(this.strings);
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

    // Get translation entry matching target language and current object in bucket.
    // If entry is not found, use current entry as is.
    let targetLangItem: BucketItem;
    if (lang) {
      // Get entry by language based on lang array order (ie. user preference)
      targetLangItem = (lang as string[]).reduce<BucketItem>((acc, l) => {
        if (!acc) {
          acc = TL.bucket.find((targetItem) => {
            return (
              targetItem.label === item.label && targetItem.lang.includes(l)
            );
          });
        }
        return acc;
      }, null);
    } else {
      targetLangItem = TL.bucket.find((targetItem) => {
        return (
          targetItem.label === item.label &&
          targetItem.lang.filter((value) => item.lang.includes(value)).length >
            0
        );
      });
    }

    if (!targetLangItem) targetLangItem = item;

    // Re-map position of `this.values`
    const { strings, placeholders } = targetLangItem.pattern.match(
      this.values[0]
    );

    const { placeholders: itemPlaceholders } = item.pattern.match(
      this.values[0]
    );

    // Build values into a keyed object then reference that way
    const values = this.values.reduce((acc, value, i) => {
      if (itemPlaceholders[i]) {
        acc[itemPlaceholders[i]] = value;
      }
      return acc;
    }, {});

    let results = "";
    for (let i = 0; i < strings.length; i++) {
      results += strings[i];
      const val = values[placeholders[i]];

      if (typeof val !== "undefined")
        results += val instanceof TL ? val.toString(targetLangItem.lang) : val;
    }

    return results;
  }

  // MAYBE: used to set the values manually, for use when using template with less placeholder
  setValues() {}
}

class Pattern {
  /**
   * Key of the map is the pattern matching function, value is the evaluated string.
   */
  patterns: Map<
    (v?: string) => boolean,
    {
      strings: string[];
      placeholders: string[];
    }
  >;

  constructor(
    patterns: Map<
      (v?: string) => boolean,
      {
        strings: string[];
        placeholders: string[];
      }
    >
  ) {
    this.patterns = patterns;
  }

  /**
   * Perform pattern matching using the provided value.
   *
   * @param v
   * @returns
   */
  match(v: string) {
    for (const [key, value] of this.patterns.entries()) {
      if (key(v)) {
        return value;
      }
    }
  }

  /**
   * Reserve lookup to determine if current pattern matches strings.
   *
   * @param input
   * @returns
   */
  isMatch(input: string[]) {
    for (const { strings } of this.patterns.values()) {
      if (input.join("---") === strings.join("---")) return true;
    }
    return false;
  }
}

if (import.meta.vitest) {
  const { suite, it, assert, beforeAll } = import.meta.vitest;

  beforeAll(() => {
    TL.addTranslations("en", {
      basic: "This has no placeholder",
      greeting: "Hello ${name}.",
      debug: "Expected ${expected-type} at the ${position} parameter",
      first: "first",
      functionType: "function",
      mismatch: {
        // NOTE: square bracket for symbol with specific meaning,
        // round bracket for literal string value
        "${amount}_[zero]": "There are no apples",
        "${amount}_[one]": "There should be ${amount} apple",
        "${amount}_[*]": "There should be ${amount} apples"
      },
      literalMatch: {
        "${value}_(0)": "You have no notifications",
        "${value}_(1)": "You have ${value} notification",
        "${value}_(12)": "You have a dozen notifications",
        "${value}_[*]": "You have ${value} notifications"
      },
      repeatPlaceolder:
        '${errorType} "${name}" on line ${line} is being redeclared and conflicts with a p5.js ${errorType}. p5.js reference: ${url}'
    });

    TL.addTranslations("zh", {
      basic: "此处没有占位符",
      greeting: "你好 ${name}",
      debug: "${position}参数应为${expected-type}",
      first: "第一个",
      functionType: "函数",
      mismatch: {
        "${amount}_[zero]": "没有苹果。",
        "${amount}_[*]": "应该有${amount}个苹果。"
      },
      literalMatch: {
        "${value}_(0)": "您没有收到任何通知",
        "${value}_(12)": "您有一打通知",
        "${value}_[*]": "您有 ${value} 条通知"
      },
      repeatPlaceolder:
        "第 ${line} 行的${errorType} “${name}” 被重复声明，与 p5.js ${errorType}冲突。p5.js 参考：${url}"
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

    it("should translate correctly when same variable is used multiple times", () => {
      const errorType = TL.tl`function`;
      const name = "fill";
      const line = 1;
      const url = "http://example.com";
      const str1 = TL.tl`${errorType} "${name}" on line ${line} is being redeclared and conflicts with a p5.js ${errorType}. p5.js reference: ${url}`;
      const str2 = TL.tl`第 ${line} 行的${errorType} “${name}” 被重复声明，与 p5.js ${errorType}冲突。p5.js 参考：${url}`;

      assert.equal(
        str1.toString("en"),
        'function "fill" on line 1 is being redeclared and conflicts with a p5.js function. p5.js reference: http://example.com',
        "English to English"
      );
      assert.equal(
        str2.toString("zh"),
        "第 1 行的函数 “fill” 被重复声明，与 p5.js 函数冲突。p5.js 参考：http://example.com",
        "Chinese to Chinese"
      );
      assert.equal(
        str1.toString("zh"),
        "第 1 行的函数 “fill” 被重复声明，与 p5.js 函数冲突。p5.js 参考：http://example.com",
        "English to Chinese"
      );
      assert.equal(
        str2.toString("en"),
        'function "fill" on line 1 is being redeclared and conflicts with a p5.js function. p5.js reference: http://example.com',
        "Chinese to English"
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

  suite("Pattern matching", () => {
    it("should match any string to the key as long as it has required placeholder", () => {
      let amount = 1;
      const string1 = TL.tl`There should be ${amount} apple`;
      assert.equal(string1.toString("en"), "There should be 1 apple");

      amount = 2;
      const string2 = TL.tl`There should be ${amount} apple`;
      assert.equal(string2.toString("en"), "There should be 2 apples");
    });

    it.only("should serialize into own language string based on set pattern", () => {
      let amount = 1;
      const string1 = TL.tl`There should be ${amount} apples`;
      assert.equal(string1.toString(), "There should be 1 apple");

      amount = 0;
      const string2 = TL.tl`There should be ${amount} apples`;
      assert.equal(string2.toString(), "There are no apples");
    });

    it("should translate into other language string based on pattern", () => {
      let amount = 1;
      const string1 = TL.tl`There should be ${amount} apples`;
      assert.equal(string1.toString("zh"), "应该有1个苹果。");

      amount = 2;
      const string2 = TL.tl`应该有${amount}个苹果。`;
      assert.equal(string2.toString("en"), "There should be 2 apples");
    });

    it("should match with multiple selector");

    it("should match using string literal", () => {
      const value = 12;
      const str1 = TL.tl`You have ${value} notifications`;
      const str2 = TL.tl`您有 ${value} 条通知`;

      assert.equal(str1.toString(), "You have a dozen notifications");
      assert.equal(str2.toString(), "您有一打通知");
      assert.equal(str1.toString("zh"), "您有一打通知");
      assert.equal(str2.toString("en"), "You have a dozen notifications");
    });
  });
}
