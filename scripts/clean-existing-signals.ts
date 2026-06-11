import prisma from '../lib/prisma';
import { parseSignals, TECHNICAL_SIGNAL_BLACKLIST } from '../lib/signals';

async function main() {
  try {
    console.log('[Cleanup] Starting database signals cleanup...');
    const leads = await prisma.lead.findMany({
      where: {
        deletedAt: null,
      },
    });

    console.log(`[Cleanup] Found ${leads.length} leads in total. Processing...`);

    let checkedCount = 0;
    let cleanedCount = 0;

    for (const lead of leads) {
      checkedCount++;
      
      let rawArray: string[] = [];
      const rawValue = lead.signals;
      
      if (rawValue) {
        if (Array.isArray(rawValue)) {
          rawArray = rawValue.map(s => String(s));
        } else if (typeof rawValue === 'string') {
          const trimmed = rawValue.trim();
          if (trimmed.startsWith('[')) {
            try {
              const parsed = JSON.parse(trimmed);
              if (Array.isArray(parsed)) {
                rawArray = parsed.map(s => String(s));
              } else {
                rawArray = [trimmed];
              }
            } catch {
              rawArray = trimmed.split(',').map(s => s.trim());
            }
          } else {
            rawArray = trimmed.split(',').map(s => s.trim());
          }
        } else if (typeof rawValue === 'object') {
          rawArray = Object.values(rawValue as Record<string, unknown>).map(s => String(s));
        }
      }
      
      const hasTechnical = rawArray.some(sig => 
        TECHNICAL_SIGNAL_BLACKLIST.some(pattern => pattern.test(sig))
      );

      if (hasTechnical) {
        const cleaned = parseSignals(rawValue);
        console.log(`[Cleanup] Lead ID ${lead.id} (${lead.name}): "${rawArray.join(', ')}" -> "${cleaned.join(', ')}"`);
        
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            signals: cleaned
          }
        });
        cleanedCount++;
      }
    }

    console.log(`[Cleanup] Finished. Checked ${checkedCount} leads. Cleaned ${cleanedCount} leads.`);
  } catch (error) {
    console.error('[Cleanup] Error running database cleanup:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
