import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function getArabicVariations(token) {
  if (!token) return [];
  const alifs = ['ا', 'أ', 'إ', 'آ', 'ٱ'];
  const yaas = ['ي', 'ى'];
  const taas = ['ة', 'ه'];
  
  let variations = [token];
  
  for (let i = 0; i < token.length; i++) {
    const char = token[i];
    const isLast = i === token.length - 1;
    
    let replacementGroup = [];
    if (alifs.includes(char)) {
      replacementGroup = alifs;
    } else if (isLast && yaas.includes(char)) {
      replacementGroup = yaas;
    } else if (isLast && taas.includes(char)) {
      replacementGroup = taas;
    }
    
    if (replacementGroup.length > 0) {
      const nextVariations = [];
      for (const variant of variations) {
        for (const replacement of replacementGroup) {
          const newVariant = variant.substring(0, i) + replacement + variant.substring(i + 1);
          if (!nextVariations.includes(newVariant)) {
            nextVariations.push(newVariant);
          }
        }
      }
      variations = nextVariations;
    }
    if (variations.length > 32) break;
  }
  
  const finalVariations = [...variations];
  for (const variant of variations) {
    if (variant.startsWith('ال')) {
      const withoutAl = variant.substring(2);
      if (withoutAl && !finalVariations.includes(withoutAl)) {
        finalVariations.push(withoutAl);
      }
    } else {
      const withAl = 'ال' + variant;
      if (!finalVariations.includes(withAl)) {
        finalVariations.push(withAl);
      }
    }
  }
  
  return finalVariations;
}

async function main() {
  try {
    const search = "أحمد العقارية";
    const fields = ["name", "nameAr", "company", "companyAr"];
    const tokens = search.split(/\s+/).filter(Boolean);
    const conditions = [];

    for (const token of tokens) {
      const isArabic = /[\u0600-\u06FF]/.test(token);
      if (isArabic) {
        const variants = getArabicVariations(token);
        console.log(`Token: "${token}", Variants:`, variants);
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

    console.log('Querying database with conditions:', JSON.stringify(conditions, null, 2));
    const leads = await prisma.lead.findMany({
      where: {
        AND: conditions
      },
      take: 5
    });
    console.log('Success! Leads found:', leads.length);
  } catch (error) {
    console.error('Failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
