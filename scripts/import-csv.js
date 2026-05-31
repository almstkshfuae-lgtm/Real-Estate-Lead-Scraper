import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import Papa from 'papaparse';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envLocalPath });
dotenv.config({ path: envPath });

const prisma = new PrismaClient();

async function ensureTestUser() {
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'test.user@local',
        passwordHash: 'testhash',
        name: 'Test User',
        role: 'agent'
      }
    });
    console.log('Created test user:', user.id);
  } else {
    console.log('Found existing user:', user.id);
  }
  return user;
}

async function parseCsv(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) {
    console.error('CSV parse errors:', parsed.errors);
    throw new Error('Failed to parse CSV');
  }
  return parsed.data;
}

async function main() {
  try {
    const csvPath = process.argv[2] || path.resolve(process.cwd(), 'scripts', 'sample-leads.csv');
    const user = await ensureTestUser();
    const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    console.log(`Auth token:\n${token}\n`);

    const leads = await parseCsv(csvPath);
    console.log(`Parsed ${leads.length} leads from ${csvPath}`);

    const base = process.env.SCRAPER_SERVICE_URL || 'http://localhost:3000';
    const url = `${base.replace(/\/$/, '')}/api/leads/import`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `auth_token=${token}`
      },
      body: JSON.stringify({ leads })
    });

    const body = await res.text();
    console.log('Import status:', res.status);
    try { console.log('Response JSON:', JSON.parse(body)); } catch { console.log('Response text:', body); }
  } catch (err) {
    console.error('Import script error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
