// UAE community/area coordinates database
export const UAE_AREAS: Record<string, { lat: number; lng: number; emirate: string }> = {
  "Dubai Marina": { lat: 25.0807, lng: 55.1400, emirate: "Dubai" },
  "Palm Jumeirah": { lat: 25.1124, lng: 55.1390, emirate: "Dubai" },
  "Downtown Dubai": { lat: 25.1972, lng: 55.2744, emirate: "Dubai" },
  "Business Bay": { lat: 25.1860, lng: 55.2650, emirate: "Dubai" },
  "Jumeirah": { lat: 25.2048, lng: 55.2455, emirate: "Dubai" },
  "DIFC": { lat: 25.2108, lng: 55.2820, emirate: "Dubai" },
  "JBR": { lat: 25.0786, lng: 55.1341, emirate: "Dubai" },
  "Arabian Ranches": { lat: 25.0536, lng: 55.2710, emirate: "Dubai" },
  "Al Barsha": { lat: 25.1127, lng: 55.1992, emirate: "Dubai" },
  "Mirdif": { lat: 25.2218, lng: 55.4224, emirate: "Dubai" },
  "Deira": { lat: 25.2697, lng: 55.3095, emirate: "Dubai" },
  "Bur Dubai": { lat: 25.2532, lng: 55.2956, emirate: "Dubai" },
  "JVC": { lat: 25.0657, lng: 55.2105, emirate: "Dubai" },
  "Yas Island": { lat: 24.4672, lng: 54.6031, emirate: "Abu Dhabi" },
  "Al Reem Island": { lat: 24.4975, lng: 54.4186, emirate: "Abu Dhabi" },
  "Saadiyat Island": { lat: 24.5404, lng: 54.4416, emirate: "Abu Dhabi" },
  "Khalidiyah": { lat: 24.4755, lng: 54.3557, emirate: "Abu Dhabi" },
  "Al Raha Beach": { lat: 24.4293, lng: 54.5697, emirate: "Abu Dhabi" },
  "Corniche": { lat: 24.4638, lng: 54.3444, emirate: "Abu Dhabi" },
  "Sharjah City": { lat: 25.3463, lng: 55.4209, emirate: "Sharjah" },
  "Al Nahda": { lat: 25.3007, lng: 55.4177, emirate: "Sharjah" },
  "Al Khan": { lat: 25.3531, lng: 55.3795, emirate: "Sharjah" },
  "Ajman": { lat: 25.4052, lng: 55.5136, emirate: "Ajman" },
  "Ras Al Khaimah": { lat: 25.7953, lng: 55.9788, emirate: "RAK" },
  "Fujairah": { lat: 25.1288, lng: 56.3265, emirate: "Fujairah" },
  "Dubai": { lat: 25.2048, lng: 55.2708, emirate: "Dubai" },
  "Abu Dhabi": { lat: 24.4539, lng: 54.3773, emirate: "Abu Dhabi" },
  "Umm Al Quwain": { lat: 25.5647, lng: 55.5534, emirate: "Umm Al Quwain" },
};

export const GLOBAL_AREAS: Record<string, { lat: number; lng: number; emirate: string }> = {
  // Saudi Arabia
  "Riyadh": { lat: 24.7136, lng: 46.6753, emirate: "Saudi Arabia" },
  "الرياض": { lat: 24.7136, lng: 46.6753, emirate: "Saudi Arabia" },
  "Jeddah": { lat: 21.5433, lng: 39.1728, emirate: "Saudi Arabia" },
  "جدة": { lat: 21.5433, lng: 39.1728, emirate: "Saudi Arabia" },
  "Saudi Arabia": { lat: 23.8859, lng: 45.0792, emirate: "Saudi Arabia" },
  "المملكة العربية السعودية": { lat: 23.8859, lng: 45.0792, emirate: "Saudi Arabia" },
  "السعودية": { lat: 23.8859, lng: 45.0792, emirate: "Saudi Arabia" },

  // UK & Europe
  "London": { lat: 51.5074, lng: -0.1278, emirate: "UK" },
  "لندن": { lat: 51.5074, lng: -0.1278, emirate: "UK" },
  "United Kingdom": { lat: 55.3781, lng: -3.4360, emirate: "UK" },
  "المملكة المتحدة": { lat: 55.3781, lng: -3.4360, emirate: "UK" },
  "بريطانيا": { lat: 55.3781, lng: -3.4360, emirate: "UK" },
  "Paris": { lat: 48.8566, lng: 2.3522, emirate: "France" },
  "باريس": { lat: 48.8566, lng: 2.3522, emirate: "France" },
  "France": { lat: 46.2276, lng: 2.2137, emirate: "France" },
  "فرنسا": { lat: 46.2276, lng: 2.2137, emirate: "France" },
  "Berlin": { lat: 52.5200, lng: 13.4050, emirate: "Germany" },
  "برلين": { lat: 52.5200, lng: 13.4050, emirate: "Germany" },
  "Germany": { lat: 51.1657, lng: 10.4515, emirate: "Germany" },
  "ألمانيا": { lat: 51.1657, lng: 10.4515, emirate: "Germany" },
  "Geneva": { lat: 46.2044, lng: 6.1432, emirate: "Switzerland" },
  "جنيف": { lat: 46.2044, lng: 6.1432, emirate: "Switzerland" },
  "Zurich": { lat: 47.3769, lng: 8.5417, emirate: "Switzerland" },
  "زوريخ": { lat: 47.3769, lng: 8.5417, emirate: "Switzerland" },
  "Munich": { lat: 48.1351, lng: 11.5820, emirate: "Germany" },
  "ميونخ": { lat: 48.1351, lng: 11.5820, emirate: "Germany" },
  "Switzerland": { lat: 46.8182, lng: 8.2275, emirate: "Switzerland" },
  "سويسرا": { lat: 46.8182, lng: 8.2275, emirate: "Switzerland" },

  // North America
  "New York": { lat: 40.7128, lng: -74.0060, emirate: "USA" },
  "نيويورك": { lat: 40.7128, lng: -74.0060, emirate: "USA" },
  "California": { lat: 36.7783, lng: -119.4179, emirate: "USA" },
  "كاليفورنيا": { lat: 36.7783, lng: -119.4179, emirate: "USA" },
  "United States": { lat: 37.0902, lng: -95.7129, emirate: "USA" },
  "الولايات المتحدة": { lat: 37.0902, lng: -95.7129, emirate: "USA" },
  "USA": { lat: 37.0902, lng: -95.7129, emirate: "USA" },
  "Canada": { lat: 56.1304, lng: -106.3468, emirate: "Canada" },
  "كندا": { lat: 56.1304, lng: -106.3468, emirate: "Canada" },
  "Toronto": { lat: 43.6532, lng: -79.3832, emirate: "Canada" },
  "تورونتو": { lat: 43.6532, lng: -79.3832, emirate: "Canada" },
  "Montreal": { lat: 45.5017, lng: -73.5673, emirate: "Canada" },
  "مونتريال": { lat: 45.5017, lng: -73.5673, emirate: "Canada" },
  "Vancouver": { lat: 49.2827, lng: -123.1207, emirate: "Canada" },
  "فانكوفر": { lat: 49.2827, lng: -123.1207, emirate: "Canada" },
  "Ottawa": { lat: 45.4215, lng: -75.6972, emirate: "Canada" },
  "أوتاوا": { lat: 45.4215, lng: -75.6972, emirate: "Canada" },
  "Edmonton": { lat: 53.5461, lng: -113.4938, emirate: "Canada" },
  "إدمونتون": { lat: 53.5461, lng: -113.4938, emirate: "Canada" },
  "Quebec": { lat: 46.8139, lng: -71.2082, emirate: "Canada" },
  "كيبك": { lat: 46.8139, lng: -71.2082, emirate: "Canada" },
  "Québec": { lat: 46.8139, lng: -71.2082, emirate: "Canada" },

  // Gulf / Middle East
  "Kuwait": { lat: 29.3759, lng: 47.9774, emirate: "Kuwait" },
  "الكويت": { lat: 29.3759, lng: 47.9774, emirate: "Kuwait" },
  "Qatar": { lat: 25.3548, lng: 51.1849, emirate: "Qatar" },
  "قطر": { lat: 25.3548, lng: 51.1849, emirate: "Qatar" },
  "Doha": { lat: 25.2854, lng: 51.5310, emirate: "Qatar" },
  "الدوحة": { lat: 25.2854, lng: 51.5310, emirate: "Qatar" },
  "Bahrain": { lat: 26.0667, lng: 50.5577, emirate: "Bahrain" },
  "البحرين": { lat: 26.0667, lng: 50.5577, emirate: "Bahrain" },
  "Manama": { lat: 26.2285, lng: 50.5860, emirate: "Bahrain" },
  "المنامة": { lat: 26.2285, lng: 50.5860, emirate: "Bahrain" },
  "Oman": { lat: 21.5126, lng: 55.9233, emirate: "Oman" },
  "عمان": { lat: 21.5126, lng: 55.9233, emirate: "Oman" },
  "Muscat": { lat: 23.5859, lng: 58.4059, emirate: "Oman" },
  "مسقط": { lat: 23.5859, lng: 58.4059, emirate: "Oman" },
  "Egypt": { lat: 26.8206, lng: 30.8025, emirate: "Egypt" },
  "مصر": { lat: 26.8206, lng: 30.8025, emirate: "Egypt" },
  "Cairo": { lat: 30.0444, lng: 31.2357, emirate: "Egypt" },
  "القاهرة": { lat: 30.0444, lng: 31.2357, emirate: "Egypt" },
  "Lebanon": { lat: 33.8547, lng: 35.8623, emirate: "Lebanon" },
  "لبنان": { lat: 33.8547, lng: 35.8623, emirate: "Lebanon" },
  "Beirut": { lat: 33.8938, lng: 35.5018, emirate: "Lebanon" },
  "بيروت": { lat: 33.8938, lng: 35.5018, emirate: "Lebanon" },
  "Jordan": { lat: 30.5852, lng: 36.2384, emirate: "Jordan" },
  "الأردن": { lat: 30.5852, lng: 36.2384, emirate: "Jordan" },
  "Amman": { lat: 31.9539, lng: 35.9106, emirate: "Jordan" },
  "عمان (الأردن)": { lat: 31.9539, lng: 35.9106, emirate: "Jordan" },

  // Asia & Russia
  "India": { lat: 20.5937, lng: 78.9629, emirate: "India" },
  "الهند": { lat: 20.5937, lng: 78.9629, emirate: "India" },
  "Mumbai": { lat: 19.0760, lng: 72.8777, emirate: "India" },
  "بومباي": { lat: 19.0760, lng: 72.8777, emirate: "India" },
  "Russia": { lat: 61.5240, lng: 105.3188, emirate: "Russia" },
  "روسيا": { lat: 61.5240, lng: 105.3188, emirate: "Russia" },
  "Moscow": { lat: 55.7558, lng: 37.6173, emirate: "Russia" },
  "موسكو": { lat: 55.7558, lng: 37.6173, emirate: "Russia" },
  "China": { lat: 35.8617, lng: 104.1954, emirate: "China" },
  "الصين": { lat: 35.8617, lng: 104.1954, emirate: "China" },
  "Turkey": { lat: 38.9637, lng: 35.2433, emirate: "Turkey" },
  "تركيا": { lat: 38.9637, lng: 35.2433, emirate: "Turkey" },
  "Istanbul": { lat: 41.0082, lng: 28.9784, emirate: "Turkey" },
  "إسطنبول": { lat: 41.0082, lng: 28.9784, emirate: "Turkey" },
  "Pakistan": { lat: 30.3753, lng: 69.3451, emirate: "Pakistan" },
  "باكستان": { lat: 30.3753, lng: 69.3451, emirate: "Pakistan" }
};

export function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getCoords(location: string, seed: string = ""): { lat: number; lng: number } | null {
  const normalized = location?.trim() || "";

  // 1. Try UAE Areas first
  for (const [key, val] of Object.entries(UAE_AREAS)) {
    if (normalized.toLowerCase().includes(key.toLowerCase())) {
      const hash = stableHash(normalized + seed);
      const offsetLat = ((hash % 1000) / 1000 - 0.5) * 0.02;
      const offsetLng = (((hash >> 10) % 1000) / 1000 - 0.5) * 0.02;
      return { lat: val.lat + offsetLat, lng: val.lng + offsetLng };
    }
  }

  // 2. Try Global Areas next
  for (const [key, val] of Object.entries(GLOBAL_AREAS)) {
    if (normalized.toLowerCase().includes(key.toLowerCase())) {
      const hash = stableHash(normalized + seed);
      const offsetLat = ((hash % 1000) / 1000 - 0.5) * 0.02;
      const offsetLng = (((hash >> 10) % 1000) / 1000 - 0.5) * 0.02;
      return { lat: val.lat + offsetLat, lng: val.lng + offsetLng };
    }
  }

  // 3. Unknown location — return fallback central UAE coordinate
  const hash = stableHash(normalized + seed + "fallback");
  const offsetLat = ((hash % 1000) / 1000 - 0.5) * 0.15;
  const offsetLng = (((hash >> 10) % 1000) / 1000 - 0.5) * 0.25;
  return { lat: 24.8 + offsetLat, lng: 55.0 + offsetLng };
}

/**
 * Retrieves the names of all areas whose coordinates fall within the specified bounding box.
 */
export function getAreasInBounds(
  north: number,
  south: number,
  east: number,
  west: number
): string[] {
  const matchedAreas: string[] = [];

  const checkBounds = (lat: number, lng: number) => {
    const inLat = lat >= south && lat <= north;
    let inLng = false;
    if (west <= east) {
      inLng = lng >= west && lng <= east;
    } else {
      inLng = lng >= west || lng <= east;
    }
    return inLat && inLng;
  };

  for (const [name, coords] of Object.entries(UAE_AREAS)) {
    if (checkBounds(coords.lat, coords.lng)) {
      matchedAreas.push(name);
    }
  }

  for (const [name, coords] of Object.entries(GLOBAL_AREAS)) {
    if (checkBounds(coords.lat, coords.lng)) {
      matchedAreas.push(name);
    }
  }

  return matchedAreas;
}

export const AREA_TRANSLATIONS: Record<string, string> = {
  "Dubai Marina": "دبي مارينا",
  "Palm Jumeirah": "نخلة جميرا",
  "Downtown Dubai": "وسط مدينة دبي",
  "Business Bay": "خليج الأعمال",
  "Jumeirah": "جميرا",
  "DIFC": "مركز دبي المالي العالمي",
  "JBR": "جي بي آر",
  "Arabian Ranches": "المرابع العربية",
  "Al Barsha": "البرشاء",
  "Mirdif": "مردف",
  "Deira": "ديرة",
  "Bur Dubai": "بر دبي",
  "JVC": "قرية جميرا الدائرية",
  "Yas Island": "جزيرة ياس",
  "Al Reem Island": "جزيرة الريم",
  "Saadiyat Island": "جزيرة السعديات",
  "Khalidiyah": "الخالدية",
  "Al Raha Beach": "شاطئ الراحة",
  "Corniche": "الكورنيش",
  "Sharjah City": "مدينة الشارقة",
  "Al Nahda": "النهدة",
  "Al Khan": "الخان",
  "Ajman": "عجمان",
  "Ras Al Khaimah": "رأس الخيمة",
  "Fujairah": "الفجيرة",
  "Dubai": "دبي",
  "Abu Dhabi": "أبوظبي",
  "Umm Al Quwain": "أم القيوين",
  "Saudi Arabia": "المملكة العربية السعودية",
  "Riyadh": "الرياض",
  "Jeddah": "جدة",
  "UK": "المملكة المتحدة",
  "London": "لندن",
  "France": "فرنسا",
  "Paris": "باريس",
  "Germany": "ألمانيا",
  "Berlin": "برلين",
  "Munich": "ميونخ",
  "Switzerland": "سويسرا",
  "Geneva": "جنيف",
  "Zurich": "زوريخ",
  "USA": "الولايات المتحدة الأمريكية",
  "New York": "نيويورك",
  "California": "كاليفورنيا",
  "Canada": "كندا",
  "Toronto": "تورونتو",
  "Montreal": "مونتريال",
  "Vancouver": "فانكوفر",
  "Ottawa": "أوتاوا",
  "Edmonton": "إدمونتون",
  "Quebec": "كيبك",
  "Kuwait": "الكويت",
  "Qatar": "قطر",
  "Doha": "الدوحة",
  "Bahrain": "البحرين",
  "Manama": "المنامة",
  "Oman": "عمان",
  "Muscat": "مسقط",
  "Egypt": "مصر",
  "Cairo": "القاهرة",
  "Lebanon": "لبنان",
  "Beirut": "بيروت",
  "Jordan": "الأردن",
  "Amman": "عمان",
  "India": "الهند",
  "Mumbai": "بومباي",
  "Russia": "روسيا",
  "Moscow": "موسكو",
  "China": "الصين",
  "Turkey": "تركيا",
  "Istanbul": "إسطنبول",
  "Pakistan": "باكستان"
};

