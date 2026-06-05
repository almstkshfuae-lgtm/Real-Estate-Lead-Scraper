async function main() {
  console.log("Testing Yellow Pages API directly using global fetch...");
  try {
    const url = 'https://api.yellowpages.ae/api/new-search-products?page=0&size=12&keyword=Real%20Estate';
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://www.yellowpages.ae',
        'Referer': 'https://www.yellowpages.ae/'
      }
    });
    
    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Data:", JSON.stringify(data).substring(0, 2000));
  } catch (err) {
    console.error("API Call Failed:", err.message);
  }
}

main();
