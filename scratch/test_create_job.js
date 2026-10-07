import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase.js';
import ws from 'ws';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

async function run() {
  // Let's get a customer id to use as posted_by
  const { data: customer, error: cErr } = await supabase.from('customer').select('id').limit(1).maybeSingle();
  if (cErr) {
    console.error("Error fetching customer:", cErr);
    return;
  }
  const customerId = customer ? customer.id : null;
  console.log("Using customer ID:", customerId);

  if (!customerId) {
    console.error("No customers found in database to test with.");
    return;
  }

  const payload = {
    job_title: "Test Job from Script",
    job_description: "Test description",
    job_difficulty: 0,
    job_category: "General Help",
    job_location: "Test Location",
    job_date: "2026-12-31",
    job_time: "12:00:00",
    job_duration: "01:00:00",
    job_pay: 1000.00,
    job_picture_url: null,
    job_manpower: 1,
    application_mode: "beginner-friendly",
    required_course_tags: [],
    required_experience: [],
    min_requirements_met: 0,
    job_code: "TEST-9999",
    posted_by: customerId,
    job_status: "pending_review"
  };

  const { data, error } = await supabase
    .schema("jobs")
    .from("job")
    .insert([payload])
    .select();

  console.log("Insert result:", data);
  console.log("Insert error:", error);
}

run();
