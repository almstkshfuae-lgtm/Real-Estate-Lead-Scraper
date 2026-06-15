import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function main() {
  const htmlPath = path.resolve(__dirname, '../scratch/gmaps-debug.html');
  if (!fs.existsSync(htmlPath)) {
    console.error(`File does not exist: ${htmlPath}`);
    return;
  }

  const html = fs.readFileSync(htmlPath, 'utf-8');
  
  // Find where <body> starts and ends
  const bodyStart = html.indexOf('<body');
  const bodyEnd = html.indexOf('</body>');
  
  if (bodyStart !== -1 && bodyEnd !== -1) {
    console.log('=== Raw Body HTML (First 5000 chars) ===');
    console.log(html.substring(bodyStart, bodyStart + 5000));
  } else {
    console.log('Could not find <body> tags in HTML.');
    console.log('HTML preview (first 1000 chars):');
    console.log(html.substring(0, 1000));
  }
}

main();
