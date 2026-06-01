async function test() {
  const apiKey = 'AIzaSyDjM21BSd35IdMtlrAwl3JEXuRrX93OLko';
  
  // 1. Try to list available models
  console.log('Fetching available models from Google AI API...');
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    console.log(`List models status: ${res.status}`);
    const data = await res.json();
    if (data.models) {
      console.log('Available models:');
      data.models.forEach((m: any) => console.log(`- ${m.name}`));
    } else {
      console.log('Error listing models:', data);
    }
  } catch (err: any) {
    console.error('List models failed:', err.message);
  }

  // 2. Try to generate text using gemini-1.5-flash on v1beta
  console.log('\nTesting generateContent on v1beta with gemini-1.5-flash...');
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Hello, what is your name?' }] }]
      })
    });
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log('Response:', JSON.stringify(data).substring(0, 300));
  } catch (err: any) {
    console.error('Generate content failed:', err.message);
  }
}

test().catch(console.error);
