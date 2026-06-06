import { createToken } from "../lib/auth.js";
import dotenv from "dotenv";

dotenv.config();

async function runClientTest() {
  console.log("Starting SSE Client HTTP test...");

  // 1. Generate JWT
  const adminUser = {
    id: "cmpvk2pax0000429mv9ufyakx",
    email: "admin@brilliance.ae",
    role: "admin"
  };
  const token = await createToken(adminUser);
  console.log("Token:", token);

  const runId = "cmq2pighf0000zsqv59ubcipo";
  const url = `http://127.0.0.1:3009/api/scrape-runs/${runId}/sse`;

  console.log(`Connecting to ${url}...`);

  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  console.log("Status:", res.status);
  console.log("Headers:", Object.fromEntries(res.headers.entries()));

  if (!res.ok) {
    const text = await res.text();
    console.error("Error body:", text);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    console.error("No reader found on res.body");
    return;
  }

  const decoder = new TextDecoder();
  let done = false;

  console.log("\n--- SSE Stream Chunks ---");
  while (!done) {
    const { value, done: isDone } = await reader.read();
    done = isDone;
    if (value) {
      console.log(decoder.decode(value));
    }
  }
  console.log("--- SSE Stream Finished ---");
}

runClientTest().catch(console.error);
