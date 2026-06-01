import { generateGeminiStream } from "../lib/ai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: true });

async function main() {
  console.log("Starting stream test with gemini-2.5-flash...");
  try {
    process.env.GOOGLE_AI_MODEL = "gemini-2.5-flash";
    
    const stream = await generateGeminiStream(
      "You are a helpful assistant.",
      "Hello! Tell me a 1-sentence joke.",
      128
    );
    
    const reader = stream.getReader();
    let done = false;
    let text = "";
    
    while (!done) {
      console.log("Reading...");
      const { value, done: doneReading } = await reader.read();
      console.log("Read resolved:", doneReading, value);
      done = doneReading;
      if (value) {
        text += value;
      }
    }
    
    console.log("\nStream finished successfully!");
    console.log("Full text:", text);
    
    // Wait 1 second before exiting to ensure stdout is flushed
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (err: any) {
    console.error("Stream failed:", err);
  }
}

main().catch(console.error);
