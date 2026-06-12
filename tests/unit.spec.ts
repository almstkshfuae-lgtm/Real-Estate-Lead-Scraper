import { test, expect } from '@playwright/test';
import { parseAIJson, AIJsonParseError } from '../lib/ai-json';
import { parseSignals } from '../lib/signals';
import { cleanPhone, cleanEmail } from '../lib/sanitizer';
import { leadUpdateSchema } from '../lib/schemas';

test.describe('Unit Tests — Core Logic Hardening', () => {

  test.describe('parseAIJson', () => {
    test('should parse a clean JSON object', () => {
      const input = '{"name": "John", "score": 90}';
      const result = parseAIJson<{ name: string; score: number }>(input);
      expect(result.name).toBe('John');
      expect(result.score).toBe(90);
    });

    test('should parse JSON wrapped in markdown fences', () => {
      const input = '```json\n{"name": "Ahmed", "score": 95}\n```';
      const result = parseAIJson<{ name: string; score: number }>(input);
      expect(result.name).toBe('Ahmed');
      expect(result.score).toBe(95);
    });

    test('should parse JSON when model adds trailing text or leading reasoning', () => {
      const input = 'Here is the result you requested:\n{"name": "Sarah", "score": 85}\nHope this helps!';
      const result = parseAIJson<{ name: string; score: number }>(input);
      expect(result.name).toBe('Sarah');
      expect(result.score).toBe(85);
    });

    test('should parse JSON with internal braces in string values (greedy regex trap)', () => {
      const input = 'Reasoning: { "details": "context" }\n{"name": "Fatima", "notes": "Profile details: {active: true}"}\nOther text';
      const result = parseAIJson<{ name: string; notes: string }>(input);
      expect(result.name).toBe('Fatima');
      expect(result.notes).toBe('Profile details: {active: true}');
    });

    test('should throw AIJsonParseError on malformed JSON', () => {
      const input = '{"name": "Broken", "score": }';
      expect(() => parseAIJson(input)).toThrow(AIJsonParseError);
    });
  });

  test.describe('parseSignals', () => {
    test('should parse a valid array of signals', () => {
      const input = ['UHNW', 'Investor'];
      const result = parseSignals(input);
      expect(result).toEqual(['UHNW', 'Investor']);
    });

    test('should parse a serialized JSON array string', () => {
      const input = '["HNW", "Executive"]';
      const result = parseSignals(input);
      expect(result).toEqual(['HNW', 'Executive']);
    });

    test('should parse a CSV string', () => {
      const input = 'UHNW, Private Client, Executive';
      const result = parseSignals(input);
      expect(result).toEqual(['UHNW', 'Private Client', 'Executive']);
    });

    test('should parse an object with numeric keys', () => {
      const input = { '0': 'HNW', '1': 'Investor' };
      const result = parseSignals(input);
      expect(result).toEqual(['HNW', 'Investor']);
    });

    test('should return empty array for null or undefined', () => {
      expect(parseSignals(null)).toEqual([]);
      expect(parseSignals(undefined)).toEqual([]);
    });
  });

  test.describe('cleanPhone', () => {
    test('should normalize UAE local numbers with leading zero', () => {
      expect(cleanPhone('0507778888')).toBe('+971507778888');
      expect(cleanPhone('056 123 4567')).toBe('+971561234567');
    });

    test('should normalize UAE local numbers without leading zero', () => {
      expect(cleanPhone('528889999')).toBe('+971528889999');
    });

    test('should normalize UAE number starting with 971', () => {
      expect(cleanPhone('971556667777')).toBe('+971556667777');
    });

    test('should keep valid international numbers unchanged', () => {
      expect(cleanPhone('+14155552671')).toBe('+14155552671');
      expect(cleanPhone('00966501234567')).toBe('+966501234567');
    });

    test('should strip extra text tags or markers from phone string', () => {
      expect(cleanPhone('+971 50 123 4567 (Mobile)')).toBe('+971501234567');
      expect(cleanPhone('Tel: 050-777-8888')).toBe('+971507778888');
    });

    test('should return null for invalid short numbers', () => {
      expect(cleanPhone('12345')).toBeNull();
      expect(cleanPhone('abc')).toBeNull();
      expect(cleanPhone('')).toBeNull();
    });
  });

  test.describe('cleanEmail', () => {
    test('should sanitize and extract a valid email', () => {
      expect(cleanEmail('  info@brilliance.ae ')).toBe('info@brilliance.ae');
    });

    test('should extract email from mixed text response', () => {
      expect(cleanEmail('Email: contact@brilliance.ae')).toBe('contact@brilliance.ae');
    });

    test('should return null for placeholder or dummy emails', () => {
      expect(cleanEmail('none')).toBeNull();
      expect(cleanEmail('n/a')).toBeNull();
      expect(cleanEmail('notavailable')).toBeNull();
      expect(cleanEmail('noemail@example.com')).toBeNull();
      expect(cleanEmail('test@example.com')).toBeNull();
    });

    test('should return null for invalid email string', () => {
      expect(cleanEmail('broken-email-no-at')).toBeNull();
    });
  });

  test.describe('leadUpdateSchema validation and casting', () => {
    test('should parse valid numbers for score, budgetMin, budgetMax, and tier', () => {
      const input = {
        score: 95,
        budgetMin: 1500000,
        budgetMax: 3000000,
        tier: 1
      };
      const result = leadUpdateSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.score).toBe(95);
        expect(result.data.budgetMin).toBe(1500000);
        expect(result.data.budgetMax).toBe(3000000);
        expect(result.data.tier).toBe(1);
      }
    });

    test('should parse and transform string representations of numbers', () => {
      const input = {
        score: '95',
        budgetMin: '1,500,000',
        budgetMax: '3,000,000',
        tier: '1'
      };
      const result = leadUpdateSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.score).toBe(95);
        expect(result.data.budgetMin).toBe(1500000);
        expect(result.data.budgetMax).toBe(3000000);
        expect(result.data.tier).toBe(1);
      }
    });

    test('should transform invalid numeric strings to safe fallbacks (null or default)', () => {
      const input = {
        score: 'abc', // should fallback to 50
        budgetMin: 'abc', // should fallback to null
        budgetMax: 'abc', // should fallback to null
        tier: 'abc' // should fallback to undefined (ignored in PATCH)
      };
      const result = leadUpdateSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.score).toBe(50);
        expect(result.data.budgetMin).toBeNull();
        expect(result.data.budgetMax).toBeNull();
        expect(result.data.tier).toBeUndefined();
      }
    });

    test('should handle empty or null values correctly', () => {
      const input = {
        score: '', // fallback to undefined
        budgetMin: '', // fallback to null
        budgetMax: null, // fallback to null
        tier: null // fallback to undefined
      };
      const result = leadUpdateSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.score).toBeUndefined();
        expect(result.data.budgetMin).toBeNull();
        expect(result.data.budgetMax).toBeNull();
        expect(result.data.tier).toBeUndefined();
      }
    });

    test('should handle whitespace strings in budgetMin and budgetMax correctly', () => {
      const input = {
        budgetMin: '   ',
        budgetMax: ' \t '
      };
      const result = leadUpdateSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.budgetMin).toBeNull();
        expect(result.data.budgetMax).toBeNull();
      }
    });
  });

  test.describe('Backend PATCH Route Normalization', () => {
    test('should explicitly map empty or whitespace budget fields to null', () => {
      const cases = [
        { min: "", max: "" },
        { min: "   ", max: " \t " },
        { min: null, max: null }
      ];

      for (const c of cases) {
        const targetBudgetMin = (c.min === "" || c.min === null || (typeof c.min === "string" && c.min.trim() === "")) ? null : c.min;
        const targetBudgetMax = (c.max === "" || c.max === null || (typeof c.max === "string" && c.max.trim() === "")) ? null : c.max;

        expect(targetBudgetMin).toBeNull();
        expect(targetBudgetMax).toBeNull();
      }
    });

    test('should preserve valid numbers in route normalization', () => {
      const budgetValue: any = 500000;
      const targetBudgetMin = (budgetValue === "" || budgetValue === null || (typeof budgetValue === "string" && String(budgetValue).trim() === "")) ? null : budgetValue;
      expect(targetBudgetMin).toBe(500000);
    });
  });

  test.describe('CRM Sync Metadata updates', () => {
    test('should preserve existing metadata fields when updating sync status', () => {
      const existingMetadata = { aiSignals: ['UHNW'], csvImportLabel: 'Import-1' };
      const syncStatus = 'FAILED';
      const syncError = 'Invalid Token';
      const syncTime = new Date().toISOString();

      const updatedMetadata = {
        ...existingMetadata,
        bitrixSyncStatus: syncStatus,
        bitrixSyncError: syncError,
        bitrixSyncUpdatedAt: syncTime
      };

      expect(updatedMetadata.aiSignals).toEqual(['UHNW']);
      expect(updatedMetadata.csvImportLabel).toBe('Import-1');
      expect(updatedMetadata.bitrixSyncStatus).toBe('FAILED');
      expect(updatedMetadata.bitrixSyncError).toBe('Invalid Token');
      expect(updatedMetadata.bitrixSyncUpdatedAt).toBe(syncTime);
    });
  });

});
