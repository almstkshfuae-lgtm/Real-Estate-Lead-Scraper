import { getSecret } from "../lib/secrets";
import { generateGeminiText } from "../lib/ai";

async function main() {
  const secret = await getSecret("googleAiApiKey");
  console.log("Database Key resolved:", secret ? `${secret.substring(0, 5)}... (len: ${secret.length})` : "None");
  try {
    const res = await generateGeminiText("You are a helpful assistant.", "Hello! Are you working?", 256);
    console.log("Success! Response from Gemini:", res);
  } catch (err: any) {
    console.error("Gemini call failed with error:", err.message);
  }
}

main().catch(console.error);
