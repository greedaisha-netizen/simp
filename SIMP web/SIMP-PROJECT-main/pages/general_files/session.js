import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../../supabase.js";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function isLocalPreviewEnvironment() {
  return (
    window.location.protocol === "file:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

function isPreviewBypassEnabled() {
  const params = new URLSearchParams(window.location.search);
  const hasQueryFlag = params.get("preview") === "1";

  if (hasQueryFlag) {
    sessionStorage.setItem("simpPreviewBypass", "1");
  }

  return hasQueryFlag || sessionStorage.getItem("simpPreviewBypass") === "1";
}

const shouldBypassSessionGuard =
  isLocalPreviewEnvironment() && isPreviewBypassEnabled();

/**
 * Checks the current session depending on the page type
 * - If on a protected page (like dashboard) and not logged in → redirect to login
 * - If on login page and already logged in → redirect to dashboard
 */
(async function checkSession() {
  if (shouldBypassSessionGuard) {
    console.info("Session guard bypassed for local preview.");
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const path = window.location.pathname;

  if (!session) {
    // If user is not logged in but on a protected page → redirect
    if (!path.includes("login.html")) {
      window.location.replace("../../../index.html");
    }
  } else {
    // If user IS logged in but tries to visit login page → redirect to dashboard
    if (path.includes("login.html")) {
      window.location.replace("dashboard.html");
    }

    // Add dynamic sidebar checking for pending certificate soft copies
    if (path.includes("/admin_pages/")) {
      void checkPendingCertificatesForSidebar(supabase);
    }
  }
})();

// Attach logout logic if logout button exists on this page
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.replace("../../../index.html");
      } catch (err) {
        alert("Logout failed: " + err.message);
        console.error(err);
      }
    });
  }
});

// Asynchronous Global Certificate Checker
async function checkPendingCertificatesForSidebar(supabaseClient) {
  let hasAnyPending = false;

  // 1. Check if there are any installer profiles with pending verification status
  try {
    const { count: pendingAccountsCount, error: pendingAccountsErr } = await supabaseClient
      .from("installer_documents")
      .select("*", { count: "exact", head: true })
      .or("status.eq.pending,status.is.null");

    if (!pendingAccountsErr && pendingAccountsCount && pendingAccountsCount > 0) {
      hasAnyPending = true;
    }
  } catch (e) {
    console.warn("Sidebar pending accounts check failed:", e);
  }

  // 2. If no pending accounts, check if there are any pending certificate uploads
  if (!hasAnyPending) {
    try {
      // Fetch courses, sections, and contents to build the catalog
      const { data: courses, error: errC } = await supabaseClient.schema("course").from("courses").select("id, title");
      if (!errC && courses && courses.length > 0) {
        const { data: sections, error: errS } = await supabaseClient.schema("course").from("sections").select("id, course_id, title").order("position", { ascending: true });
        const { data: contents, error: errL } = await supabaseClient.schema("course").from("section_contents").select("id, section_id, body").order("position", { ascending: true });

        if (!errS && sections && !errL && contents) {
          // Build lesson count per course
          const contentsBySection = new Map();
          for (const row of contents || []) {
            const arr = contentsBySection.get(row.section_id) || [];
            arr.push(row);
            contentsBySection.set(row.section_id, arr);
          }

          const catalog = courses.map(c => {
            const courseSections = sections.filter(s => s.course_id === c.id);
            const levels = courseSections.map(s => {
              const lessons = [];
              const sectionContents = contentsBySection.get(s.id) || [];
              if (sectionContents.length) {
                try {
                  const parsed = JSON.parse(sectionContents[0].body);
                  if (parsed && parsed.kind === "section-lessons" && Array.isArray(parsed.lessons)) {
                    lessons.push(...parsed.lessons);
                  }
                } catch(e){}
              }
              return { id: s.id, lessons };
            });
            return { id: c.id, title: c.title, levels };
          });

          // Fetch all course state rows
          const { data: stateRows, error: stateErr } = await supabaseClient
            .from("simp_course_state")
            .select("owner_key, state_key, state_value")
            .in("state_key", ["myStudyRoomLibrary", "myStudyRoomCertificates"]);

          // Fetch installer documents to merge admin-uploaded certificates
          const { data: docRows } = await supabaseClient
            .from("installer_documents")
            .select("installer_id, certificates");

          if (!stateErr && stateRows) {
            // Group states by workerId
            const statesByWorker = new Map();
            for (const row of stateRows) {
              const workerId = row.owner_key.replace(/^user:/, "");
              let map = statesByWorker.get(workerId);
              if (!map) {
                map = { library: [], certificates: {} };
                statesByWorker.set(workerId, map);
              }
              if (row.state_key === "myStudyRoomLibrary" && row.state_value) {
                try { map.library = JSON.parse(row.state_value); } catch(e){}
              } else if (row.state_key === "myStudyRoomCertificates" && row.state_value) {
                try { map.certificates = JSON.parse(row.state_value); } catch(e){}
              }
            }

            // Build a map of active installer_documents certificates per worker
            const docCertsByWorker = new Map();
            if (docRows) {
              for (const docRow of docRows) {
                docCertsByWorker.set(docRow.installer_id, Array.isArray(docRow.certificates) ? docRow.certificates : []);
              }
            }

            // Prune deleted certificates and merge active ones
            for (const [workerId, map] of statesByWorker.entries()) {
              const docCerts = docCertsByWorker.get(workerId) || [];

              // 1. Prune deleted admin-uploaded certificates from the persistent state map
              Object.keys(map.certificates).forEach(courseId => {
                const certObj = map.certificates[courseId];
                if (certObj && certObj.path && certObj.path.includes("/certificates/") && certObj.path.includes("_certificate.")) {
                  const stillExists = docCerts.some(p => p === certObj.path);
                  if (!stillExists) {
                    delete map.certificates[courseId];
                  }
                }
              });

              // 2. Merge active admin-uploaded certificates
              docCerts.forEach(path => {
                if (path.includes("/certificates/") && path.includes("_certificate.")) {
                  const filename = path.split("/").pop();
                  const parts = filename.split("_");
                  if (parts.length >= 3) {
                    const courseId = parts[1];
                    map.certificates[courseId] = {
                      path: path,
                      uploadedAt: new Date().toISOString()
                    };
                  }
                }
              });
            }

            // Count if any worker has a pending certificate upload
            for (const [workerId, state] of statesByWorker.entries()) {
              const lib = state.library || [];
              const certs = state.certificates || {};

              for (const course of catalog) {
                const courseLevels = course.levels || [];
                if (courseLevels.length === 0) continue;

                let allLevelsStudyPassed = true;
                for (const level of courseLevels) {
                  const totalLessons = level.lessons.length;
                  if (totalLessons === 0) {
                    allLevelsStudyPassed = false;
                    continue;
                  }
                  let completedLessonsCount = 0;
                  for (const lesson of level.lessons) {
                    const isCompleted = lib.some(x => String(x.courseId) === String(course.id) && String(x.levelId) === String(level.id) && String(x.lessonId) === String(lesson.id) && x.isCompleted);
                    if (isCompleted) completedLessonsCount++;
                  }
                  if (completedLessonsCount < totalLessons) {
                    allLevelsStudyPassed = false;
                  }
                }

                if (allLevelsStudyPassed) {
                  const certData = certs[course.id] || null;
                  if (!certData || !certData.path) {
                    hasAnyPending = true;
                    break;
                  }
                }
              }
              if (hasAnyPending) break;
            }
          }
        }
      }
    } catch (e) {
      console.warn("Global sidebar pending certificates check failed:", e);
    }
  }

  // Update the sidebar badge in DOM
  updateSidebarBadgeDOM(hasAnyPending);
}

function updateSidebarBadgeDOM(hasAnyPending) {
  // Find the 'workerVerification.html' link in the sidebar
  const links = document.querySelectorAll("aside .sidebar a");
  let workerLink = null;
  for (const a of links) {
    if (a.getAttribute("href") && a.getAttribute("href").includes("workerVerification.html")) {
      workerLink = a;
      break;
    }
  }

  if (workerLink) {
    let badge = workerLink.querySelector(".message-count");
    if (hasAnyPending) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "message-count";
        badge.style.cssText = "background-color: #f59e0b; padding: 2px 6px; border-radius: 99px; font-weight: 700; color: #fff; font-size: 11px; position: absolute; right: 0.6rem; top: 50%; transform: translateY(-50%);";
        badge.textContent = "!";
        workerLink.appendChild(badge);
      } else {
        badge.style.display = "inline-block";
        badge.textContent = "!";
      }
    } else {
      if (badge) {
        badge.remove();
      }
    }
  }
}

// Expose checker globally so individual pages can trigger instant refreshes
window.checkPendingCertificatesForSidebar = checkPendingCertificatesForSidebar;
