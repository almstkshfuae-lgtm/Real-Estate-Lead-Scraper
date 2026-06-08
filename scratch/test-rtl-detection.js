"use strict";
function detect(text) {
    const isAr = /[\u0600-\u06FF]/.test(text);
    return {
        isAr,
        dir: isAr ? "rtl" : "ltr",
        lang: isAr ? "ar" : "en"
    };
}
console.log("English text:", detect("Hello, how are you?"));
console.log("Mixed text starting with English:", detect("Hello, مرحبا بك"));
console.log("Arabic text:", detect("مرحبا بك في سوق العقارات"));
console.log("Empty text:", detect(""));
console.log("Special characters:", detect("!!! 123"));
