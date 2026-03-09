class TL {
	static translations = {};

	strings: TemplateStringsArray;
	values: any[];

	constructor(strings: TemplateStringsArray, values: any[]){
		this.strings = strings;
		this.values = values;
	}

	static tl(strings: TemplateStringsArray, ...values: any[]){
		return new TL(strings, values);
	}

	static addTranslation(lang: string, origin: TL, target: TL){
		if(!TL.translations[origin.hash()]) TL.translations[origin.hash()] = {};
		TL.translations[origin.hash()][lang] = target;
	}

	toString(lang?: string){
		let tlObject = this;
		if(lang){
			const translatedString = TL.translations[this.hash()]?.[lang];
			if(translatedString) tlObject = translatedString;
		}

		let result = "";
		for(let i=0; i<tlObject.strings.length; i++){
			result += tlObject.strings[i] + (tlObject.values?.[i] ?? "");
		}
		return result;
	}

	hash(){
		return this.strings.join("---");
	}
}

const n = "K";
const num = 42;
const myString = TL.tl`My name is ${n}. The number is ${num}.`;
const myString2 = TL.tl`私の名前は${n}です。番号は${num}です。`;

TL.addTranslation("en", myString, myString);
TL.addTranslation("jp", myString, myString2);

// NEXT: Make `origin` in `addTranslation` able to take any language string

// Print string as defined
console.log("DEFAULT:", myString.toString());
// Print en string
console.log("EN:", myString.toString("en"));
// Print jp string
console.log("JP:", myString.toString("jp"));