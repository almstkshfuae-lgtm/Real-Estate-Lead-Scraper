import { createToken } from "../lib/auth";
import dotenv from "dotenv";

dotenv.config();

async function runClientTest() {
  console.log("Starting real SSE Client HTTP test against port 3001...");

  // 1. Generate JWT
  const adminUser = {
    id: "cmqd5qepr000d8b0tnsak4rqa", // Real admin user ID or similar from DB
    email: "admin@brilliance-lead.uk",
    role: "admin"
  };
  const token = await createToken(adminUser);
  console.log("Token:", token);

  const runId = "cmqd658e5000ew8w1ouslu9o2";
  const url = `http://localhost:3001/api/scrape-runs/${runId}/sse`;

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
