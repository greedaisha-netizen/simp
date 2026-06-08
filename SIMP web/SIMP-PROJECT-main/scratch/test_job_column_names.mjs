const SUPABASE_URL = "https://gxydxmobwrccqagltlci.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4eWR4bW9id3JjY3FhZ2x0bGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDMzOTMsImV4cCI6MjA3MDcxOTM5M30.Zk2xUlmlPGbe-7rDsqC486Js9LGFMMOp-fytNZSwzBs";

async function testColumn(colName) {
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Accept-Profile": "jobs",
    "Content-Profile": "jobs",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
  };

  const payload = {
    job_title: "Test Job Title",
    job_location: "Test Location",
    job_date: "2026-06-01",
    job_time: "10:00:00",
    job_pay: 100,
    job_code: "TST-9999",
    posted_by: "3be6058d-71b5-4bcf-a870-22c676d1e444", // dummy uuid
    job_status: "pending",
    [colName]: "09171234567"
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/job`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    if (res.status === 400 && text.includes("Could not find the")) {
      return false; // column doesn't exist
    }
    console.log(`Column '${colName}' result - Status:`, res.status, "Response:", text);
    return true; // it didn't fail on "column does not exist"
  } catch (e) {
    return false;
  }
}

async function run() {
  const cols = ["job_phone", "contact_number", "phone_number", "customer_phone", "contact", "phone"];
  for (const c of cols) {
    const ok = await testColumn(c);
    console.log(`Column '${c}': ${ok ? "EXISTS" : "DOES NOT EXIST"}`);
  }
}

run();
