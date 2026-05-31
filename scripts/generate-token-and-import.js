import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

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

async function main() {
  try {
    const user = await ensureTestUser();
    const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    console.log('Generated token (truncated):', token.substring(0, 30) + '...');

    const lead = {
      name: 'Generated Test Lead',
      email: 'generated.test@example.com',
      phone: '+971500000000',
      company: 'Generated Co',
      role: 'Manager',
      location: 'Dubai'
    };

    const res = await fetch('http://localhost:3000/api/leads/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `auth_token=${token}`
      },
      body: JSON.stringify({ leads: [lead] })
    });

    const text = await res.text();
    console.log('Import response status:', res.status);
    try { console.log('Import response JSON:', JSON.parse(text)); } catch { console.log('Import response text:', text); }
  } catch (err) {
    console.error('Script error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
