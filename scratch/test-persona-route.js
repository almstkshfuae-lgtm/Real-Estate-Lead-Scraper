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
    // Find a lead belonging to this user or any lead if user is admin
    const lead = await prisma.lead.findFirst({
        where: user.role === 'admin' ? {} : { agentId: user.id }
    });
    if (!lead) {
        console.error(`No leads found for user ${user.id}!`);
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
    console.log("Generated Auth Token:", token.substring(0, 15) + "...");
    // Intercept next/headers to mock it
    const originalRequire = Module.prototype.require;
    Module.prototype.require = function (request) {
        if (request === 'next/headers') {
            return {
                cookies: async () => ({
                    get: (name) => {
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
    // Import route handler after mocking next/headers!
    const { GET } = await import('../app/api/leads/[id]/persona/route');
    // Create a mock NextRequest
    const req = new NextRequest(`http://localhost:3000/api/leads/${lead.id}/persona?lang=en`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    console.log(`Invoking GET /api/leads/${lead.id}/persona?lang=en ...`);
    try {
        const response = await GET(req, { params: Promise.resolve({ id: lead.id }) });
        console.log("Response status:", response.status);
        const body = await response.json();
        console.log("Response body:", JSON.stringify(body, null, 2));
        if (response.status === 200) {
            console.log("Route handler successfully generated and returned the persona!");
            // Let's verify if the database cache is updated
            const updatedLead = await prisma.lead.findUnique({
                where: { id: lead.id }
            });
            console.log("Cached persona in DB:", updatedLead === null || updatedLead === void 0 ? void 0 : updatedLead.persona);
        }
        else {
            console.error("Route execution failed!");
        }
    }
    catch (err) {
        console.error("GET call failed with error:", err);
    }
    finally {
        await prisma.$disconnect();
    }
}
main().catch(console.error);
