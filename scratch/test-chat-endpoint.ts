import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

async function main() {
  const baseUrl = "http://localhost:3001";
  
  // 1. Login
  console.log("Logging in...");
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@brilliance-lead.uk", password: "almstkshf@2030" })
  });
  
  const loginData = await loginRes.json();
  const token = loginData.token;
  const cookieHeader = token ? `auth_token=${token}` : "";
  console.log("Logged in. Cookie:", cookieHeader ? cookieHeader.substring(0, 30) + "..." : "NONE");
  
  // 2. Chat
  console.log("Hitting chat endpoint...");
  const chatRes = await fetch(`${baseUrl}/api/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: "What are the best Italian restaurants near Downtown Dubai?" }],
      lang: "en"
    })
  });
  
  console.log("Status:", chatRes.status);
  console.log("Headers Content-Type:", chatRes.headers.get("content-type"));
  
  const reader = chatRes.body?.getReader();
  const decoder = new TextDecoder();
  
  if (reader) {
    let done = false;
    while (!done) {
      console.log("Waiting for chunk...");
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      console.log("Chunk received:", doneReading, value ? decoder.decode(value) : "null");
    }
  } else {
    console.log("No body reader!");
  }
}

main().catch(console.error);
