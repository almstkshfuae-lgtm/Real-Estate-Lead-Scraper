import { PrismaClient } from '@prisma/client';

const localPrisma = new PrismaClient({
  datasources: {
    db: {
      url: "mysql://root:iWLYuontaDcIoOQvhLyHJFpyFPIuuUuu@zephyr.proxy.rlwy.net:40660/railway?connection_limit=5&socket_timeout=60000"
    }
  }
});

const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: "mysql://root:HtkOvJUqWyKeyjmLRyxvWfuajRdbtDAz@viaduct.proxy.rlwy.net:33196/railway?connection_limit=5&socket_timeout=60000"
    }
  }
});

async function main() {
  console.log('=== Checking Local Admin Preferences ===');
  const localAdmin = await localPrisma.user.findFirst({
    where: { role: 'admin' }
  });
  if (localAdmin) {
    console.log('Local Admin Preferences:', localAdmin.preferences);
  } else {
    console.log('No local admin found.');
  }

  console.log('\n=== Checking Prod Admin Preferences ===');
  const prodAdmin = await prodPrisma.user.findFirst({
    where: { role: 'admin' }
  });
  if (prodAdmin) {
    console.log('Prod Admin Preferences:', prodAdmin.preferences);
  } else {
    console.log('No prod admin found.');
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await localPrisma.$disconnect();
    await prodPrisma.$disconnect();
  });
