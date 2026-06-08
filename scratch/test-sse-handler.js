import { GET } from "../app/api/scrape-runs/[id]/sse/route.js";
import { createToken } from "../lib/auth.js";
import { NextRequest } from "next/server";
import dotenv from "dotenv";
dotenv.config();
async function runTest() {
    var _a;
    console.log("Starting SSE handler test...");
    // 1. Create a valid token for the admin user
    const adminUser = {
        id: "cmpvk2pax0000429mv9ufyakx",
        email: "admin@brilliance.ae",
        role: "admin"
    };
    const token = await createToken(adminUser);
    console.log("Generated JWT Token:", token);
    // 2. Prepare mock NextRequest and params
    const runId = "cmq2pighf0000zsqv59ubcipo"; // COMPLETED run ID
    const url = `http://localhost:3000/api/scrape-runs/${runId}/sse`;
    const request = new NextRequest(url, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });
    const params = Promise.resolve({ id: runId });
    // 3. Invoke the GET handler
    console.log(`Invoking SSE GET handler for run: ${runId}`);
    const response = await GET(request, { params });
    console.log("Response status:", response.status);
    console.log("Response headers:", Object.fromEntries(response.headers.entries()));
    if (!response.ok) {
        const text = await response.text();
        console.error("Error response content:", text);
        return;
    }
    // 4. Read the stream
    const reader = (_a = response.body) === null || _a === void 0 ? void 0 : _a.getReader();
    if (!reader) {
        console.error("No body reader found on response!");
        return;
    }
    const decoder = new TextDecoder();
    let done = false;
    console.log("\n--- Stream Data ---");
    while (!done) {
        const { value, done: isDone } = await reader.read();
        done = isDone;
        if (value) {
            const chunk = decoder.decode(value);
            console.log(chunk);
        }
    }
    console.log("--- Stream Finished ---");
}
runTest().catch(console.error);
