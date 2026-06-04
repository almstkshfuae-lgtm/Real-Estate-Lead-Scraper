import { NextRequest } from "next/server";
import { POST } from "../app/api/ai/pitch/route";
async function main() {
    const mockLead = {
        id: "test-id",
        name: "John Doe",
        company: "Test Corp",
        role: "Director",
        score: 85,
        tier: 2,
        signals: ["Investor", "Business Owner"],
        budgetMin: 1000000,
        budgetMax: 2000000,
        location: "Dubai Marina"
    };
    // Replicate NextRequest
    const req = new NextRequest("http://localhost:3000/api/ai/pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            lead: mockLead,
            lang: "en",
            style: "professional"
        })
    });
    console.log("Calling POST /api/ai/pitch route handler...");
    try {
        const response = await POST(req);
        console.log("Status:", response.status);
        const data = await response.json();
        console.log("Response data:", data);
    }
    catch (err) {
        console.error("Route handler crashed:", err.message);
    }
}
main().catch(console.error);
