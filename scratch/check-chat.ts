import prisma from '../lib/prisma.ts';

async function main() {
  console.log('Querying ChatMessage table...');
  try {
    const messages = await prisma.chatMessage.findMany({ take: 5 });
    console.log('Chat messages found:', messages);
  } catch (err: any) {
    console.error('Failed to query ChatMessage:', err.message || err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
