import { createToken } from "../lib/auth.js";
import dotenv from "dotenv";

dotenv.config();

async function runFiltersTest() {
  console.log("Starting Leads Query Filters test...");

  // 1. Generate JWT for admin to see all leads
  const adminUser = {
    id: "cmpvk2pax0000429mv9ufyakx",
    email: "admin@brilliance.ae",
    role: "admin"
  };
  const token = await createToken(adminUser);

  const getLeads = async (queryParams: string) => {
    const url = `http://127.0.0.1:3009/api/leads?limit=50&${queryParams}`;
    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  };

  // 2. Test recentlyRelocated filter
  console.log("Testing recentlyRelocated=true...");
  const dataRelocated = await getLeads("recentlyRelocated=true");
  console.log(`Returned ${dataRelocated.leads.length} leads.`);
  const allRelocated = dataRelocated.leads.every((l: any) => l.relocated === true);
  if (allRelocated) {
    console.log("✅ recentlyRelocated filter is working correctly!");
  } else {
    console.error("❌ recentlyRelocated filter FAILED!");
  }

  // 3. Test excludeRental filter
  console.log("Testing excludeRental=true...");
  const dataExcludeRental = await getLeads("excludeRental=true");
  console.log(`Returned ${dataExcludeRental.leads.length} leads.`);
  const allNoRental = dataExcludeRental.leads.every((l: any) => l.rentalFlag === false);
  if (allNoRental) {
    console.log("✅ excludeRental filter is working correctly!");
  } else {
    console.error("❌ excludeRental filter FAILED!");
  }

  // 4. Test tierMin filter
  console.log("Testing tierMin=2...");
  const dataTierMin = await getLeads("tierMin=2");
  console.log(`Returned ${dataTierMin.leads.length} leads.`);
  const allValidTier = dataTierMin.leads.every((l: any) => l.tier <= 2);
  if (allValidTier) {
    console.log("✅ tierMin filter is working correctly!");
  } else {
    console.error("❌ tierMin filter FAILED!");
  }
}

runFiltersTest().catch(console.error);
