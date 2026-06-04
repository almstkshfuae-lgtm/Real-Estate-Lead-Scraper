import { PrismaClient } from '@prisma/client';
const prodDatabaseUrl = "mysql://root:HtkOvJUqWyKeyjmLRyxvWfuajRdbtDAz@viaduct.proxy.rlwy.net:33196/railway?connection_limit=10&socket_timeout=60000";
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: prodDatabaseUrl
        }
    }
});
// Helper to stringify BigInt values safely
function safeJson(obj) {
    return JSON.stringify(obj, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2);
}
async function main() {
    console.log('=== Inspecting PRODUCTION Database Locks & Processlist ===');
    try {
        // 1. Show active transactions
        console.log('\nChecking active InnoDB transactions...');
        const transactions = await prisma.$queryRaw `
      SELECT trx_id, trx_state, trx_started, trx_requested_lock_id, trx_query 
      FROM information_schema.innodb_trx
    `;
        console.log('Active Transactions:', safeJson(transactions));
        // 2. Show active processes
        console.log('\nChecking active MySQL processes...');
        const processes = await prisma.$queryRaw `
      SHOW PROCESSLIST
    `;
        console.log(`Processes found: ${processes.length}`);
        // Map BigInts for nice output
        const cleanProcesses = processes.map((p) => {
            var _a, _b, _c, _d;
            return ({
                Id: ((_a = p.Id) === null || _a === void 0 ? void 0 : _a.toString()) || ((_b = p.id) === null || _b === void 0 ? void 0 : _b.toString()),
                User: p.User || p.user,
                Host: p.Host || p.host,
                db: p.db,
                Command: p.Command || p.command,
                Time: ((_c = p.Time) === null || _c === void 0 ? void 0 : _c.toString()) || ((_d = p.time) === null || _d === void 0 ? void 0 : _d.toString()),
                State: p.State || p.state,
                Info: p.Info || p.info
            });
        });
        console.log('All Processes:', safeJson(cleanProcesses));
        // 3. Terminate active queries that are blocking
        console.log('\nAnalyzing processes to kill...');
        let killedCount = 0;
        for (const proc of cleanProcesses) {
            const threadId = proc.Id;
            const time = Number(proc.Time);
            const command = proc.Command;
            const info = String(proc.Info || '');
            // Kill any query that has been running/querying for more than 30 seconds
            if (command === 'Query' && time > 30 && info !== 'SHOW PROCESSLIST') {
                console.log(`⚠️ Killing hung query (Thread ID: ${threadId}, Time: ${time}s, Query: "${info}")`);
                await prisma.$executeRawUnsafe(`KILL ${threadId}`);
                killedCount++;
            }
            // Also kill old sleep connections that might be holding locks/connections
            if (command === 'Sleep' && time > 120) {
                console.log(`⚠️ Killing stale sleep connection (Thread ID: ${threadId}, Time: ${time}s)`);
                await prisma.$executeRawUnsafe(`KILL ${threadId}`);
                killedCount++;
            }
        }
        console.log(`\n✅ Finished lock inspection. Stale connections killed: ${killedCount}`);
    }
    catch (err) {
        console.error('Error during lock check:', err.message || err);
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
