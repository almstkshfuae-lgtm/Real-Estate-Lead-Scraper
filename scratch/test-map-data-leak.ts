import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

let JWT_SECRET = process.env.JWT_SECRET || '';
if (!JWT_SECRET || JWT_SECRET.trim() === '') {
  JWT_SECRET = 'dev-secret-key-change-in-production';
}
const PORT = 3001; // Next.js dev server is running on port 3001

async function main() {
  const prisma = (await import('../lib/prisma')).default;

  // Find a valid user to act as agent/admin
  const user = await prisma.user.findFirst({
    where: { role: 'admin' }
  }) || await prisma.user.findFirst();

  if (!user) {
    console.error("No users found in database to authenticate!");
    return;
  }

  // Generate a valid token
  const token = jwt.sign({
    id: user.id,
    email: user.email,
    role: user.role
  }, JWT_SECRET, { expiresIn: '7d' });

  console.log("Authenticated as:", user.email, "(Role:", user.role, ")");

  // Test 1: Fetch leads cluster from local dev server via HTTP
  console.log(`\n--- [Test 1] Fetching Leads Cluster from http://localhost:${PORT}/api/leads/cluster (Checking for leaks) ---`);
  
  const clusterUrl = `http://localhost:${PORT}/api/leads/cluster?limit=5`;
  const clusterRes = await fetch(clusterUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  console.log("Leads cluster HTTP status:", clusterRes.status);
  if (clusterRes.status !== 200) {
    const errorText = await clusterRes.text();
    console.error("❌ FAILED: Cluster API returned error status:", clusterRes.status, errorText);
    process.exit(1);
  }

  const leadsAllBody = await clusterRes.json() as any;
  console.log("Leads returned:", leadsAllBody.leads?.length);
  
  if (leadsAllBody.leads && leadsAllBody.leads.length > 0) {
    const firstLead = leadsAllBody.leads[0];
    console.log("First lead general properties:", {
      id: firstLead.id,
      name: firstLead.name,
      company: firstLead.company,
      location: firstLead.location,
      score: firstLead.score
    });
    
    // Check if sensitive fields leaked
    const leakedFields = ['phone', 'email', 'notes', 'signals'];
    let leaked = false;
    for (const field of leakedFields) {
      if (firstLead[field] !== undefined && firstLead[field] !== null && (Array.isArray(firstLead[field]) ? firstLead[field].length > 0 : true)) {
        console.error(`❌ LEAK DETECTED: field "${field}" was sent in cluster response! Value:`, firstLead[field]);
        leaked = true;
      }
    }
    if (!leaked) {
      console.log("✅ SUCCESS: No sensitive fields leaked in cluster API!");
    } else {
      process.exit(1);
    }
    
    // Test 2: Fetch single lead from local dev server via HTTP
    const leadId = firstLead.id;
    console.log(`\n--- [Test 2] Fetching Single Lead Details for ID ${leadId} ---`);
    const singleUrl = `http://localhost:${PORT}/api/leads/${leadId}`;
    const singleRes = await fetch(singleUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log("Single lead fetch HTTP status:", singleRes.status);
    if (singleRes.status !== 200) {
      const errorText = await singleRes.text();
      console.error("❌ FAILED: Single lead API returned error status:", singleRes.status, errorText);
      process.exit(1);
    }

    const singleLeadBody = await singleRes.json() as any;
    if (singleLeadBody.lead) {
      console.log("Single lead details:", {
        id: singleLeadBody.lead.id,
        name: singleLeadBody.lead.name,
        phone: singleLeadBody.lead.phone,
        email: singleLeadBody.lead.email,
        notes: singleLeadBody.lead.notes,
        signals: singleLeadBody.lead.signals
      });
      // We expect at least one to be returned if populated in database
      const hasSomeDetails = singleLeadBody.lead.phone || singleLeadBody.lead.email || singleLeadBody.lead.notes || (singleLeadBody.lead.signals && singleLeadBody.lead.signals.length > 0);
      if (hasSomeDetails) {
        console.log("✅ SUCCESS: Single lead details retrieved successfully, including sensitive fields.");
      } else {
        console.log("✅ SUCCESS: Endpoint retrieved successfully (sensitive fields were empty in database).");
      }
    } else {
      console.error("❌ FAILED: Single lead body did not contain 'lead' property!", singleLeadBody);
      process.exit(1);
    }
  } else {
    console.warn("⚠️ No leads found in the database. Cannot run test checks fully.");
  }

  await prisma.$disconnect();
}

main().catch(console.error);
