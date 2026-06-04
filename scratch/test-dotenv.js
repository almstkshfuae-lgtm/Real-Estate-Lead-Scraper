import dotenv from "dotenv";
console.log("Before config, GOOGLE_AI_API_KEY:", process.env.GOOGLE_AI_API_KEY);
dotenv.config({ path: ".env.local", override: true });
console.log("After config, GOOGLE_AI_API_KEY:", process.env.GOOGLE_AI_API_KEY);
import { getAIConfig } from "../lib/ai";
async function main() {
    const config = await getAIConfig();
    console.log("Config loaded:", config);
}
main().catch(console.error);
