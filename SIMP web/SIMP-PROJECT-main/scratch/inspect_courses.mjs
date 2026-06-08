import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../supabase.js";

async function run() {
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Accept-Profile": "course"
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/courses`, { headers });
    const courses = await res.json();
    console.log("COURSES IN DATABASE:");
    console.log(JSON.stringify(courses, null, 2));

    const resS = await fetch(`${SUPABASE_URL}/rest/v1/sections`, { headers });
    const sections = await resS.json();
    console.log("SECTIONS IN DATABASE:");
    console.log(JSON.stringify(sections, null, 2));
  } catch (e) {
    console.error("Error:", e.message);
  }
}

run();
