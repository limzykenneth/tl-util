import { createIterator } from "./symbol-iterator.js";

export class TL {
  static translations: Record<string, Record<string, TL>> = {};

  strings: TemplateStringsArray;
  values: any[];

  constructor(strings: TemplateStringsArray, values: any[]) {
    this.strings = strings;
    this.values = values;
  }

  static tl(strings: TemplateStringsArray, ...values: any[]) {
    const hash = strings.join("---");
    const original = TL.translations[hash];
    if (original) {
      const template = Object.values(original).find((val) => {
        return hash === val.hash();
      });
      values = values.reduce((acc, value, i) => {
        acc[parseInt(template.values[i].description)] = value;
        return acc;
      }, []);
    }
    return new TL(strings, values);
  }

  static addTranslation(lang: string, origin: TL, target: TL) {
    const original = TL.translations[origin?.hash()] || null;
    if (original) {
      original[lang] = target;
      TL.translations[target.hash()] = original;
    } else {
      TL.translations[target.hash()] = {
        [lang]: target
      };
    }
  }

  static createIterator = createIterator;

  toString(lang?: string) {
    let tlObject: TL;
    if (lang) {
      const translatedString = TL.translations[this.hash()]?.[lang];
      if (translatedString) tlObject = translatedString;
    }
    if (!tlObject) {
      const original = TL.translations[this.hash()];
      const template = Object.values(original).find((val) => {
        return this.hash() === val.hash();
      });
      tlObject = template;
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
  getIterator() {}

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

    TL.addTranslation("en", null, placeholder1);
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
    });
    it("should work with other template literals", () => {
      assert.equal(
        `${myString}`,
        "My name is K. The number is 42.",
        "English interpolates into English"
      );
    });
    it.todo("should work with translation template literals");
  });
}
