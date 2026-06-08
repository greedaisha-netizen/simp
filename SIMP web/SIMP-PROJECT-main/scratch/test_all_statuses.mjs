const SUPABASE_URL = "https://gxydxmobwrccqagltlci.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4eWR4bW9id3JjY3FhZ2x0bGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDMzOTMsImV4cCI6MjA3MDcxOTM5M30.Zk2xUlmlPGbe-7rDsqC486Js9LGFMMOp-fytNZSwzBs";

async function testStatus(status) {
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Accept-Profile": "jobs",
    "Content-Profile": "jobs",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
  };

  const payload = {
    job_title: "Test Status " + status,
    job_location: "Test Location",
    job_date: "2026-06-01",
    job_time: "10:00:00",
    job_pay: 100,
    job_code: "TST-" + Math.floor(1000 + Math.random() * 9000),
    posted_by: "3be6058d-71b5-4bcf-a870-22c676d1e444",
    job_status: status
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/job`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  
  if (res.status === 201 || res.status === 200 || res.status === 204) {
    console.log(`Status '${status}': SUCCESS`);
    // Delete it
    await fetch(`${SUPABASE_URL}/rest/v1/job?job_title=eq.Test%20Status%20${status}`, {
      method: "DELETE",
      headers
    });
  } else {
    const text = await res.text();
    console.log(`Status '${status}': FAILED (HTTP ${res.status}): ${text}`);
  }
}

async function run() {
  const statuses = ["pending", "viewed", "approved", "rejected", "done", "overdue", "active", "posted", "published"];
  for (const s of statuses) {
    await testStatus(s);
  }
}

run();
