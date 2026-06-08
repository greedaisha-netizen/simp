import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../supabase.js";

async function run() {
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/admin`, { headers });
    const admins = await res.json();
    console.log("ADMINS IN DATABASE:");
    console.log(JSON.stringify(admins, null, 2));
  } catch (e) {
    console.error("Error:", e.message);
  }
}

run();
