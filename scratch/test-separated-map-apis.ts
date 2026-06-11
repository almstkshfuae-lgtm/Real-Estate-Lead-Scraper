import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Module = require('module');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev-only';

async function main() {
  const prisma = (await import('../lib/prisma')).default;

  // Find a valid user to act as agent
  const user = await prisma.user.findFirst({
    where: { role: 'admin' }
  }) || await prisma.user.findFirst();

  if (!user) {
    console.error("No users found in database to authenticate!");
    return;
  }

  // Generate a valid token
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  console.log("Authenticated as:", user.email, "(Role:", user.role, ")");

  // Intercept next/headers to mock it
  const originalRequire = Module.prototype.require;
  Module.prototype.require = function(request: string) {
    if (request === 'next/headers') {
      return {
        cookies: async () => ({
          get: (name: string) => {
            if (name === 'auth_token') {
              return { value: token };
            }
            return undefined;
          }
        }),
        headers: async () => new Headers({
          'Authorization': `Bearer ${token}`
        })
      };
    }
    return originalRequire.apply(this, arguments);
  };

  // Import route handlers
  const { GET: getLeadsCluster } = await import('../app/api/leads/cluster/route');
  const { GET: getProjectsHeatmap } = await import('../app/api/projects/heatmap/route');

  // Test 1: Fetch leads cluster with filters
  console.log("\n--- [Test 1] Fetching Leads Cluster (All) ---");
  const reqLeadsAll = new NextRequest("http://localhost:3000/api/leads/cluster?limit=5", {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const resLeadsAll = await getLeadsCluster(reqLeadsAll);
  console.log("Leads cluster status:", resLeadsAll.status);
  const leadsAllBody = await resLeadsAll.json();
  console.log("Leads returned:", leadsAllBody.leads?.length);
  if (leadsAllBody.leads && leadsAllBody.leads.length > 0) {
    console.log("First lead example:", {
      id: leadsAllBody.leads[0].id,
      name: leadsAllBody.leads[0].name,
      location: leadsAllBody.leads[0].location,
      lat: leadsAllBody.leads[0].latitude,
      lng: leadsAllBody.leads[0].longitude
    });
  }

  // Test 2: Fetch leads cluster with geofence bounds (e.g. Yas Island area)
  console.log("\n--- [Test 2] Fetching Leads Cluster (Yas Island Geofence) ---");
  // Yas Island coords are approx: lat 24.4672, lng 54.6031
  const reqLeadsGeofence = new NextRequest("http://localhost:3000/api/leads/cluster?north=24.5&south=24.4&east=54.7&west=54.5", {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const resLeadsGeofence = await getLeadsCluster(reqLeadsGeofence);
  const leadsGeofenceBody = await resLeadsGeofence.json();
  console.log("Leads inside Yas geofence:", leadsGeofenceBody.leads?.length);

  // Test 3: Fetch projects heatmap (All)
  console.log("\n--- [Test 3] Fetching Projects Heatmap (All) ---");
  const reqProjectsAll = new NextRequest("http://localhost:3000/api/projects/heatmap", {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const resProjectsAll = await getProjectsHeatmap(reqProjectsAll);
  console.log("Projects status:", resProjectsAll.status);
  const projectsAllBody = await resProjectsAll.json();
  console.log("Projects returned:", projectsAllBody.projects?.length);
  if (projectsAllBody.projects && projectsAllBody.projects.length > 0) {
    console.log("First project example:", {
      id: projectsAllBody.projects[0].id,
      projectName: projectsAllBody.projects[0].projectName,
      location: projectsAllBody.projects[0].location,
      lat: projectsAllBody.projects[0].lat,
      lng: projectsAllBody.projects[0].lng
    });
  }

  // Test 4: Fetch projects heatmap with geofence bounds (Yas Island area)
  console.log("\n--- [Test 4] Fetching Projects Heatmap (Yas Island Geofence) ---");
  const reqProjectsGeofence = new NextRequest("http://localhost:3000/api/projects/heatmap?north=24.5&south=24.4&east=54.7&west=54.5", {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const resProjectsGeofence = await getProjectsHeatmap(reqProjectsGeofence);
  const projectsGeofenceBody = await resProjectsGeofence.json();
  console.log("Projects inside Yas geofence:", projectsGeofenceBody.projects?.length);
  if (projectsGeofenceBody.projects && projectsGeofenceBody.projects.length > 0) {
    console.log("Geofenced project example:", {
      projectName: projectsGeofenceBody.projects[0].projectName,
      location: projectsGeofenceBody.projects[0].location,
      lat: projectsGeofenceBody.projects[0].lat,
      lng: projectsGeofenceBody.projects[0].lng
    });
  }

  await prisma.$disconnect();
}

main().catch(console.error);
