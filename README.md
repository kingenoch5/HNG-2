````markdown
# String Management API

An Express.js API to store, filter, and manage strings with natural language filtering and properties like palindrome detection, word count, and character frequency.

## Installation

```bash
git clone <repo-url>
cd <repo-folder>
npm install
npm start
````

The server runs on `http://localhost:3000`.

## Endpoints

### POST /strings

Add a new string.

**Request Body:**

```json
{
  "value": "example"
}
```

**Responses:**

* `201 Created` Returns string properties.
* `400 Bad Request` Missing or invalid `value`.
* `409 Conflict` String exists.
* `422 Unprocessable Entity` Invalid type.

### GET /strings

Retrieve strings with filters.

**Query Parameters:**

* `is_palindrome` (boolean)
* `min_length` (integer)
* `max_length` (integer)
* `word_count` (integer)
* `contains_character` (string)

**Example:**

```bash
curl "http://localhost:3000/strings?is_palindrome=true&min_length=5"
```

### GET /strings/filter-by-natural-language

Retrieve strings using natural language query.

**Query Parameter:**

* `query` (string)

**Example:**

```bash
curl "http://localhost:3000/strings/filter-by-natural-language?query=all%20single%20word%20palindromic%20strings"
```

### GET /strings/:string_value

Retrieve a specific string.

**Example:**

```bash
curl "http://localhost:3000/strings/level"
```

### DELETE /strings/:string_value

Delete a specific string.

**Example:**

```bash
curl -X DELETE "http://localhost:3000/strings/level"
```

## Filters

Filters can be applied using query parameters or natural language queries:

* Palindrome detection (`is_palindrome`)
* Minimum/maximum length (`min_length`, `max_length`)
* Word count (`word_count`)
* Contains specific character (`contains_character`)

Natural language examples:

* `"single word"` → `word_count = 1`
* `"palindromic"` → `is_palindrome = true`
* `"longer than 5"` → `min_length = 6`
* `"contains letter a"` → `contains_character = "a"`

## Notes

* `/strings/:string_value` may conflict with special routes; avoid naming strings like `filter-by-natural-language`.
* SHA256 hash is used as unique ID.
* Data is stored in-memory (`stringdb`), resets on server restart.

## Example Workflow

1. Add string:

```bash
curl -X POST -H "Content-Type: application/json" -d '{"value":"level"}' http://localhost:3000/strings
```

2. Get palindromes:

```bash
curl "http://localhost:3000/strings?is_palindrome=true"
```

3. Filter via natural language:

```bash
curl "http://localhost:3000/strings/filter-by-natural-language?query=single%20word%20palindromes%20longer%20than%204"
```

4. Get string details:

```bash
curl "http://localhost:3000/strings/level"
```

5. Delete string:

```bash
curl -X DELETE "http://localhost:3000/strings/level"
```

```
```
