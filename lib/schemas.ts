import { z } from "zod";

export const leadUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty").optional(),
  email: z.string().trim().email("Invalid email format").nullable().or(z.literal("")).optional(),
  phone: z.string().trim().nullable().optional(),
  company: z.string().trim().optional(),
  role: z.string().trim().optional(),
  location: z.string().trim().optional(),
  score: z.union([z.number(), z.string()]).nullable().transform((val) => {
    if (val === "" || val === null) return undefined;
    const num = typeof val === "number" ? val : parseInt(String(val).replace(/,/g, "").trim(), 10);
    return isNaN(num) ? 50 : num;
  }).optional(),
  budgetMin: z.union([z.number(), z.string()]).nullable().transform((val) => {
    if (val === "" || val === null) return null;
    const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, "").trim());
    return isNaN(num) ? null : num;
  }).optional(),
  budgetMax: z.union([z.number(), z.string()]).nullable().transform((val) => {
    if (val === "" || val === null) return null;
    const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, "").trim());
    return isNaN(num) ? null : num;
  }).optional(),
  status: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  tier: z.union([z.number(), z.string()]).nullable().transform((val) => {
    if (val === "" || val === null) return undefined;
    const num = typeof val === "number" ? val : parseInt(String(val).replace(/,/g, "").trim(), 10);
    return isNaN(num) ? undefined : num;
  }).optional(),
  source: z.string().trim().optional(),
  signals: z.array(z.string()).optional(),
});
