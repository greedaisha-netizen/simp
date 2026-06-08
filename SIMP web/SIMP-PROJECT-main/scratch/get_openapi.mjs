const SUPABASE_URL = "https://gxydxmobwrccqagltlci.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4eWR4bW9id3JjY3FhZ2x0bGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDMzOTMsImV4cCI6MjA3MDcxOTM5M30.Zk2xUlmlPGbe-7rDsqC486Js9LGFMMOp-fytNZSwzBs";

async function run() {
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Accept-Profile": "jobs",
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers
  });
  const data = await res.json();
  
  // Print info about job table and job_status type
  const jobDef = data.definitions?.job;
  if (jobDef) {
    console.log("Job status definition properties:", JSON.stringify(jobDef.properties.job_status, null, 2));
  } else {
    console.log("Job definition not found. Available definitions:", Object.keys(data.definitions || {}));
  }
}

run();
