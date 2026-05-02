# TL Util (WIP)

[![pkg.pr.new](/badge/limzykenneth/tl-util)](/~/limzykenneth/tl-util)

## Design goals

### Problems with existing solutions

- They create a layer of opacity from where the string is defined and where it is used.
- The API to get a translated string is not streamlined, especially when placeholder templates are involved.

### Guiding philosophy

- Be JavaScript/TypeScript, use JavaScript/TypeScript features.
- Be simple, don't do too many things, focus on core features.
- Writing, adding, and using translations should be easy and intuitive. The less documentation a user needs to read the better.
- No language is the default. The default is whatever the string itself is written in.
- Use standards. Use built-ins.

### Key features

By using [Tagged Template Literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates) we can avoid needing to have specific API for templating (why reinvent the wheel), the user can use something familiar, and the string itself exist alongside where it is used.

Instead of:

```js
const username = "Alex";
const translatedString = translate("greeting", { name: username }); // What is the actual string??
```

We do:

```js
const username = "Alex";
const translatedString = tl`Hello and welcome ${username}!`;
```

The translated string is returned as an object that can be serialized into the original string or into a registered translation string.

```js
console.log(translatedString.toString()); // Prints "Hello and welcome Alex!"
console.log(translatedString.toString("de")); // Prints "Hallo und herzlich willkommen Alex!"
console.log(translatedString.toString("jp")); // Prints "こんにちは、Alex さん！ようこそ！"
console.log(translatedString.toString("non_language_code")); // Prints "Hello and welcome Alex!", ie. what the string originally is
```

By implementing native serialization, the string object can be used where other string interpolation is used as is.

```js
console.log(`${translatedString} It is currently 8:00 in the morning.`);
// Prints "Hello and welcome Alex! It is currently 8:00 in the morning."
```

It can also be nested and all strings and interpolated fragments will be translated into the specified language.

```js
const fullGreeting = tl`${translatedString} It is currently 8:00 in the morning.`;
console.log(fullGreeting.toString("de"));
// Prints "Hallo und herzlich willkommen Alex! Es ist jetzt 8:00 Uhr morgens."
```

Translations can be defined programmatically or adapters can be included to read translations from common translation format files such as [MessageFormat 2](https://messageformat.unicode.org/), [POT](https://www.gnu.org/software/gettext/manual/html_node/PO-Files.html) or [Fluent](https://projectfluent.org/fluent/guide/) files.

Translations can be added and/or changed at any point in the programme, even after translation string object has already been created, they can still be used to translate into the newly added language.

If we assume a structured format to define translations (such as MF2, POT, or Fluent files), the definition should be authored in better tools (eg. [Weblate](https://weblate.org/en/) or [Crowdin](https://crowdin.com/)) and the definition programmatically added to TL Util through an adapter. The logic complexity of adding translation will be encapsulated in the adapter and the API that users will use the most is using the translation strings, as such we optimize for simple API for users using translation strings and offload complexity _if unavoidable_ to adding translations.

## Usage

By default, TL does not include any translations and they will need to be added, however this does not prevent string from being created beforehand.

```js
import { TL } from "tl-util";

const myGreeting = TL.tl`Hello world!`;
```

To add a translation, we call `addTranslations(lang: string, translations: Record<string, string | Record<string, string>>)` and provide an object with keys as translation string labels and value as the specific language version of the string.

```js
TL.addTranslations("en", {
  greeting: "Hello world!"
});

TL.addTranslations("de", {
  greeting: "Hallo Welt!"
});
```

The label for each entry (`greeting` in the example above) is not intended to be used by the end user, the main purpose is to create the association of the string between languages, so in the English verison of `greeting` being `"Hello world!"` can be associated with the German version of `greeting` being `"Hallo Welt!"`.

Now we can translate from either string into either languages

```js
console.log(myGreeting.toString("de")); // Prints "Hallo Welt!"
console.log(myGermanGreeting.toString("en")); // Prints "Hello world!"
```

### Interpolation

While basic strings can cover many use cases, sometimes we want to insert specific values into the middle of string. We can do this with the same template literal syntax we would use for non-tagged template literals.

```js
const name = "Alex";
const item = "food";
const foodQuestion = TL.tl`What is ${name}'s favorite ${item}?`;
// Serializes to "What is Alex's favorite food?"
```

Adding translation for template literals with interpolation will require a bit more attention however. Consider the following pairs of translation.

> English: Alex has 3 MacBook.
> Japanese: アレックスはMacBookを3台持っている。

If the two variables to be interpolated in the above sentence are `3` and `MacBook`, ie `Alex has ${num} ${device}.`, the corresponding template for Japanese will be `アレックスは${device}を${num}台持っている。`. In this case the two variables are in different order and if we are not careful with how we handle adding translation, we can end up with "Alex has MacBook 3" instead.

This is resolved internally as when we define the translation string provided we use consistent naming.

```js
TL.addTranslations("en", {
  hasDevice: "Alex has ${num} ${device}."
});

TL.addTranslations("jp", {
  hasDevice: "アレックスは${device}を${num}台持っている。"
});
```

Provided we keep the variable names (`num` and `device`) consistent across languages, when the strings are eventually serialised, the values will be placed in the correct place since we already have all the necessary information within the translation string to do so. No more providing an object separate to the string to interpolate values!

### Pattern matching/Selector

For some cases, we need a more complex way of defining a translation string. The most typical example is pluralisation, if we have the string in English `"There are ${num} apples."`, where the value of num is any positive integer, in the case where `num` is 1, we would want the string to be `"There are 1 apple."`.

Following the convention in MF2 and Fluent, we can understand this as a pattern matching problem. The actual value of the serialised string is the result of pattern matching on the value of `num`.

```
match num
  case num IS 1 -> "There are ${num} apple."
  case num IS LARGER THAN 1 -> "There are ${num} apples."
```

However we need to [generalise even more](https://www.unicode.org/cldr/cldr-aux/charts/22/supplemental/language_plural_rules.html), not all languages has pluralisation (eg. Chinese), some languages treat 0 as singular while others as plural, while some languages has many pluralisation cases (eg. Arabic has zero, one, two, few, many, and other cases). This can still be addressed by pattern matching.

```
match num
  case num IS 0 -> "There are no apples."
  case num IS 1 -> "There are ${num} apple."
  default -> "There are ${num} apples." # We always provide a default case
```

Translating the pseudocode into how we actually define the pattern matching in TL Util:

```js
TL.addTranslations("en", {
  fruits: {
    "${num}_[zero]": "There are no apples.",
    "${num}_[one]": "There are ${num} apple.",
    "${num}_[*]": "There are ${num} apples"
  }
});

TL.addTranslations("zh-Hans", {
  fruits: {
    "${num}_[zero]": "没有苹果。",
    "${num}_[*]": "有 ${num} 个苹果。"
  }
});
```

Here the translation string value is provided as an object instead, the keys are in a specific pattern while the value is the regular translation string. For the key value the require pattern is `${variable_to_be_matched}_[pattern_matching_function]`. Notice that the number pattern matching cases do not need to match between languages, if a particular value is not matched with any pattern it matches the default pattern (`[*]`).

Some default pattern matching functions such as basic pluralisation cases will be supplied out of the box but the user can provide more custom pattern matching functions as needed (API to be implemented), the pattern matching function expect the following signature:

```js
(v? string) => boolean;
```

### Transformation

## Resources

These are a list of resources that helped influence the design of the library.

- Fluent - https://projectfluent.org/
- MessageFormat 2 - https://messageformat.unicode.org/docs/quick-start/
- Rita.js - https://rednoise.org/rita/index.html
- JavaScript `Intl` object - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl
