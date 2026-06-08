
const SUPABASE_URL = "https://gxydxmobwrccqagltlci.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4eWR4bW9id3JjY3FhZ2x0bGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDMzOTMsImV4cCI6MjA3MDcxOTM5M30.Zk2xUlmlPGbe-7rDsqC486Js9LGFMMOp-fytNZSwzBs";

async function test() {
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
  };

  try {
    console.log("Fetching myStudyRoomCertificates states...");
    const url = `${SUPABASE_URL}/rest/v1/simp_course_state?state_key=eq.myStudyRoomCertificates&select=owner_key,state_value`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    console.log("Status Code:", res.status);
    console.log("States:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch test failed:", err);
  }
}

test();
