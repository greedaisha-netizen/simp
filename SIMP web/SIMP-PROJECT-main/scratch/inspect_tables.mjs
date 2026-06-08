async function run() {
  const SUPABASE_URL = "https://gxydxmobwrccqagltlci.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4eWR4bW9id3JjY3FhZ2x0bGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDMzOTMsImV4cCI6MjA3MDcxOTM5M30.Zk2xUlmlPGbe-7rDsqC486Js9LGFMMOp-fytNZSwzBs";

  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers });
    const data = await res.json();
    console.log("Tables in Schema:");
    const tables = Object.keys(data.paths || {});
    const filteredTables = tables.filter(t => t !== "/");
    console.log(filteredTables.map(t => t.replace(/^\//, "")));
  } catch (e) {
    console.error("Failed to fetch OpenAPI spec:", e);
  }
}

run();
