function getArabicVariations(token) {
  if (!token) return [];
  
  const alifTypes = ['ا', 'أ', 'إ', 'آ', 'ٱ'];
  const yaas = ['ي', 'ى'];
  const taas = ['ة', 'ه'];

  // Helper to toggle trailing characters (ة <-> ه, ى <-> ي)
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

  // 1. Strip "ال" prefix if present to normalize the base word
  let baseWord = token;
  let hadAl = false;
  if (token.startsWith('ال')) {
    baseWord = token.substring(2);
    hadAl = true;
  }

  const baseVariations = new Set();
  baseVariations.add(baseWord);

  // 2. Generate Alif variations ONLY for the first character if it's an Alif
  if (baseWord.length > 0) {
    const firstChar = baseWord[0];
    if (alifTypes.includes(firstChar)) {
      for (const alif of alifTypes) {
        const variant = alif + baseWord.slice(1);
        baseVariations.add(variant);
      }
    }
  }

  // 3. Generate ending toggles for all base variations
  const currentBaseVars = Array.from(baseVariations);
  for (const variant of currentBaseVars) {
    baseVariations.add(toggleEndings(variant));
  }

  // 4. For each base variation, add both prefix-free and prefixed versions to final set
  const finalVariations = new Set();
  for (const variant of baseVariations) {
    finalVariations.add(variant);
    finalVariations.add('ال' + variant);
  }
  
  return Array.from(finalVariations);
}

const testTokens = ["أحمد", "احمد", "مكتبة", "اسامه", "العقارية"];
for (const t of testTokens) {
  const vars = getArabicVariations(t);
  console.log(`Token: "${t}" (${vars.length} variations):`, vars);
}
