globalThis.WebSocket = class {};

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  const email = `test_customer_${Date.now()}@example.com`;
  const password = "password123";

  console.log(`Signing up as ${email}...`);
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpErr) {
    console.error("Sign up error:", signUpErr);
    return;
  }

  const user = signUpData.user;
  const session = signUpData.session;
  console.log("Sign up success. User ID:", user?.id);
  console.log("Session exists:", !!session);

  if (!session) {
    console.log("No session. Attempting sign in...");
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log("Sign in result:", { user: signInData?.user?.id, session: !!signInData?.session, error: signInErr });
  }

  // Run queries as logged-in user
  const { data: jobs, error: jobsErr } = await supabase
    .schema("jobs")
    .from("job")
    .select("job_id, job_title")
    .limit(5);
  console.log("JOBS (Auth):", { count: jobs?.length, error: jobsErr });

  const { data: apps, error: appsErr } = await supabase
    .schema("jobs")
    .from("job_application")
    .select("job_id, application_id")
    .limit(5);
  console.log("JOB_APPLICATIONS (Auth):", { count: apps?.length, error: appsErr });
}

test();
