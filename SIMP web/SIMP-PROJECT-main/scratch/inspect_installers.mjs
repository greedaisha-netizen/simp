import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../supabase.js";

async function run() {
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/installer?select=*`, { headers });
    const installers = await res.json();
    console.log("INSTALLERS IN DATABASE:");
    console.log(JSON.stringify(installers, null, 2));
  } catch (e) {
    console.error("Error:", e.message);
  }
}

run();
