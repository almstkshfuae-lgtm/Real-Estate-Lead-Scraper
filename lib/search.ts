/**
 * Arabic spelling normalization and variation generator for search queries.
 * Generates common variations of Arabic characters (Alif, Ta Marbouta, Yaa)
 * and optional Alif-Lam (ال) prefix to ensure flexible matching in both directions.
 * Only varies the first Alif of the word to prevent exponential growth and maintain
 * correct spelling of internal letters.
 */
export function getArabicVariations(token: string): string[] {
  if (!token) return [];

  const alifTypes = ['ا', 'أ', 'إ', 'آ', 'ٱ'];

  const toggleEndings = (str: string) => {
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
  if (token.startsWith('ال')) {
    baseWord = token.substring(2);
  }

  const baseVariations = new Set<string>();
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
  const finalVariations = new Set<string>();
  for (const variant of baseVariations) {
    finalVariations.add(variant);
    finalVariations.add('ال' + variant);
  }
  
  return Array.from(finalVariations);
}

/**
 * Builds search conditions array for a list of database fields.
 * Performs tokenized search, generating spelling variants for Arabic tokens.
 * Multi-word searches are ANDed together (all tokens must match at least one field).
 */
export function buildSearchConditions(search: string, fields: string[]): any[] {
  if (!search) return [];

  const tokens = search.split(/\s+/).filter(Boolean);
  const conditions: any[] = [];

  for (const token of tokens) {
    const isArabic = /[\u0600-\u06FF]/.test(token);
    
    if (isArabic) {
      const variants = getArabicVariations(token);
      conditions.push({
        OR: fields.flatMap(field => 
          variants.map(variant => ({
            [field]: { contains: variant }
          }))
        )
      });
    } else {
      conditions.push({
        OR: fields.map(field => ({
          [field]: { contains: token }
        }))
      });
    }
  }

  return conditions;
}
