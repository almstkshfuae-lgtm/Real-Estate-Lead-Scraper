console.log("GOOGLE_AI_API_KEY present:", Boolean(process.env.GOOGLE_AI_API_KEY));
console.log("GOOGLE_AI_API_KEY value length:", process.env.GOOGLE_AI_API_KEY?.length);
console.log("GOOGLE_AI_API_KEY first/last chars:", process.env.GOOGLE_AI_API_KEY ? `${process.env.GOOGLE_AI_API_KEY[0]}...${process.env.GOOGLE_AI_API_KEY.slice(-1)}` : "none");
console.log("GOOGLE_MODEL:", process.env.GOOGLE_MODEL);
console.log("GOOGLE_AI_MODEL:", process.env.GOOGLE_AI_MODEL);
console.log("GOOGLE_API_KEY:", process.env.GOOGLE_API_KEY);
console.log("SCRAPER_SECRET:", process.env.SCRAPER_SECRET);
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("VERCEL_ENV:", process.env.VERCEL_ENV);
