import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const projects = [
  // Original projects
  { projectName: "Fay Valley", location: "مدينة مصدر", developer: "Taraf", startingPrice: 3100000, areaSqft: 2249, handoverDate: "الربع الثاني 2030", latitude: 24.4251, longitude: 54.6152 },
  { projectName: "Hudayriyat Golf Estates", location: "جزيرة الحديريات", developer: "Modon Properties", startingPrice: 4250000, areaSqft: 2196, handoverDate: "الربع الثالث 2030", latitude: 24.4290, longitude: 54.3182 },
  { projectName: "Al Ghadeer", location: "الغدير", developer: "Aldar Properties", startingPrice: 550000, areaSqft: 410, handoverDate: "جاهز / قيد التسليم", latitude: 24.9122, longitude: 54.9194 },
  { projectName: "Yas Golf Collection", location: "جزيرة ياس", developer: "Aldar Properties", startingPrice: 740000, areaSqft: 452, handoverDate: "الربع الثالث 2026", latitude: 24.4845, longitude: 54.5982 },
  { projectName: "Saadiyat Cultural District", location: "جزيرة السعديات", developer: "Aldar Properties", startingPrice: 2800000, areaSqft: 810, handoverDate: "الربع الأول 2027", latitude: 24.5450, longitude: 54.4360 },
  { projectName: "Reem Hills", location: "جزيرة الريم", developer: "Q Properties", startingPrice: 890000, areaSqft: 485, handoverDate: "الربع الرابع 2026", latitude: 24.4932, longitude: 54.4078 },
  { projectName: "Louvre Abu Dhabi Residences", location: "جزيرة السعديات", developer: "Aldar Properties", startingPrice: 1300000, areaSqft: 540, handoverDate: "الربع الثاني 2027", latitude: 24.5335, longitude: 54.3984 },
  { projectName: "Plaza by Reportage", location: "مدينة مصدر", developer: "Reportage Properties", startingPrice: 620000, areaSqft: 390, handoverDate: "الربع الثالث 2027", latitude: 24.4215, longitude: 54.6120 },
  { projectName: "Fahid Beach Residences", location: "جزيرة فاهد", developer: "Aldar Properties", startingPrice: 3500000, areaSqft: 969, handoverDate: "الربع الثاني 2029", latitude: 24.5710, longitude: 54.5582 },
  { projectName: "The Arthouse", location: "جزيرة السعديات", developer: "Aldar Properties", startingPrice: 3300000, areaSqft: 1023, handoverDate: "جاهز / قيد التسليم", latitude: 24.5422, longitude: 54.4310 },
  { projectName: "Radiant Garden", location: "جزيرة الريم", developer: "Radiant Real Estate", startingPrice: 998000, areaSqft: 495, handoverDate: "قيد الإنشاء", latitude: 24.4988, longitude: 54.4012 },
  { projectName: "SAAS Heights", location: "جزيرة الريم", developer: "SAAS Properties", startingPrice: 2200000, areaSqft: 1009, handoverDate: "الربع الرابع 2028", latitude: 24.5015, longitude: 54.4105 },
  { projectName: "Tara Park", location: "جزيرة الريم", developer: "Modon Properties", startingPrice: 1640000, areaSqft: 872, handoverDate: "الربع الرابع 2029", latitude: 24.4955, longitude: 54.4022 },
  { projectName: "Elie Saab Waterfront", location: "جزيرة الريم", developer: "Ohana Development", startingPrice: 1530000, areaSqft: 780, handoverDate: "الربع الأول 2027", latitude: 24.4910, longitude: 54.4095 },
  { projectName: "Nouran Living", location: "جزيرة السعديات", developer: "Aldar Properties", startingPrice: 750000, areaSqft: 540, handoverDate: "الربع الرابع 2027", latitude: 24.5415, longitude: 54.4342 },
  { projectName: "Stellar by Elie Saab", location: "جزيرة ياس", developer: "Aldar Properties", startingPrice: 2300000, areaSqft: 910, handoverDate: "الربع الرابع 2028", latitude: 24.4795, longitude: 54.6015 },
  { projectName: "Sama Yas", location: "جزيرة ياس", developer: "Aldar Properties", startingPrice: 1900000, areaSqft: 850, handoverDate: "الربع الثالث 2027", latitude: 24.4820, longitude: 54.6050 },
  { projectName: "Jumeirah Residences", location: "جزيرة المارية", developer: "Aldar Properties", startingPrice: 4700000, areaSqft: 1100, handoverDate: "الربع الرابع 2030", latitude: 24.5022, longitude: 54.3894 },
  { projectName: "Gardenia Bay", location: "جزيرة ياس", developer: "Aldar Properties", startingPrice: 830000, areaSqft: 470, handoverDate: "الربع الثاني 2027", latitude: 24.4912, longitude: 54.6110 },
  { projectName: "Renad Tower", location: "جزيرة الريم", developer: "Tiger Properties", startingPrice: 899000, areaSqft: 520, handoverDate: "الربع الرابع 2026", latitude: 24.4948, longitude: 54.4041 },
  { projectName: "Vista 3", location: "جزيرة الريم", developer: "Reportage Properties", startingPrice: 915000, areaSqft: 495, handoverDate: "الربع الرابع 2027", latitude: 24.4960, longitude: 54.4065 },
  { projectName: "Oasis Residence One", location: "مدينة مصدر", developer: "Reportage Properties", startingPrice: 700000, areaSqft: 388, handoverDate: "جاهز / قيد التسليم", latitude: 24.4230, longitude: 54.6140 },

  // New projects
  { projectName: "Mayan", location: "جزيرة ياس", developer: "Aldar Properties", startingPrice: 1200000, areaSqft: 500, handoverDate: "جاهز / قيد التسليم", latitude: 24.4755, longitude: 54.5910 },
  { projectName: "Water's Edge", location: "جزيرة ياس", developer: "Aldar Properties", startingPrice: 850000, areaSqft: 450, handoverDate: "جاهز / قيد التسليم", latitude: 24.4790, longitude: 54.6185 },
  { projectName: "The Source", location: "جزيرة السعديات", developer: "Aldar Properties", startingPrice: 2400000, areaSqft: 820, handoverDate: "الربع الثالث 2026", latitude: 24.5440, longitude: 54.4320 },
  { projectName: "Manarat Living", location: "جزيرة السعديات", developer: "Aldar Properties", startingPrice: 730000, areaSqft: 412, handoverDate: "الربع الأول 2026", latitude: 24.5395, longitude: 54.4335 },
  { projectName: "Pixel", location: "جزيرة الريم", developer: "IMKAN", startingPrice: 950000, areaSqft: 510, handoverDate: "جاهز / قيد التسليم", latitude: 24.5052, longitude: 54.4090 },
  { projectName: "Makers District", location: "جزيرة الريم", developer: "IMKAN", startingPrice: 1100000, areaSqft: 545, handoverDate: "قيد الإنشاء", latitude: 24.5040, longitude: 54.4110 },
  { projectName: "Leonardo Residences", location: "مدينة مصدر", developer: "Reportage Properties", startingPrice: 680000, areaSqft: 400, handoverDate: "جاهز / قيد التسليم", latitude: 24.4225, longitude: 54.6160 },
  { projectName: "The Gate", location: "مدينة مصدر", developer: "Reportage Properties", startingPrice: 720000, areaSqft: 420, handoverDate: "الربع الثاني 2026", latitude: 24.4190, longitude: 54.6095 },
  { projectName: "Al Maryah Vista", location: "جزيرة المارية", developer: "Reportage Properties", startingPrice: 850000, areaSqft: 440, handoverDate: "جاهز / قيد التسليم", latitude: 24.5045, longitude: 54.3875 },
  { projectName: "Reflection", location: "جزيرة الريم", developer: "Aldar Properties", startingPrice: 920000, areaSqft: 480, handoverDate: "جاهز / قيد التسليم", latitude: 24.4920, longitude: 54.4010 },
  { projectName: "Mamsha Gardens", location: "جزيرة السعديات", developer: "Aldar Properties", startingPrice: 3300000, areaSqft: 1066, handoverDate: "الربع الثاني 2028", latitude: 24.5380, longitude: 54.4020 },
  { projectName: "The Source Terraces", location: "جزيرة السعديات", developer: "Aldar Properties", startingPrice: 3000000, areaSqft: null, handoverDate: "الربع الثالث 2027", latitude: 24.5445, longitude: 54.4315 },
  { projectName: "A1LA Residence", location: "جزيرة الريم", developer: "Object 1", startingPrice: 2800000, areaSqft: 850, handoverDate: "الربع الرابع 2028", latitude: 24.4990, longitude: 54.4085 },
  { projectName: "Reportage Tower", location: "جزيرة المارية", developer: "Reportage Properties", startingPrice: 1700000, areaSqft: 750, handoverDate: "الربع الرابع 2028", latitude: 24.5020, longitude: 54.3890 },
  { projectName: "Marlin 2", location: "جزيرة الريم", developer: "Reportage Properties", startingPrice: 1300000, areaSqft: 680, handoverDate: "الربع الرابع 2028", latitude: 24.4975, longitude: 54.4045 },
  { projectName: "Joud Residence", location: "جزيرة الريم", developer: "ONE Development", startingPrice: 1500000, areaSqft: 854, handoverDate: "قيد الإنشاء", latitude: 24.4965, longitude: 54.4090 },
  { projectName: "One Residence", location: "جزيرة الريم", developer: "One Development", startingPrice: 1650000, areaSqft: 915, handoverDate: "قيد الإنشاء", latitude: 24.4950, longitude: 54.4070 },
  { projectName: "Radiant Bridges", location: "جزيرة الريم", developer: "Radiant Real Estate", startingPrice: 750000, areaSqft: 500, handoverDate: "الربع الأول 2029", latitude: 24.4915, longitude: 54.4035 },
  { projectName: "Novayas", location: "جزيرة ياس", developer: "Aldar Properties", startingPrice: 1250000, areaSqft: 550, handoverDate: "الربع الثاني 2029", latitude: 24.4810, longitude: 54.6140 },
  { projectName: "Reportage Brabus", location: "منطقة شاطئ الراحة", developer: "Reportage Properties", startingPrice: 2500000, areaSqft: 1157, handoverDate: "الربع الثاني 2029", latitude: 24.4420, longitude: 54.5760 },
  { projectName: "Reeman Residence 01", location: "الشامخة", developer: "Aldar Properties", startingPrice: 650000, areaSqft: 412, handoverDate: "الربع الأول 2027", latitude: 24.4110, longitude: 54.7150 },
  { projectName: "River Cove Residences", location: "الباهية (مدينة صبحة)", developer: "Sobha Realty", startingPrice: 1350000, areaSqft: 566, handoverDate: "الربع الرابع 2029", latitude: 24.5290, longitude: 54.6710 },
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
      await prisma.projectHeatmap.update({
        where: { id: existing.id },
        data: {
          location: proj.location,
          developer: proj.developer,
          handoverDate: proj.handoverDate,
        },
      });
      console.log(`Updated project to Arabic text: ${proj.projectName}`);
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
