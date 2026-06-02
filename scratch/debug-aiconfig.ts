import { getSecret } from "../lib/secrets";
import { getAIConfig } from "../lib/ai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  console.log("process.env.GOOGLE_AI_API_KEY:", process.env.GOOGLE_AI_API_KEY);
  const secret = await getSecret("googleAiApiKey");
  console.log("getSecret('googleAiApiKey'):", secret);
  const config = await getAIConfig();
  console.log("Config loaded:", config);
}

main().catch(console.error);
