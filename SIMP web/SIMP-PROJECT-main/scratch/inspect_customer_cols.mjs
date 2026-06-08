const SUPABASE_URL = "https://gxydxmobwrccqagltlci.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4eWR4bW9id3JjY3FhZ2x0bGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDMzOTMsImV4cCI6MjA3MDcxOTM5M30.Zk2xUlmlPGbe-7rDsqC486Js9LGFMMOp-fytNZSwzBs";

async function run() {
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
  };

  try {
    // PostgREST returns CSV with headers if we request text/csv!
    const res = await fetch(`${SUPABASE_URL}/rest/v1/customer?limit=1`, {
      headers: {
        ...headers,
        "Accept": "text/csv"
      }
    });
    const text = await res.text();
    console.log("CSV Header (customer):");
    console.log(text.trim().split("\n")[0]);
  } catch (e) {
    console.error("Failed:", e);
  }
}

run();
