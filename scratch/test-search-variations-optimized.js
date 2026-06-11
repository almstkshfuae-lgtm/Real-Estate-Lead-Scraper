import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function getArabicVariations(token) {
  if (!token) return [];
  
  // Helper to normalize Alifs to bare Alif (ا)
  const normalizeAlifs = (str) => {
    return str.replace(/[أإآٱ]/g, 'ا');
  };

  // Helper to normalize trailing Ta Marbouta (ة -> ه) and Yaa/Alif Maqsoora (ى -> ي)
  const normalizeEndings = (str) => {
    if (str.length === 0) return str;
    let ended = str;
    if (ended.endsWith('ة')) {
      ended = ended.slice(0, -1) + 'ه';
    } else if (ended.endsWith('ه')) {
      ended = ended.slice(0, -1) + 'ة';
    }
    
    if (ended.endsWith('ى')) {
      ended = ended.slice(0, -1) + 'ي';
    } else if (ended.endsWith('ي')) {
      ended = ended.slice(0, -1) + 'ى';
    }
    return ended;
  };

  const variations = new Set();
  
  // 1. Original
  variations.add(token);
  
  // 2. Normalize Alifs only
  variations.add(normalizeAlifs(token));
  
  // 3. Normalize Endings only
  variations.add(normalizeEndings(token));
  
  // 4. Fully normalized
  variations.add(normalizeEndings(normalizeAlifs(token)));
  
  // 5. Also do variations for the opposite of endings (e.g. if original had ه, variation has ة, etc.)
  // Note: normalizeEndings already toggles between ة<->ه and ى<->ي, so adding it covers both directions.

  // Now, for each variant, handle the "ال" prefix
  const finalVariations = new Set();
  for (const variant of variations) {
    finalVariations.add(variant);
    if (variant.startsWith('ال')) {
      const withoutAl = variant.substring(2);
      if (withoutAl) finalVariations.add(withoutAl);
    } else {
      finalVariations.add('ال' + variant);
    }
  }
  
  return Array.from(finalVariations);
}

async function main() {
  const testTokens = ["أحمد", "مكتبة", "العقارية", "مستشفى"];
  for (const t of testTokens) {
    console.log(`Token: "${t}" -> Variations:`, getArabicVariations(t));
  }
}

main();
