import { getAIConfig } from "../lib/ai";
import dotenv from "dotenv";
// Load .env.local
dotenv.config({ path: ".env.local" });
async function main() {
    const config = await getAIConfig();
    console.log("Config loaded:", config);
}
main().catch(console.error);
