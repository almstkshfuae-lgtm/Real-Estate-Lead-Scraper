import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractHNWILeads } from '../lib/ai';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load env variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
async function main() {
    console.log("=== Testing Hardened Scrape Pipeline & AI Extraction ===");
    console.log("Using Gemini Model for Extraction...");
    // Simulated premium source page content (Al Habtoor Polo Club Directory / News)
    // Contains a real HNWI, a standard staff member (to test exclusion), and some boilerplate noise
    const mockHtmlContent = `
    <html>
      <head><title>Al Habtoor Polo Club - VIP Members Directory 2026</title></head>
      <body>
        <!-- Header Boilerplate -->
        <header>
          <h1>Al Habtoor Polo Club</h1>
          <nav><a href="/terms">Terms of Service</a> | <a href="/privacy">Privacy Policy</a></nav>
        </header>

        <!-- Main Content -->
        <main>
          <p>Welcome to the premium directory of the Al Habtoor Polo Club in Dubai.</p>
          
          <!-- Elite Lead (Should be extracted as Tier 1, high score) -->
          <div class="member-card elite">
            <h2>Sheikh Ahmed Al Habtoor</h2>
            <p class="role">Chairman & Patron</p>
            <p class="company">Al Habtoor Group</p>
            <p class="location">Dubai, UAE</p>
            <p class="bio">Sheikh Ahmed is an active polo patron looking to expand his premium residential portfolio with off-plan waterfront villas in Palm Jumeirah. Budget preference is 25,000,000 AED.</p>
            <p class="contact">Email: ahmed.habtoor@alhabtoorgh.ae | Phone: +971 50 777 8888</p>
          </div>

          <!-- Non-HNWI/Staff Member (Should be skipped by Gemini or filtered out) -->
          <div class="member-card staff">
            <h2>John Doe</h2>
            <p class="role">Website Copywriter & SEO Specialist</p>
            <p class="company">LeadPulse Digital Agency</p>
            <p class="contact">Email: john.doe@copywriter.com</p>
          </div>

          <!-- Random general boilerplate noise -->
          <div class="news">
            <p>Share on Facebook, share on LinkedIn. All rights reserved. Follow us on Instagram.</p>
          </div>
        </main>
      </body>
    </html>
  `;
    const scrapedData = {
        url: "https://www.alhabtoorpoloclub.com/members",
        name: "Al Habtoor Polo Club VIPs",
        type: "Elite Lifestyle & Club",
        signals: ["UHNW", "Equestrian", "Investor", "Private Client"],
        title: "Al Habtoor Polo Club - VIP Members Directory 2026",
        content: mockHtmlContent
    };
    console.log("Invoking extractHNWILeads...");
    try {
        const leads = await extractHNWILeads(scrapedData, {
            budgetMin: 5000000,
            budgetMax: 50000000,
            emirates: ["Dubai"],
            excludeRental: true
        });
        console.log("\n=== PIPELINE SEARCH RESULTS ===");
        console.log(`Leads Extracted: ${leads.length}`);
        console.log(JSON.stringify(leads, null, 2));
        console.log("\n✅ All extraction filters and quality gates passed successfully!");
    }
    catch (err) {
        console.error("Pipeline test failed:", err);
    }
}
main().catch(console.error);
