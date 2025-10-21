import express from "express";
import {createHash} from 'crypto';
const app = express();
const PORT = process.env.PORT || 3000;
const stringdb = {};
const allowedQueries = {"is_palindrome":"boolean","min_length":"number",
    "max_length":"number","word_count":"number",
    "contains_character":"string"};
app.use(express.json());

function getLength(string) {
    return string.length;
}


function isPalindrome(string) {
    const reversedString = string.split("").reverse.join("");
    return string === reversedString;
}


function getUniqueCharactersCount(string) {
    const uniqueCharacters = new Set(string);
    return uniqueCharacters.size;
}

function getWordCount(string) {
    const wordArray = string.split(" ");
    wordArray = wordArray.filter((x) >= x === "");
    return wordArray.length;
}

function getSha256Hash(string) {
    const hash = createHash('sha256').update(string,"utf-8").digest('hex');
    return hash;
}

function createFreqMap(string) {
    const freqMap = {};
    for (const i = 0; i<string.length; i++) {
        let char = string[i];
        if (char in freqMap) {
            freqMap.char += 1;
        }
        else {
            freqMap.char = 1;
        } 
    }
    return freqMap;
}

function palindrome_filter(is_palindrome, db_value) {
    if (is_palindrome !== undefined) {
        return db_value["properties"]["is_palindrome"] = is_palindrome;
    }
}

function word_count_filter(word_count, db_value) {
    if (word_count !== undefined) {
        return db_value["properties"]["word_count"] = word_count;
    }
}

function contains_character_filter(character, db_value) {
    if (character !== undefined) {
        return character in db_value["properties"]["character_frequency_map"];
    }
}

function applyFilter(is_palindrome,word_count,character,min_length,max_length,db_value) {
    const length = db_value["properties"]["length"];
    return (palindrome_filter(is_palindrome,db_value) && word_count_filter (word_count,db_value) 
    && contains_character_filter (character,db_value) && (min_length === undefined || length >= min_length)
     && (max_length === undefined || length <= max_length));
}

app.post("/strings",(req,res) => {
    const {value, ...rest} = req.body;
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
        "value" : value,
        "id" : getSha256Hash(value),
        "properties" : {
            "length" : getLength(value),
            "is_palindrome" : isPalindrome(value),
            "unique_characters" : getUniqueCharactersCount(value),
            "word_count" : getWordCount(value),
            "sha256_hash" : getSha256Hash(value),
            "character_frequency_map" : createFreqMap(value)
        },
        "created_at": currentTime
    };
    stringdb[value] = returnObj;
    res.status(201).send(returnObj);
});


app.get("/strings/:string_value", (req,res) => {
    const str = req.params.string_value;
    if(!(str in stringdb)) {
        return res.status(404).send("String does not exist in the system");
    }
    res.status(200).json(stringdb[str]);
})

app.get("/strings", (req,res) => {
    const entries = Object.entries(req.query);
    const {is_palindrome,min_length,max_length,word_count,contains_character} = req.query;
    const invalid = entries.filter(([key, value]) => !(key in allowedQueries) || (String(typeof value) !== allowedQueries[key]));
    if (invalid.length > 0) {
        return res.status(400).send("Invalid query parameter values or types");
    }
    returnData = [];
    for (const entry in stringdb) {
        if (applyFilter(is_palindrome,word_count,contains_character,min_length,max_length)) {
            returnData.push(entry);
        }
    }
    responseObj = {
        "data" : returnData,
        "count" : returnData.length,
        "filters_applied" : Object.fromEntries(entries)
    }
    res.status(200).send(responseObj);
});
