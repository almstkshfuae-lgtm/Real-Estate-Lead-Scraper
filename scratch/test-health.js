async function check() {
  const url = 'https://outstanding-rejoicing-development.up.railway.app/health';
  console.log(`Checking ${url}...`);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    console.log(`Status: ${res.status} ${res.statusText}`);
    const body = await res.text();
    console.log(`Body:`, body);
  } catch (err) {
    console.error(`Error checking health:`, err);
  }
}
check();
