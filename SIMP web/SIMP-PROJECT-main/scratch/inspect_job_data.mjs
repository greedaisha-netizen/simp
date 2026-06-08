const SUPABASE_URL = "https://gxydxmobwrccqagltlci.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4eWR4bW9id3JjY3FhZ2x0bGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDMzOTMsImV4cCI6MjA3MDcxOTM5M30.Zk2xUlmlPGbe-7rDsqC486Js9LGFMMOp-fytNZSwzBs";

async function run() {
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Accept-Profile": "jobs"
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/job?limit=1`, { headers });
    const data = await res.json();
    console.log("Response status:", res.status);
    console.log("Job data fields:", Object.keys(data[0] || {}));
    console.log("Full single row:", data[0]);
  } catch (e) {
    console.error("Failed to fetch job data:", e);
  }
}

run();
