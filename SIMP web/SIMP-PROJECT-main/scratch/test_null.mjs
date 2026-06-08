const SUPABASE_URL = "https://gxydxmobwrccqagltlci.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4eWR4bW9id3JjY3FhZ2x0bGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDMzOTMsImV4cCI6MjA3MDcxOTM5M30.Zk2xUlmlPGbe-7rDsqC486Js9LGFMMOp-fytNZSwzBs";

async function test() {
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
  };

  try {
    console.log("Fetching certificates from installer_documents...");
    const url = `${SUPABASE_URL}/rest/v1/installer_documents?select=installer_id,certificates`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    
    let issueFound = false;
    for (const row of data) {
      if (row.certificates) {
        if (!Array.isArray(row.certificates)) {
          console.log(`Worker ${row.installer_id} certificates is not an array:`, row.certificates);
          issueFound = true;
        } else {
          row.certificates.forEach((c, idx) => {
            if (c === null || c === undefined || typeof c !== "string") {
              console.log(`Worker ${row.installer_id} certificates at index ${idx} is invalid:`, c);
              issueFound = true;
            }
          });
        }
      }
    }
    if (!issueFound) {
      console.log("All certificates in the database are valid strings!");
    }
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
