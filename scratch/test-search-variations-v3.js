function getArabicVariations(token) {
  if (!token) return [];
  
  const alifTypes = ['ا', 'أ', 'إ', 'آ', 'ٱ'];
  
  const replaceAllAlifs = (str, toChar) => {
    return str.replace(/[اأإآٱ]/g, toChar);
  };

  const toggleEndings = (str) => {
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
  
  // 1. Add original
  variations.add(token);
  
  // 2. Generate Alif replacements (replace all Alifs in the token with each Alif type)
  for (const alif of alifTypes) {
    const replaced = replaceAllAlifs(token, alif);
    variations.add(replaced);
  }

  // 3. For all current variations, generate their ending toggles
  const currentVars = Array.from(variations);
  for (const variant of currentVars) {
    variations.add(toggleEndings(variant));
  }

  // 4. For each variant, handle optional "ال" prefix
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

const testTokens = ["أحمد", "احمد", "مكتبة", "اسامه", "العقارية"];
for (const t of testTokens) {
  const vars = getArabicVariations(t);
  console.log(`Token: "${t}" (${vars.length} variations):`, vars);
}
