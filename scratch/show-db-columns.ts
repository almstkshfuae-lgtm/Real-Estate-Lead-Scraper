import { PrismaClient } from "@prisma/client";

async function showColumns(url: string, name: string) {
  console.log(`\n=== Columns in ${name} ===`);
  const prisma = new PrismaClient({
    datasources: { db: { url } }
  });
  try {
    const columns: any = await prisma.$queryRawUnsafe(
      "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM information_schema.columns WHERE table_name = 'Lead'"
    );
    console.log(columns.map((c: any) => `${c.COLUMN_NAME} (${c.DATA_TYPE}) ${c.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`));
  } catch (err: any) {
    console.error(`Failed to show columns for ${name}:`, err.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const zephyr = "mysql://root:iWLYuontaDcIoOQvhLyHJFpyFPIuuUuu@zephyr.proxy.rlwy.net:40660/railway";
  const viaduct = "mysql://root:HtkOvJUqWyKeyjmLRyxvWfuajRdbtDAz@viaduct.proxy.rlwy.net:33196/railway";
  
  await showColumns(zephyr, "Zephyr");
  await showColumns(viaduct, "Viaduct");
}

main().catch(console.error);
