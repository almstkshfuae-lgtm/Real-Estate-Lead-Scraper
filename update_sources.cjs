const fs = require('fs');
const file = 'c:/projects/Real-Estate-Lead-Scraper/scraper-service/default-sources.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/namePatterns:\s*\[([^\]]+)\]/g, (match, inner) => {
  if (!inner.includes("'h1'")) {
    return `namePatterns: [${inner}, 'h1', 'h2', 'h3', 'div', 'p', 'strong', 'td']`;
  }
  return match;
});

content = content.replace(/companyPatterns:\s*\[([^\]]+)\]/g, (match, inner) => {
  if (!inner.includes("'h1'")) {
    return `companyPatterns: [${inner}, 'h1', 'h2', 'h3', 'div', 'p', 'td']`;
  }
  return match;
});

content = content.replace(/rolePatterns:\s*\[([^\]]+)\]/g, (match, inner) => {
  if (!inner.includes("'h1'")) {
    return `rolePatterns: [${inner}, 'h1', 'h2', 'h3', 'div', 'p', 'td']`;
  }
  return match;
});

fs.writeFileSync(file, content);
console.log('Restored fallback tags to default-sources.js');
