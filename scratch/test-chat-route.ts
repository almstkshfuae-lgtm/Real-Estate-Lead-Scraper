import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Module = require('module');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev-only';

// Generate a valid token
const payload = {
  id: "cmpvk2pax0000429mv9ufyakx",
  email: "admin@brilliance.ae",
  role: "admin"
};
const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
console.log("Generated Auth Token:", token);

// Intercept next/headers to mock it
const originalRequire = Module.prototype.require;
Module.prototype.require = function(request: string) {
  if (request === 'next/headers') {
    return {
      cookies: async () => ({
        get: (name: string) => {
          if (name === 'auth_token') {
            return { value: token };
          }
          return undefined;
        }
      }),
      headers: async () => new Headers({
        'Authorization': `Bearer ${token}`
      })
    };
  }
  return originalRequire.apply(this, arguments);
};

async function main() {
  // Import route handlers after mocking next/headers!
  const { POST } = await import('../app/api/ai/chat/route');

  // Create a mock NextRequest
  const req = new NextRequest('http://localhost:3000/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'What is the best real estate investment area in Abu Dhabi?' }],
      lang: 'en',
      context: 'Real estate leads list'
    })
  });

  console.log("Invoking POST /api/ai/chat...");
  try {
    const response = await POST(req);
    console.log("Response status:", response.status);
    
    if (response.status === 200) {
      console.log("Stream responded! Reading stream...");
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader!.read();
        done = doneReading;
        if (value) {
          console.log("Chunk:", decoder.decode(value));
        }
      }
    } else {
      const text = await response.text();
      console.log("Response body:", text);
    }
  } catch (err: any) {
    console.error("POST call failed with error:", err);
  }
}

main().catch(console.error);
