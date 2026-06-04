"use strict";
// Test script for Profile Settings email validation logic
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const testCases = [
    { email: 'test@example.com', expected: true },
    { email: 'TEST@EXAMPLE.COM', expected: true },
    { email: '  test@example.com  ', expected: true, clean: 'test@example.com' },
    { email: 'test.email+alex@example.co.uk', expected: true },
    { email: 'invalid-email', expected: false },
    { email: 'invalid@email', expected: false },
    { email: '@example.com', expected: false },
    { email: 'test@.com', expected: false },
    { email: '', expected: false },
    { email: null, expected: false },
    { email: undefined, expected: false },
];
console.log('--- Testing Email Sanitization and Regex ---');
let success = true;
for (const tc of testCases) {
    const emailVal = tc.email;
    const cleanEmail = typeof emailVal === 'string' ? emailVal.trim().toLowerCase() : '';
    const isValid = emailRegex.test(cleanEmail);
    const matchesExpected = isValid === tc.expected;
    if (matchesExpected) {
        console.log(`✅ Input: "${emailVal}" -> Cleaned: "${cleanEmail}" -> Valid: ${isValid}`);
    }
    else {
        console.error(`❌ Input: "${emailVal}" -> Cleaned: "${cleanEmail}" -> Valid: ${isValid} (Expected: ${tc.expected})`);
        success = false;
    }
}
if (success) {
    console.log('\n🎉 All test cases passed successfully!');
}
else {
    console.error('\n❌ Some test cases failed!');
    process.exit(1);
}
