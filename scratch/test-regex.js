"use strict";
const chunkText = `[{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "Why don't scientists trust"
          }
        ],
        "role": "model"
      },
      "finishReason": "MAX_TOKENS",
      "index": 0
    }
  ]
}]`;
const textRegex = /"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
let match;
const matches = [];
while ((match = textRegex.exec(chunkText)) !== null) {
    try {
        matches.push(JSON.parse(`"${match[1]}"`));
    }
    catch {
        matches.push(match[1]);
    }
}
console.log("Matches found:", matches);
console.log("Joined:", matches.join(""));
