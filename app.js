import express from "express";
import {createHash} from 'crypto';
import {z} from "zod";
import nlp from "compromise";


const app = express();
const PORT = process.env.PORT || 3000;
const stringdb = {};
const typeInt = z.coerce.number().int().optional();
const typeStr = z.string().optional();
const typeBool = z.coerce.boolean().optional();
const reqSchema = z.object({"is_palindrome":typeBool,"min_length":typeInt,
    "max_length":typeInt,"word_count": typeInt,
    "contains_character":typeStr});
app.use(express.json());

function getLength(string) {
    return string.length;
}


function isPalindrome(string) {
  const cleaned = string
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // keep only letters and digits
  const reversed = [...cleaned].reverse().join("");
  return cleaned === reversed;
}



function getUniqueCharactersCount(string) {
    const uniqueCharacters = new Set(string);
    return uniqueCharacters.size;
}


function getWordCount(string) {

    let wordArray = string.split(" ");
    wordArray = wordArray.filter(x => x !== "");
    return wordArray.length;
}


function getSha256Hash(string) {
    const hash = createHash('sha256').update(string,"utf-8").digest('hex');
    return hash;
}


function createFreqMap(string) {
    let freqMap = {};
    for (let i = 0; i<string.length; i++) {
        let char = string[i];
        if (char in freqMap) {
            freqMap[char] += 1;
        }
        else {
            freqMap[char] = 1;
        } 
    }
    return freqMap;
}


function palindrome_filter(is_palindrome, db_value) {
    if (is_palindrome !== undefined) {
        return db_value["properties"]["is_palindrome"] === is_palindrome;
    }
    return true;
}


function word_count_filter(word_count, db_value) {
    if (word_count !== undefined) {
        return db_value["properties"]["word_count"] === word_count;
    }
    return true;
}


function contains_character_filter(character, db_value) {
    if (character !== undefined) {
        return (character in db_value["properties"]["character_frequency_map"]);
    }
    return true;
}


function applyFilter(is_palindrome,word_count,character,min_length,max_length,db_value) {
    const length = db_value["properties"]["length"];
    return (palindrome_filter(is_palindrome,db_value) && word_count_filter (word_count,db_value) 
    && contains_character_filter (character,db_value) && (min_length === undefined || length >= min_length)
     && (max_length === undefined || length <= max_length));
}


function parseNaturalLanguage(query) {
  const doc = nlp(query.toLowerCase());
  const filters = {};

  // Normalize query text
  const text = query.toLowerCase();

  // === Palindrome detection ===
  if (text.includes("palindrome") || text.includes("palindromic"))
    filters.is_palindrome = true;
  if (text.includes("non-palindrome") || text.includes("not palindrome"))
    filters.is_palindrome = false;

  // === Word count ===
  if (text.includes("single word") || text.includes("one word"))
    filters.word_count = 1;
  else if (text.includes("double word") || text.includes("two words"))
    filters.word_count = 2;
  else if (text.match(/(\d+)\s+word/)) {
    const num = parseInt(text.match(/(\d+)\s+word/)[1]);
    if (!isNaN(num)) filters.word_count = num;
  }

  // === Length comparisons ===
  const numbers = doc.numbers().toNumber().out("array");
  const num = numbers?.[0];

  if (text.includes("longer than") && num) filters.min_length = num + 1;
  else if (text.includes("at least") && num) filters.min_length = num;
  else if (text.includes("shorter than") && num) filters.max_length = num - 1;
  else if (text.includes("at most") && num) filters.max_length = num;

  // === Contains specific character ===
  const charMatch =
    text.match(/letter\s+([a-z])/i) || text.match(/character\s+([a-z0-9])/i);
  if (charMatch) filters.contains_character = charMatch[1].toLowerCase();

  // === Heuristics for vowels ===
  if (text.includes("first vowel") || text.includes("vowel"))
    filters.contains_character = "a";

  // === Edge-case heuristic examples ===
  if (text.includes("empty") || text.includes("blank"))
    filters.min_length = 0;
  if (text.includes("spaces") || text.includes("multi-word"))
    filters.word_count = { $gt: 1 }; // pseudo-operator style

  // === Conflict resolution ===
  const conflicting =
    filters.min_length && filters.max_length && filters.min_length > filters.max_length;
  if (conflicting)
    throw new Error("422 Unprocessable Entity: conflicting filters");
  if (!Object.keys(filters).length)

    throw new Error("400 Bad Request: unable to parse query");

  return {
    interpreted_query: {
      original: query,
      parsed_filters: filters,
    },
  };
}


app.post("/strings",(req,res) => {
    let {value, ...rest} = req.body;
    if(!value || Object.keys(rest).length > 0) {
        return res.status(400).send('Invalid request body or missing "value" field');
    }

    if (value in stringdb) {
        return res.status(409).send("String already exists in system");
    }

    if (typeof value != "string") {
        return res.status(422).send('Invalid data type for "value" (must be string)');
    }
    const currentTime = new Date().toISOString();
    const returnObj = {
        "id" : getSha256Hash(value),
        "properties" : {
        "value" : value,
            "length" : getLength(value),
            "is_palindrome" : isPalindrome(value),
            "word_count" : getWordCount(value),
            "unique_characters" : getUniqueCharactersCount(value),
            "sha256_hash" : getSha256Hash(value),
            "character_frequency_map" : createFreqMap(value)
        },
        "created_at": currentTime
    };
    stringdb[value] = returnObj;
    res.status(201).send(returnObj);
});


app.get("/strings", (req,res) => {
    const result = reqSchema.safeParse(req.query)
    if (!result.success) {
        return res.status(400).send("Invalid query parameter values or types");
    }
    const {is_palindrome,min_length,max_length,word_count,contains_character} = result.data;
    var returnData = [];
    for (const entry in stringdb) {
        if (applyFilter(is_palindrome,word_count,contains_character,min_length,max_length,stringdb[entry])) {
            returnData.push(entry);
    }
}
    const responseObj = {
        "data" : returnData,
        "count" : returnData.length,
        "filters_applied" : result.data
    }
    res.status(200).send(responseObj);
});


app.get("/strings/filter-by-natural-language", (req,res) => {
    try {
        const {query} = req.query;
        console.log(query);
        const filterDict = parseNaturalLanguage(query)["interpreted_query"]["parsed_filters"];
        console.log(filterDict);
        const {is_palindrome,min_length,
    max_length,word_count,
    contains_character} = filterDict;
        var returnData = [];
    for (const entry in stringdb) {
        if (applyFilter(is_palindrome,word_count,contains_character,min_length,max_length,stringdb[entry])) {
            returnData.push(entry);
    }
}
    const responseObj = {
        "data" : returnData,
        "count" : returnData.length,
        "filters_applied" : filterDict
    }
    res.status(200).send(responseObj);
    }

    catch(err) {
        if (err.message.startsWith("400")) {
            return res.status(400).send("Unable to parse natural language query");
        }
        if (err.message.startsWith("422")) {
            return res.status(422).send("Query parsed but resulted in conflicting filters");
        }
    }
    
});


app.delete("/strings/:string_value", (req,res) => {
    const str = req.params.string_value;
    if (!(str in stringdb)) {
        return res.status(404).send("String does not exist in the system");
    }
    delete stringdb[str];
    res.status(204).end();
});


app.get("/strings/:string_value", (req,res) => {
    const str = req.params.string_value;
    if(!(str in stringdb)) {
        return res.status(404).send("String does not exist in the system");
    }
    res.status(200).json(stringdb[str]);
});


app.listen(PORT, () => {console.log(`Server started at port ${PORT}`)})
