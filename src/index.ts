import { createIterator } from "./symbol-iterator.js";

export class TL {
  /**
   * Data structure to internally keep track of registered strings and
   * translations.
   *
   * First level key is the string identifier and second level is language
   * code, final value is `TL` object.
   *
   * @private
   */
  static translations: Record<string, Record<string, TL>> = {};
  static bucket: { lang: string; label: string; content: TL }[] = [];

  /**
   * Tagged template literal utility function. This should be used with
   * tagged templates to create a new TL object. It essentially behaves as a
   * factory function for the TL object.
   *
   * @param strings
   * @param values
   * @returns TL
   */
  static tl(strings: TemplateStringsArray | string[], ...values: any[]) {
    const hash = strings.join("---");
    const template = TL.bucket.find((item) => {
      return item.content.hash() === hash;
    });
    if (template) {
      values = values.reduce((acc, value, i) => {
        acc[parseInt(template.content.values[i].description)] = value;
        return acc;
      }, []);
    }
    return new TL(strings, values);
  }

  /**
   * Add translation to the TL class that can later be used to serialize a
   * translation string.
   *
   * @param lang
   * @param origin
   * @param target
   */
  static addTranslation(lang: string, origin: TL | string, target: TL) {
    // NOTE: need to account for deduping
    if (origin instanceof TL) {
      // Associate by TL object
      // Get string label by origin
      const { label } = TL.bucket.find((item) => {
        return item.content.hash() === origin.hash();
      });
      TL.bucket.push({
        lang,
        label,
        content: target
      });
    } else {
      // Associate by string label
      TL.bucket.push({
        lang,
        label: origin,
        content: target
      });
    }
  }

  /**
   * Bulk add translations.
   */
  static addTranslations(lang: string, translations: Record<string, any>) {
    const regex = /(\$\{.+?\})/gm;

    for (const [key, val] of Object.entries(translations)) {
      const arr = val.split(regex);
      const arg1 = [],
        arg2 = [];
      for (let i = 0; i < arr.length; i++) {
        if (i % 2 === 0) {
          arg1.push(arr[i]);
        } else {
          arg2.push(Symbol.for(Math.floor(i / 2).toString()));
        }
      }

      TL.bucket.push({
        lang,
        label: key,
        content: TL.tl(arg1, ...arg2)
      });
    }
  }

  /**
   * Creates an object that implements Iterable. The object can be expanded out
   * into individual Symbol object with description being numerical key of
   * current index of generation.
   *
   * @param number
   * @returns Iterable
   */
  static createIterator = createIterator;

  strings: string[];
  values: any[];

  constructor(strings: TemplateStringsArray | string[], values: any[]) {
    this.strings = Array.from(strings);
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
    let tlObject: TL;
    if (lang) {
      // const translatedString = TL.translations[this.hash()]?.[lang];
      const item = TL.bucket.find((item) => {
        return item.content.hash() === this.hash();
      });
      if (item) {
        const translatedString = TL.bucket.find((i) => {
          return i.label === item.label && i.lang === lang;
        });
        if (translatedString) tlObject = translatedString.content;
      }
    }
    if (!tlObject) {
      // const original = TL.translations[this.hash()];
      const template = TL.bucket.find((item) => {
        return item.content.hash() === this.hash();
      });
      if (template) {
        // const template = Object.values(original).find((val) => {
        //   return this.hash() === val.hash();
        // });
        tlObject = template.content;
      } else {
        tlObject = this;
      }
    }

    // Order of `this.values` should be kept while how it is applied changed
    let result = "";
    for (let i = 0; i < tlObject.strings.length; i++) {
      if (this.values.length > i) {
        let valueIndex = i;
        if (tlObject.values.every((value) => typeof value === "symbol")) {
          // Object is translation template
          valueIndex = parseInt(tlObject.values[i].description);
        }

        const value = this.values?.[valueIndex] ?? "";
        result += tlObject.strings[i] + value;
      } else {
        result += tlObject.strings[i];
      }
    }
    return result;
  }

  /**
   * Return an iterator that has length equal to the number of values in this
   * TL string
   */
  getIterator() {
    return createIterator(this.values.length);
  }

  /**
   * Return a string representation of the object that is the same across any
   * template values applied.
   */
  hash() {
    return this.strings.join("---");
  }
}

if (import.meta.vitest) {
  const { suite, it, assert, beforeAll } = import.meta.vitest;
  const n = "K";
  const m = "L";
  const num = 42;
  const num2 = 100;
  let myString: TL;
  let myString2: TL;
  let myString3: TL;

  beforeAll(() => {
    const [s1, s2] = createIterator();
    const placeholder1 = TL.tl`My name is ${s1}. The number is ${s2}.`;
    const placeholder2 = TL.tl`私の名前は${s1}です。番号は${s2}です。`;
    const placeholder3 = TL.tl`El número es ${s2}. Mi nombre es ${s1}.`;

    TL.addTranslation("en", "test", placeholder1);
    TL.addTranslation("jp", placeholder1, placeholder2);
    TL.addTranslation("es", placeholder1, placeholder3);

    myString = TL.tl`My name is ${n}. The number is ${num}.`;
    myString2 = TL.tl`私の名前は${m}です。番号は${num2}です。`;
    myString3 = TL.tl`El número es ${num}. Mi nombre es ${n}.`;
  });

  suite("Self serialization", () => {
    it("should serialize into original string as defined", () => {
      assert.equal(
        myString.toString(),
        "My name is K. The number is 42.",
        "English string self serialize without language tag"
      );
      assert.equal(
        myString2.toString(),
        "私の名前はLです。番号は100です。",
        "Japanese string self serialize without language tag"
      );
      assert.equal(
        myString3.toString(),
        "El número es 42. Mi nombre es K.",
        "Spanish string self serialize without language tag"
      );
    });
    it("should serialize into original string when no translation exist", () => {
      const str = TL.tl`Hello`;
      assert.equal(str.toString(), "Hello");
    });
  });

  suite("Translate to other languages", () => {
    it("should translate into itself", async () => {
      assert.equal(
        myString.toString("en"),
        "My name is K. The number is 42.",
        "English serialize to English"
      );
      assert.equal(
        myString2.toString("jp"),
        "私の名前はLです。番号は100です。",
        "Japanese serialize to Japanese"
      );
      assert.equal(
        myString3.toString("es"),
        "El número es 42. Mi nombre es K.",
        "Spanish serialize to Spanish"
      );
    });
    it("should default to original language string if language don't exist", async () => {
      assert.equal(
        myString.toString("hi"),
        "My name is K. The number is 42.",
        "English serialize to non-existant Hindi"
      );
      assert.equal(
        myString2.toString("hi"),
        "私の名前はLです。番号は100です。",
        "Japanese serialize to non-existant Hindi"
      );
      assert.equal(
        myString3.toString("hi"),
        "El número es 42. Mi nombre es K.",
        "Spanish serialize to non-existant Hindi"
      );
    });
    it("should translate into existing language", async () => {
      assert.equal(
        myString.toString("jp"),
        "私の名前はKです。番号は42です。",
        "English serialize to Japanese"
      );
      assert.equal(
        myString2.toString("en"),
        "My name is L. The number is 100.",
        "Japansese serialize to English"
      );
    });
    it("should translate into existing language that has different variable order", async () => {
      assert.equal(
        myString.toString("es"),
        "El número es 42. Mi nombre es K.",
        "English serialize to Spanish"
      );
      assert.equal(
        myString2.toString("es"),
        "El número es 100. Mi nombre es L.",
        "Japanese serialize to Japanese"
      );
    });
    it("should translate from language with different vairable order", async () => {
      assert.equal(
        myString3.toString("en"),
        "My name is K. The number is 42.",
        "Spanish serialize to English"
      );
      assert.equal(
        myString3.toString("jp"),
        "私の名前はKです。番号は42です。",
        "Spanish serialize to Japanese"
      );
    });
  });

  suite("Native compatibility", () => {
    it("should work with primitive type coersion", () => {
      assert.equal(
        myString + "",
        "My name is K. The number is 42.",
        "English coerce into English"
      );
      assert.equal(
        myString2 + "",
        "私の名前はLです。番号は100です。",
        "Japanses coerce into Japansese"
      );
      assert.equal(
        myString3 + "",
        "El número es 42. Mi nombre es K.",
        "Spanish coerce into Spanish"
      );
    });
    it("should work with other template literals", () => {
      assert.equal(
        `${myString}`,
        "My name is K. The number is 42.",
        "English interpolates into English"
      );
      assert.equal(
        `${myString2}`,
        "私の名前はLです。番号は100です。",
        "Japanses coerce into Japansese"
      );
      assert.equal(
        `${myString3}`,
        "El número es 42. Mi nombre es K.",
        "Spanish coerce into Spanish"
      );
    });
    it.todo("should work with translation template literals", () => {
      const newString = TL.tl`My name is ${n}. The number is ${myString3}.`;
      assert.equal(
        newString.toString("jp"),
        "私の名前はKです。番号は私の名前はLです。番号は100です。です。",
        "Spanish embeded in English translated into Japanese"
      );
    });
  });

  suite("Add translations", async () => {
    const { default: enData } = await import("./en.json", {
      with: { type: "json" }
    });
    const { default: zhData } = await import("./zh.json", {
      with: { type: "json" }
    });

    it("should import direct strings from the file", () => {
      TL.addTranslations("en", enData);
      TL.addTranslations("zh", zhData);

      const str = TL.tl`Hello World!`;
      assert.equal(str.toString(), "Hello World!");
      assert.equal(str.toString("zh"), "你好世界！");

      const name = "Alex";
      const str2 = TL.tl`Hello ${name}`;
      assert.equal(str2.toString(), "Hello Alex");
      assert.equal(str2.toString("zh"), "你好，Alex");

      const date = "08/04";
      const str3 = TL.tl`${str}今天的日期是${date}`;
      assert.equal(str3.toString(), "Hello World!今天的日期是08/04");
      assert.equal(str3.toString("en"), "Hello World! Today's date is 08/04");
    });
  });
}
