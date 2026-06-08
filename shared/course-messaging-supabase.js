import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
} from "../supabase.js";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const COURSE_SCHEMA_CANDIDATES = ["course", "courses"];
const THREAD_TABLE = "course_message_thread";
const MESSAGE_TABLE = "course_private_message";
const READY_EVENT = "simp-course-messaging-ready";
const UPDATED_EVENT = "simp-course-messaging-updated";

let activeCourseSchemaPromise = null;
let currentActorPromise = null;

function resetCurrentActorCache() {
  currentActorPromise = null;
}

function inferPreferredRoleFromPage() {
  const path = String(window.location.pathname || "").toLowerCase();
  if (path.includes("/admin_pages/") || path.endsWith("/adminlogin.html")) {
    return "admin";
  }
  if (
    path.includes("/installer_pages/") ||
    path.includes("/enroll/") ||
    path.includes("/adding_course/")
  ) {
    return "learner";
  }
  return "";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function dispatchMessagingEvent(eventName, detail = {}) {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

function getSchemaTable(schemaName, tableName) {
  if (typeof client.schema === "function") {
    return client.schema(schemaName).from(tableName);
  }

  return client.from(`${schemaName}.${tableName}`);
}

function normalizeTimestamp(value) {
  if (!value) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIsoString(value = Date.now()) {
  return new Date(value).toISOString();
}

function getInitials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2) || "??";
}

async function getActiveCourseSchema() {
  if (!activeCourseSchemaPromise) {
    activeCourseSchemaPromise = (async () => {
      for (const schemaName of COURSE_SCHEMA_CANDIDATES) {
        const { error } = await getSchemaTable(schemaName, THREAD_TABLE)
          .select("id")
          .limit(1);

        if (!error) {
          return schemaName;
        }
      }

      return COURSE_SCHEMA_CANDIDATES[0];
    })();
  }

  return activeCourseSchemaPromise;
}

async function fromCourse(tableName) {
  const schemaName = await getActiveCourseSchema();
  return getSchemaTable(schemaName, tableName);
}

async function resolveCurrentActor(options = {}) {
  if (currentActorPromise) {
    return currentActorPromise;
  }

  currentActorPromise = (async () => {
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      return null;
    }

    const normalizedEmail = normalizeEmail(user.email);
    const preferredRole =
      String(options?.preferredRole || "").trim().toLowerCase() ||
      inferPreferredRoleFromPage();
    const metadataRole = String(user.user_metadata?.role || "")
      .trim()
      .toLowerCase();
    const [adminResult, installerResult] = await Promise.allSettled([
      client
        .from("admin")
        .select("id,email,name")
        .eq("id", user.id)
        .maybeSingle(),
      client
        .from("installer")
        .select("id,email,name")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    const adminRow =
      adminResult.status === "fulfilled" ? adminResult.value.data : null;
    let installerRow =
      installerResult.status === "fulfilled" ? installerResult.value.data : null;

    let adminByEmail = null;
    if (!adminRow?.id && normalizedEmail) {
      const { data } = await client
        .from("admin")
        .select("id,email,name")
        .eq("email", normalizedEmail)
        .maybeSingle();
      adminByEmail = data || null;
    }

    if (!installerRow?.id && normalizedEmail) {
      const { data } = await client
        .from("installer")
        .select("id,email,name")
        .eq("email", normalizedEmail)
        .maybeSingle();
      installerRow = data || null;
    }

    const resolvedAdminRow = adminRow?.id ? adminRow : adminByEmail;

    const hasAdminProfile = !!resolvedAdminRow?.id;
    const hasInstallerProfile = !!installerRow?.id;

    // If this authenticated account can resolve to both profiles, prefer the
    // role implied by the current page before falling back to metadata.
    if (preferredRole === "admin" && hasAdminProfile) {
      return {
        id: resolvedAdminRow.id,
        authId: user.id,
        role: "admin",
        name: resolvedAdminRow.name || user.user_metadata?.name || "SIMP Admin",
        email: resolvedAdminRow.email || user.email || "",
      };
    }

    if (preferredRole === "learner" && hasInstallerProfile) {
      return {
        id: user.id,
        profileId: installerRow.id,
        authId: user.id,
        role: "learner",
        name:
          installerRow.name ||
          user.user_metadata?.name ||
          user.email ||
          "Installer",
        email: installerRow.email || user.email || "",
      };
    }

    if (["installer", "learner", "worker"].includes(metadataRole)) {
      if (installerRow?.id) {
        return {
          id: user.id,
          profileId: installerRow.id,
          authId: user.id,
          role: "learner",
          name:
            installerRow.name ||
            user.user_metadata?.name ||
            user.email ||
            "Installer",
          email: installerRow.email || user.email || "",
        };
      }

      return {
        id: user.id,
        authId: user.id,
        role: "learner",
        name: user.user_metadata?.name || user.email || "Installer",
        email: user.email || "",
      };
    }

    if (["admin", "superadmin"].includes(metadataRole) && resolvedAdminRow?.id) {
      return {
        id: resolvedAdminRow.id,
        authId: user.id,
        role: "admin",
        name: resolvedAdminRow.name || user.user_metadata?.name || "SIMP Admin",
        email: resolvedAdminRow.email || user.email || "",
      };
    }

    if (resolvedAdminRow?.id) {
      return {
        id: resolvedAdminRow.id,
        authId: user.id,
        role: "admin",
        name: resolvedAdminRow.name || user.user_metadata?.name || "SIMP Admin",
        email: resolvedAdminRow.email || user.email || "",
      };
    }

    if (installerRow?.id) {
      return {
        // Use the authenticated user id for learner-owned rows so Supabase
        // RLS policies based on auth.uid() continue to work even if the
        // public.installer row id does not match the auth user id.
        id: user.id,
        profileId: installerRow.id,
        authId: user.id,
        role: "learner",
        name: installerRow.name || user.user_metadata?.name || user.email || "Installer",
        email: installerRow.email || user.email || "",
      };
    }

    return {
      id: user.id,
      authId: user.id,
      role: "learner",
      name: user.user_metadata?.name || user.email || "Installer",
      email: user.email || "",
    };
  })();

  return currentActorPromise;
}

function mapMessageRow(row) {
  return {
    id: String(row?.id || ""),
    threadId: String(row?.thread_id || ""),
    sender: row?.sender_role === "admin" ? "admin" : "learner",
    authorId: String(row?.author_id || ""),
    authorName: String(
      row?.author_name || (row?.sender_role === "admin" ? "SIMP Admin" : "Installer")
    ),
    message: String(row?.body || ""),
    createdAt: normalizeTimestamp(row?.created_at),
    editedAt: normalizeTimestamp(row?.edited_at),
    replyToId: String(row?.reply_to_message_id || ""),
    replyToMessageId: String(row?.reply_to_message_id || ""),
    lessonContext: row?.lesson_context || null,
    reviewContext: row?.review_context || null,
  };
}

function mapThreadRow(row, messages = []) {
  const unreadIncoming = messages.some((message) => {
    const createdAt = normalizeTimestamp(message.created_at);
    if (message.sender_role !== "learner") {
      return false;
    }

    return createdAt > normalizeTimestamp(row?.admin_last_read_at);
  });

  return {
    id: String(row?.id || ""),
    learnerId: String(row?.learner_id || ""),
    learnerName: String(row?.learner_name || "Installer"),
    learnerEmail: String(row?.learner_email || ""),
    initials: getInitials(row?.learner_name || row?.learner_email || "Installer"),
    unread: unreadIncoming,
    lastMessageAt: normalizeTimestamp(row?.last_message_at || row?.updated_at),
    messages: messages.map((message) => mapMessageRow(message)),
  };
}

async function loadLearnerProfile(learnerId) {
  if (!learnerId) {
    return null;
  }

  const { data, error } = await client
    .from("installer")
    .select("id,email,name")
    .eq("id", learnerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function ensureThreadForLearner(learnerId, fallbackProfile = null) {
  const threadTable = await fromCourse(THREAD_TABLE);
  const { data: existing, error: existingError } = await threadTable
    .select("*")
    .eq("learner_id", learnerId)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }

  if (existing?.id) {
    return existing;
  }

  const profile = fallbackProfile || (await loadLearnerProfile(learnerId));
  const nowIso = toIsoString();
  const payload = {
    learner_id: learnerId,
    learner_name: profile?.name || profile?.email || "Installer",
    learner_email: profile?.email || "",
    created_at: nowIso,
    updated_at: nowIso,
    last_message_at: nowIso,
    admin_last_read_at: null,
    learner_last_read_at: nowIso,
  };

  const { data, error } = await threadTable
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function updateThreadReadMarkers(threadId, fields) {
  const threadTable = await fromCourse(THREAD_TABLE);
  const payload = Object.fromEntries(
    Object.entries({
      ...fields,
      updated_at: toIsoString(),
    }).filter(([, value]) => value !== undefined)
  );
  const { error } = await threadTable
    .update(payload)
    .eq("id", threadId);

  if (error) {
    throw error;
  }
}

async function fetchThreadMessagesByThreadId(threadId) {
  const messageTable = await fromCourse(MESSAGE_TABLE);
  const { data, error } = await messageTable
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => mapMessageRow(row));
}

async function fetchThreadMessagesByLearnerId(learnerId) {
  const threadTable = await fromCourse(THREAD_TABLE);
  const { data: thread, error: threadError } = await threadTable
    .select("*")
    .eq("learner_id", learnerId)
    .maybeSingle();

  if (threadError && threadError.code !== "PGRST116") {
    throw threadError;
  }

  if (!thread?.id) {
    return [];
  }

  return fetchThreadMessagesByThreadId(thread.id);
}

async function fetchAdminThreads() {
  const threadTable = await fromCourse(THREAD_TABLE);
  const messageTable = await fromCourse(MESSAGE_TABLE);
  const { data: threads, error: threadError } = await threadTable
    .select("*")
    .order("last_message_at", { ascending: false });

  if (threadError) {
    throw threadError;
  }

  if (!threads?.length) {
    return [];
  }

  const threadIds = threads.map((thread) => thread.id);
  const { data: messages, error: messageError } = await messageTable
    .select("*")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: true });

  if (messageError) {
    throw messageError;
  }

  const messagesByThread = new Map();
  (messages || []).forEach((message) => {
    const list = messagesByThread.get(message.thread_id) || [];
    list.push(message);
    messagesByThread.set(message.thread_id, list);
  });

  return threads.map((thread) =>
    mapThreadRow(thread, messagesByThread.get(thread.id) || [])
  );
}

async function fetchAdminInboxMessages() {
  const threads = await fetchAdminThreads();
  return threads
    .flatMap((thread) =>
      thread.messages.map((message) => ({
        ...message,
        learnerId: thread.learnerId,
        learnerName: thread.learnerName,
      }))
    )
    .sort((left, right) => Number(left.createdAt || 0) - Number(right.createdAt || 0));
}

async function fetchCurrentLearnerMessages() {
  const actor = await resolveCurrentActor();
  if (!actor?.id) {
    return [];
  }

  const messages = await fetchThreadMessagesByLearnerId(actor.id);
  return messages;
}

async function sendMessage({
  learnerId = "",
  body,
  replyToMessageId = "",
  lessonContext = null,
  reviewContext = null,
}) {
  const actor = await resolveCurrentActor();
  if (!actor?.id) {
    throw new Error("You must be signed in to send messages.");
  }

  const targetLearnerId = actor.role === "admin" ? learnerId : actor.id;
  if (!targetLearnerId) {
    throw new Error("A learner thread is required before sending a message.");
  }

  const targetProfile =
    actor.role === "admin" ? await loadLearnerProfile(targetLearnerId) : actor;
  const thread = await ensureThreadForLearner(targetLearnerId, targetProfile);
  const createdAtIso = toIsoString();
  const messageTable = await fromCourse(MESSAGE_TABLE);
  const payload = {
    thread_id: thread.id,
    sender_role: actor.role === "admin" ? "admin" : "learner",
    author_id: actor.id,
    // Keep the real admin name internally so shared admin inboxes can show
    // which admin replied, while learner-facing UIs can still present a
    // unified "SIMP Admin" identity if desired.
    author_name: actor.name,
    body: String(body || "").trim(),
    reply_to_message_id: replyToMessageId || null,
    lesson_context: lessonContext || null,
    review_context: reviewContext || null,
    created_at: createdAtIso,
    edited_at: null,
  };

  const { data, error } = await messageTable
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await updateThreadReadMarkers(thread.id, {
    learner_name: targetProfile?.name || thread.learner_name,
    learner_email: targetProfile?.email || thread.learner_email,
    last_message_at: createdAtIso,
    admin_last_read_at: actor.role === "admin" ? createdAtIso : thread.admin_last_read_at,
    learner_last_read_at: actor.role === "learner" ? createdAtIso : thread.learner_last_read_at,
  });

  dispatchMessagingEvent(UPDATED_EVENT, {
    type: "send",
    learnerId: targetLearnerId,
    messageId: data?.id || "",
  });

  return mapMessageRow(data);
}

async function updateMessage({ messageId, body }) {
  const messageTable = await fromCourse(MESSAGE_TABLE);
  const { data, error } = await messageTable
    .update({
      body: String(body || "").trim(),
      edited_at: toIsoString(),
    })
    .eq("id", messageId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  dispatchMessagingEvent(UPDATED_EVENT, {
    type: "update",
    messageId,
    learnerId: "",
  });

  return mapMessageRow(data);
}

async function deleteMessage(messageId) {
  const messageTable = await fromCourse(MESSAGE_TABLE);
  const { error } = await messageTable.delete().eq("id", messageId);

  if (error) {
    throw error;
  }

  dispatchMessagingEvent(UPDATED_EVENT, {
    type: "delete",
    messageId,
    learnerId: "",
  });
}

async function markThreadReadByLearnerId(learnerId, viewerRole = "admin") {
  if (!learnerId) {
    return;
  }

  const threadTable = await fromCourse(THREAD_TABLE);
  const { data: thread, error } = await threadTable
    .select("*")
    .eq("learner_id", learnerId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  if (!thread?.id) {
    return;
  }

  // Prevent infinite loops by only updating and dispatching if the thread is actually unread
  if (viewerRole === "admin") {
    const isUnread = normalizeTimestamp(thread.last_message_at) > normalizeTimestamp(thread.admin_last_read_at);
    if (!isUnread) {
      return;
    }
  } else {
    const isUnread = normalizeTimestamp(thread.last_message_at) > normalizeTimestamp(thread.learner_last_read_at);
    if (!isUnread) {
      return;
    }
  }

  await updateThreadReadMarkers(thread.id, {
    admin_last_read_at: viewerRole === "admin" ? toIsoString() : undefined,
    learner_last_read_at: viewerRole === "learner" ? toIsoString() : undefined,
  });

  dispatchMessagingEvent(UPDATED_EVENT, {
    type: "read",
    learnerId,
  });
}

async function ready() {
  await getActiveCourseSchema();
  await resolveCurrentActor();
  dispatchMessagingEvent(READY_EVENT, {});
}

client.auth.onAuthStateChange(() => {
  resetCurrentActorCache();
});

let lastCheckedState = {
  hasUnread: false,
  latestMessageAt: 0,
  totalThreads: 0
};

async function runUnreadBadgeChecker() {
  try {
    const actor = await resolveCurrentActor();
    if (!actor?.id) {
      return;
    }

    let hasUnread = false;
    let latestMessageAt = 0;
    let totalThreads = 0;

    if (actor.role === "admin") {
      const threads = await fetchAdminThreads();
      hasUnread = threads.some((t) => t.unread);
      totalThreads = threads.length;
      latestMessageAt = threads.length ? Math.max(...threads.map(t => Number(t.lastMessageAt || 0)), 0) : 0;
    } else {
      const threadTable = await fromCourse(THREAD_TABLE);
      const { data: thread } = await threadTable
        .select("*")
        .eq("learner_id", actor.id)
        .maybeSingle();
      if (thread) {
        const messages = await fetchThreadMessagesByThreadId(thread.id);
        hasUnread = messages.some(
          (msg) =>
            msg.sender_role === "admin" &&
            normalizeTimestamp(msg.created_at) >
              normalizeTimestamp(thread.learner_last_read_at)
        );
        totalThreads = 1;
        latestMessageAt = messages.length ? Math.max(...messages.map(m => Number(m.createdAt || 0)), 0) : 0;
      }
    }

    // Dynamic Change Detection for Realtime UI Refresh
    const hasChanged = hasUnread !== lastCheckedState.hasUnread ||
                       latestMessageAt !== lastCheckedState.latestMessageAt ||
                       totalThreads !== lastCheckedState.totalThreads;

    if (hasChanged) {
      lastCheckedState = { hasUnread, latestMessageAt, totalThreads };
      dispatchMessagingEvent(UPDATED_EVENT, { type: "sync" });
    }

    // Update Sidebar badge (Admin/Publisher link)
    const sidebarLink = document.querySelector('aside .sidebar a[href*="courseBuilder.html"]') ||
                        window.parent?.document?.querySelector('aside .sidebar a[href*="courseBuilder.html"]');
    if (sidebarLink) {
      let badge = sidebarLink.querySelector(".sidebar-unread-badge");
      if (hasUnread) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "sidebar-unread-badge";
          badge.textContent = "!";
          Object.assign(badge.style, {
            background: "#ff7782",
            color: "white",
            borderRadius: "50%",
            width: "18px",
            height: "18px",
            fontSize: "11px",
            fontWeight: "700",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: "auto",
            lineHeight: "1",
            boxShadow: "0 2px 4px rgba(255, 119, 130, 0.3)",
          });
          sidebarLink.appendChild(badge);
        }
      } else {
        badge?.remove();
      }
    }

    // Update Subnav badge (Messages tab inside admin.html)
    const subnavLink = document.querySelector('.admin-subnav-link[data-management-view="messages"]');
    if (subnavLink) {
      const span = subnavLink.querySelector("span");
      if (span) {
        let badge = span.querySelector(".subnav-unread-badge");
        if (hasUnread) {
          if (!badge) {
            badge = document.createElement("span");
            badge.className = "subnav-unread-badge";
            badge.textContent = "!";
            Object.assign(badge.style, {
              background: "#ff7782",
              color: "white",
              borderRadius: "50%",
              padding: "1px 6px",
              fontSize: "10px",
              fontWeight: "700",
              marginLeft: "6px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "14px",
              height: "14px",
              lineHeight: "1",
              verticalAlign: "middle",
              boxShadow: "0 1px 3px rgba(255, 119, 130, 0.2)",
            });
            span.appendChild(badge);
          }
        } else {
          badge?.remove();
        }
      }
    }
  } catch (err) {
    console.warn("[course-messaging] Unread badge checker failed", err);
  }
}

async function startUnreadBadgeChecking() {
  runUnreadBadgeChecker();
  setInterval(runUnreadBadgeChecker, 5000);
  try {
    const activeSchema = await getActiveCourseSchema();
    client
      .channel("badge-updates")
      .on("postgres_changes", { event: "*", schema: activeSchema, table: "course_private_message" }, () => {
        runUnreadBadgeChecker();
        dispatchMessagingEvent(UPDATED_EVENT, { type: "realtime" });
      })
      .on("postgres_changes", { event: "*", schema: activeSchema, table: "course_message_thread" }, () => {
        runUnreadBadgeChecker();
        dispatchMessagingEvent(UPDATED_EVENT, { type: "realtime" });
      })
      .subscribe();
  } catch (e) {
    console.warn("[course-messaging] Supabase Realtime channel error", e);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startUnreadBadgeChecking);
} else {
  startUnreadBadgeChecking();
}

const api = {
  READY_EVENT,
  UPDATED_EVENT,
  ready,
  getCurrentActor: resolveCurrentActor,
  fetchAdminThreads,
  fetchAdminInboxMessages,
  fetchThreadMessagesByLearnerId,
  fetchCurrentLearnerMessages,
  sendMessage,
  updateMessage,
  deleteMessage,
  markThreadReadByLearnerId,
};

window.SIMPCourseMessaging = api;
