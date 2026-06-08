import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../supabase.js";

async function run() {
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/installer_documents?installer_id=eq.00000000-0000-0000-0000-000000000000`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ resume_status: "approved" })
    });
    console.log("STATUS:", res.status);
    const text = await res.text();
    console.log("RESPONSE:", text);
  } catch (e) {
    console.error("Error:", e.message);
  }
}

run();
