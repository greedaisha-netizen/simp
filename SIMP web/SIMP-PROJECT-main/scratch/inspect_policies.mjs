import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../supabase.js";

async function run() {
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  };

  // We can execute SQL via RPC if there's a custom function, but since it's REST API,
  // we can only query pg_policies if there is an API exposure, which there isn't.
  // Instead, let's try to query the REST API on public.installer_documents
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/installer_documents?select=*&limit=1`, { headers });
    const docs = await res.json();
    console.log("INSTALLER DOCUMENTS RAW RECORD:");
    console.log(JSON.stringify(docs, null, 2));
  } catch (e) {
    console.error("Error fetching installer_documents:", e.message);
  }
}

run();
