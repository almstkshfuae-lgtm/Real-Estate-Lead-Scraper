import { createToken, verifyToken } from "../lib/auth";
async function testJwtRoles() {
    console.log("Testing JWT role-based token creation and verification...\n");
    try {
        const adminUser = {
            id: "test-admin-id",
            email: "admin@brilliance-lead.uk",
            role: "admin",
            name: "Admin User",
        };
        const agentUser = {
            id: "test-agent-id",
            email: "agent@brilliance-lead.uk",
            role: "agent",
            name: "Agent User",
        };
        // 1. Create tokens
        const adminToken = await createToken(adminUser);
        const agentToken = await createToken(agentUser);
        console.log("✅ Successfully created JWT tokens for admin and agent.");
        // 2. Verify admin token
        const decodedAdmin = await verifyToken(adminToken);
        if (decodedAdmin && decodedAdmin.role === "admin" && decodedAdmin.email === adminUser.email) {
            console.log("✅ Successfully verified Admin JWT payload: " + decodedAdmin.role);
        }
        else {
            throw new Error("Failed to verify admin token or role mismatch.");
        }
        // 3. Verify agent token
        const decodedAgent = await verifyToken(agentToken);
        if (decodedAgent && decodedAgent.role === "agent" && decodedAgent.email === agentUser.email) {
            console.log("✅ Successfully verified Agent JWT payload: " + decodedAgent.role);
        }
        else {
            throw new Error("Failed to verify agent token or role mismatch.");
        }
        console.log("\nAll JWT role checks passed successfully!");
        process.exit(0);
    }
    catch (error) {
        console.error("❌ JWT test failed:", error);
        process.exit(1);
    }
}
testJwtRoles();
