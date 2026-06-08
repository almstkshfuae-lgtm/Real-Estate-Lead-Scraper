import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const projects = [
  // Original 22 projects
  { projectName: "Fay Valley", location: "Masdar City", developer: "Taraf", startingPrice: 3100000, areaSqft: 2249, handoverDate: "Q2 2030", latitude: 24.4251, longitude: 54.6152 },
  { projectName: "Hudayriyat Golf Estates", location: "Hudayriyat Island", developer: "Modon Properties", startingPrice: 4250000, areaSqft: 2196, handoverDate: "Q3 2030", latitude: 24.4290, longitude: 54.3182 },
  { projectName: "Al Ghadeer", location: "Al Ghadeer", developer: "Aldar Properties", startingPrice: 550000, areaSqft: 410, handoverDate: "Ready", latitude: 24.9122, longitude: 54.9194 },
  { projectName: "Yas Golf Collection", location: "Yas Island", developer: "Aldar Properties", startingPrice: 740000, areaSqft: 452, handoverDate: "Q3 2026", latitude: 24.4845, longitude: 54.5982 },
  { projectName: "Saadiyat Cultural District", location: "Saadiyat Island", developer: "Aldar Properties", startingPrice: 2800000, areaSqft: 810, handoverDate: "Q1 2027", latitude: 24.5450, longitude: 54.4360 },
  { projectName: "Reem Hills", location: "Al Reem Island", developer: "Q Properties", startingPrice: 890000, areaSqft: 485, handoverDate: "Q4 2026", latitude: 24.4932, longitude: 54.4078 },
  { projectName: "Louvre Abu Dhabi Residences", location: "Saadiyat Island", developer: "Aldar Properties", startingPrice: 1300000, areaSqft: 540, handoverDate: "Q2 2027", latitude: 24.5335, longitude: 54.3984 },
  { projectName: "Plaza by Reportage", location: "Masdar City", developer: "Reportage Properties", startingPrice: 620000, areaSqft: 390, handoverDate: "Q3 2027", latitude: 24.4215, longitude: 54.6120 },
  { projectName: "Fahid Beach Residences", location: "Fahid Island", developer: "Aldar Properties", startingPrice: 3500000, areaSqft: 969, handoverDate: "Q2 2029", latitude: 24.5710, longitude: 54.5582 },
  { projectName: "The Arthouse", location: "Saadiyat Island", developer: "Aldar Properties", startingPrice: 3300000, areaSqft: 1023, handoverDate: "Ready", latitude: 24.5422, longitude: 54.4310 },
  { projectName: "Radiant Garden", location: "Al Reem Island", developer: "Radiant Real Estate", startingPrice: 998000, areaSqft: 495, handoverDate: "Under Construction", latitude: 24.4988, longitude: 54.4012 },
  { projectName: "SAAS Heights", location: "Al Reem Island", developer: "SAAS Properties", startingPrice: 2200000, areaSqft: 1009, handoverDate: "Q4 2028", latitude: 24.5015, longitude: 54.4105 },
  { projectName: "Tara Park", location: "Al Reem Island", developer: "Modon Properties", startingPrice: 1640000, areaSqft: 872, handoverDate: "Q4 2029", latitude: 24.4955, longitude: 54.4022 },
  { projectName: "Elie Saab Waterfront", location: "Al Reem Island", developer: "Ohana Development", startingPrice: 1530000, areaSqft: 780, handoverDate: "Q1 2027", latitude: 24.4910, longitude: 54.4095 },
  { projectName: "Nouran Living", location: "Saadiyat Island", developer: "Aldar Properties", startingPrice: 750000, areaSqft: 540, handoverDate: "Q4 2027", latitude: 24.5415, longitude: 54.4342 },
  { projectName: "Stellar by Elie Saab", location: "Yas Island", developer: "Aldar Properties", startingPrice: 2300000, areaSqft: 910, handoverDate: "Q4 2028", latitude: 24.4795, longitude: 54.6015 },
  { projectName: "Sama Yas", location: "Yas Island", developer: "Aldar Properties", startingPrice: 1900000, areaSqft: 850, handoverDate: "Q3 2027", latitude: 24.4820, longitude: 54.6050 },
  { projectName: "Jumeirah Residences", location: "Al Maryah Island", developer: "Aldar Properties", startingPrice: 4700000, areaSqft: 1100, handoverDate: "Q4 2030", latitude: 24.5022, longitude: 54.3894 },
  { projectName: "Gardenia Bay", location: "Yas Island", developer: "Aldar Properties", startingPrice: 830000, areaSqft: 470, handoverDate: "Q2 2027", latitude: 24.4912, longitude: 54.6110 },
  { projectName: "Renad Tower", location: "Al Reem Island", developer: "Tiger Properties", startingPrice: 899000, areaSqft: 520, handoverDate: "Q4 2026", latitude: 24.4948, longitude: 54.4041 },
  { projectName: "Vista 3", location: "Al Reem Island", developer: "Reportage Properties", startingPrice: 915000, areaSqft: 495, handoverDate: "Q4 2027", latitude: 24.4960, longitude: 54.4065 },
  { projectName: "Oasis Residence One", location: "Masdar City", developer: "Reportage Properties", startingPrice: 700000, areaSqft: 388, handoverDate: "Ready", latitude: 24.4230, longitude: 54.6140 },

  // New 10 projects
  { projectName: "Mayan", location: "Yas Island", developer: "Aldar Properties", startingPrice: 1200000, areaSqft: 500, handoverDate: "Ready", latitude: 24.4755, longitude: 54.5910 },
  { projectName: "Water's Edge", location: "Yas Island", developer: "Aldar Properties", startingPrice: 850000, areaSqft: 450, handoverDate: "Ready", latitude: 24.4790, longitude: 54.6185 },
  { projectName: "The Source", location: "Saadiyat Island", developer: "Aldar Properties", startingPrice: 2400000, areaSqft: 820, handoverDate: "Q3 2026", latitude: 24.5440, longitude: 54.4320 },
  { projectName: "Manarat Living", location: "Saadiyat Island", developer: "Aldar Properties", startingPrice: 730000, areaSqft: 412, handoverDate: "Q1 2026", latitude: 24.5395, longitude: 54.4335 },
  { projectName: "Pixel", location: "Al Reem Island", developer: "IMKAN", startingPrice: 950000, areaSqft: 510, handoverDate: "Ready", latitude: 24.5052, longitude: 54.4090 },
  { projectName: "Makers District", location: "Al Reem Island", developer: "IMKAN", startingPrice: 1100000, areaSqft: 545, handoverDate: "Under Construction", latitude: 24.5040, longitude: 54.4110 },
  { projectName: "Leonardo Residences", location: "Masdar City", developer: "Reportage Properties", startingPrice: 680000, areaSqft: 400, handoverDate: "Ready", latitude: 24.4225, longitude: 54.6160 },
  { projectName: "The Gate", location: "Masdar City", developer: "Reportage Properties", startingPrice: 720000, areaSqft: 420, handoverDate: "Q2 2026", latitude: 24.4190, longitude: 54.6095 },
  { projectName: "Al Maryah Vista", location: "Al Maryah Island", developer: "Reportage Properties", startingPrice: 850000, areaSqft: 440, handoverDate: "Ready", latitude: 24.5045, longitude: 54.3875 },
  { projectName: "Reflection", location: "Al Reem Island", developer: "Aldar Properties", startingPrice: 920000, areaSqft: 480, handoverDate: "Ready", latitude: 24.4920, longitude: 54.4010 },
];

async function main() {
  console.log("Seeding ProjectHeatmap...");
  for (const proj of projects) {
    const existing = await prisma.projectHeatmap.findFirst({
      where: { projectName: proj.projectName },
    });
    if (!existing) {
      await prisma.projectHeatmap.create({
        data: {
          ...proj,
          sourceUrl: "",
        },
      });
      console.log(`Created project: ${proj.projectName}`);
    } else {
      console.log(`Project already exists: ${proj.projectName}`);
    }
  }
  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
