import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase.js';

async function run() {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Accept-Profile': 'course'
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/section_contents?id=eq.3e09f880-492c-4367-97ca-b0206308fef6`, { headers });
    const contents = await res.json();
    console.log("Full Section Content 3e09f880-492c-4367-97ca-b0206308fef6:");
    console.log(JSON.stringify(contents, null, 2));
  } catch (e) {
    console.error("error fetching:", e);
  }
}

run();
