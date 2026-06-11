import { deduplicateSignals } from '../lib/ai';
import { parseSignals } from '../lib/signals';

console.log('--- Test deduplicateSignals ---');
const input1 = ['UHNW', 'Manual Import', 'Equestrian Investor', 'scraper', 'watchdog', 'valid tag'];
const output1 = deduplicateSignals(input1);
console.log('Input:', input1);
console.log('Output:', output1);
const expected1 = ['UHNW', 'Equestrian Investor', 'valid tag'];
const pass1 = JSON.stringify(output1) === JSON.stringify(expected1);
console.log('deduplicateSignals Test:', pass1 ? 'PASS' : 'FAIL');

console.log('--- Test parseSignals ---');
const input2 = '["UHNW", "Manual Import", "scraper"]';
const output2 = parseSignals(input2);
console.log('Input:', input2);
console.log('Output:', output2);
const expected2 = ['UHNW'];
const pass2 = JSON.stringify(output2) === JSON.stringify(expected2);
console.log('parseSignals (JSON array) Test:', pass2 ? 'PASS' : 'FAIL');

const input3 = 'UHNW, manual_import, valid tag, cron-job';
const output3 = parseSignals(input3);
console.log('Input:', input3);
console.log('Output:', output3);
const expected3 = ['UHNW', 'valid tag'];
const pass3 = JSON.stringify(output3) === JSON.stringify(expected3);
console.log('parseSignals (CSV string) Test:', pass3 ? 'PASS' : 'FAIL');
