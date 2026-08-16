import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({
  path: "./.env",
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("Supabase URL:", supabaseUrl ? "LOADED" : "MISSING");
console.log(
  "Supabase service key:",
  supabaseServiceRoleKey ? "LOADED" : "MISSING"
);

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is missing from backend/.env");
}

if (!supabaseServiceRoleKey) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is missing from backend/.env"
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseServiceRoleKey
);