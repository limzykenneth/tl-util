# TL Util (WIP)

## Design goals
### Problems with existing solutions
* They create a layer of opacity from where the string is defined and where it is used.
* The API to get a translated string is not streamlined, especially when placeholder templates are involved.

### Guiding philosophy
* Be JavaScript/TypeScript, use JavaScript/TypeScript features.
* Be simple, don't do too many things, focus on core features
* Writing, adding, and using translations should be easy and intuitive. The less documentation a user needs to read the better.
* No language is the default. The default is whatever the string itself is written in.

### Key features
By using [Tagged Template Literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates) we can avoid needing to have specific API for templating (why reinvent the wheel), the user can use something familiar, and the string itself exist alongside where it is used.

Instead of:
```js
const username = "Alex";
const translatedString = translate("greeting", {name: username}); // What is the actual string??
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

Translations can be defined programmatically or adapters can be included to read translations from common translation format files such as [POT](https://www.gnu.org/software/gettext/manual/html_node/PO-Files.html) or [Fluent](https://projectfluent.org/fluent/guide/) files.

Translations can be added and/or changed at any point in the programme, even after translation string object has already been created, they can still be used to translate into the newly added language.

If we assume a structured format to define translations (such as POT or Fluent files), the definition should be authored in better tools (eg. [Weblate](https://weblate.org/en/) or [Crowdin](https://crowdin.com/)) and the definition programmatically added to TL Util through an adapter. The logic complexity of adding translation will be encapsulated in the adapter and the API that users will use the most is using the translation strings, as such we optimize for simple API for users using translation strings and offload complexity _if unavoidable_ to adding translations.

## Usage
By default, TL does not include any translations and they will need to be added, however this does not prevent string from being created beforehand.

```js
import { TL } from "tl-util";

const myGreeting = TL.tl`Hello world!`;
```

To add a translation, we call `addTranslation(lang: string, origin: TL, target: TL)` and provide a corresponding string or `null` if this is a new string to the `origin` argument. The `target` will be the new string to attach. In other words, we add a translation by associating it with an existing translation entry in a different language or with `null` if this is a new string with no pre-existing translation.
```js
// This is a new string so we associate it with `null`
const myGreeting = TL.tl`Hello world!`;
TL.addTranslation("en", null, myGreeting);

// This is a translated string with the same meaning as `myGreeting`
// so we associate the two as the same meaning
const myGermanGreeting = TL.tl`Hallo Welt!`;
TL.addTranslation("de", myGreeting, myGermanGreeting);
```

Now we can translate from either string into either languages
```js
console.log(myGreeting.toString("de")) // Prints "Hallo Welt!"
console.log(myGermanGreeting.toString("en")) // Prints "Hello world!"
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

To resolve this, rather than resorting to some kind of hash table which introduces another layer of complexity, we reuse what we already have which is the origin string. If we can define the interpolated variable in relation to the origin string, the order of the variables will be unambiguous. We can do this in two ways, the first is to obtain a list or ordered variable tokens from the origin string.

```js
const statement1 = Tl.tl`Alex has ${num} ${device}`;
TL.addTranslation("en", null, statement1);

const [token1, token2] = statement1.getIterator();
const statement2 = Tl.tl`アレックスは${token2}を${token1}台持っている。`;
TL.addTranslation("jp", statement1, statement2);

// Since the tokens are generated from `statement1`, only `statement1` can be
// used as origin string for translations strings using these tokens
const statement3 = Tl.tl`Alex besitzt ${token1} ${token2}`;
TL.addTranslation("de", statement1, statement3);
```

The second way is to pre-generate tokens that can be used in both the origin and the target string.
```js
const [token1, token2] = TL.createIterator();
const statement1 = Tl.tl`Alex has ${token1} ${token2}`;
const statement2 = Tl.tl`アレックスは${token2}を${token1}台持っている。`;
const statement3 = Tl.tl`Alex besitzt ${token1} ${token2}`;
TL.addTranslation("en", null, statement1);
TL.addTranslation("en", statement1, statement2);
TL.addTranslation("en", statement1, statement3);
```