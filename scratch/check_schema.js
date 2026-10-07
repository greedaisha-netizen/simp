import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase.js';

async function check() {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers });
    const schema = await res.json();
    console.log("schema response:", schema);
  } catch (e) {
    console.error("Error fetching schema:", e);
  }
}
check();
