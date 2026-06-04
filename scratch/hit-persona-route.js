var _a;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const rawSecret = (_a = process.env.JWT_SECRET) === null || _a === void 0 ? void 0 : _a.trim();
const JWT_SECRET = (rawSecret && rawSecret !== '') ? rawSecret : 'dev-secret-key-change-in-production';
async function main() {
    const prisma = (await import('../lib/prisma')).default;
    // Find a valid user to act as agent
    const user = await prisma.user.findFirst({
        where: { role: 'admin' }
    }) || await prisma.user.findFirst();
    if (!user) {
        console.error("No users found in database to authenticate!");
        return;
    }
    // Find a lead
    const lead = await prisma.lead.findFirst();
    if (!lead) {
        console.error(`No leads found!`);
        return;
    }
    // Generate a valid token
    const payload = {
        id: user.id,
        email: user.email,
        role: user.role
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    console.log("Authenticated as:", user.email, "(Role:", user.role, ")");
    console.log("Lead ID:", lead.id);
    const url = `http://localhost:3000/api/leads/${lead.id}/persona?lang=ar`;
    console.log(`Sending GET request to ${url} ...`);
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Cookie': `auth_token=${token}`
            }
        });
        console.log("HTTP Status:", response.status);
        const body = await response.json();
        console.log("HTTP Response:", JSON.stringify(body, null, 2));
        if (response.ok) {
            console.log("\nSuccess: Endpoint returned the persona successfully!");
        }
        else {
            console.error("\nError: Endpoint returned an error status.");
        }
    }
    catch (err) {
        console.error("\nError: Fetch request failed:", err);
    }
    finally {
        await prisma.$disconnect();
    }
}
main().catch(console.error);
