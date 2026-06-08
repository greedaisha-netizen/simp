async function run() {
  const SUPABASE_URL = "https://gxydxmobwrccqagltlci.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4eWR4bW9id3JjY3FhZ2x0bGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDMzOTMsImV4cCI6MjA3MDcxOTM5M30.Zk2xUlmlPGbe-7rDsqC486Js9LGFMMOp-fytNZSwzBs";

  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
  };

  const tables = [
    "public.course_payments",
    "public.enrollment_requests",
    "public.payments",
    "course.payments",
    "course.enrollments",
    "earnings.payments",
    "earnings.course_payments"
  ];

  for (const t of tables) {
    const parts = t.split(".");
    const schema = parts[0];
    const table = parts[1];
    const url = `${SUPABASE_URL}/rest/v1/${table}`;
    const reqHeaders = { ...headers, "Accept-Profile": schema };
    
    try {
      const res = await fetch(url, { headers: reqHeaders });
      console.log(`Table ${t}: Status = ${res.status}`);
    } catch (e) {
      console.log(`Table ${t}: Error = ${e.message}`);
    }
  }
}

run();
