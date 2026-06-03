import dotenv from "dotenv";

dotenv.config({ path: ".env" });
console.log(".env DATABASE_URL:", process.env.DATABASE_URL);
console.log(".env MYSQL_PUBLIC_URL:", process.env.MYSQL_PUBLIC_URL);

dotenv.config({ path: ".env.local", override: true });
console.log(".env.local DATABASE_URL:", process.env.DATABASE_URL);
console.log(".env.local MYSQL_PUBLIC_URL:", process.env.MYSQL_PUBLIC_URL);
