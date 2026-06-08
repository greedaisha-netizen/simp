import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
} from "../supabase.js";

const CLOUD_STATE_TABLE = "simp_course_state";
const CLOUD_STATE_READY_EVENT = "simp-course-cloud-state-ready";
const CLOUD_STATE_SYNCED_EVENT = "simp-course-cloud-state-synced";
const GLOBAL_OWNER_KEY = "global:course-module";
const PREVIEW_OWNER_KEY = "preview:course-module";
const MANAGED_KEYS = {
  myStudyRoomLibrary: { scope: "user" },
  myStudyRoomAssessments: { scope: "user" },
  simpAssessmentAttemptHistory: { scope: "user" },
  simpLearningActivityLog: { scope: "user" },
  simpStudyGoals: { scope: "user" },
  simpAdminMessages: { scope: "global" },
  myStudyRoomCertificates: { scope: "user" },
  courseEnrollmentRequests: { scope: "user" },
};

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const storageProto = Object.getPrototypeOf(window.localStorage);
const nativeSetItem = storageProto.setItem;
const nativeGetItem = storageProto.getItem;
const nativeRemoveItem = storageProto.removeItem;
const pendingWrites = new Map();

let resolvedOwnerKeys = null;
let cloudStateEnabled = true;
let cloudStateReadyPromise = null;

function dispatchStateEvent(eventName, detail = {}) {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

function readLocalValue(key) {
  return nativeGetItem.call(window.localStorage, key);
}

function writeLocalValue(key, value) {
  nativeSetItem.call(window.localStorage, key, value);
}

function removeLocalValue(key) {
  nativeRemoveItem.call(window.localStorage, key);
}

function isManagedKey(key) {
  return Object.prototype.hasOwnProperty.call(MANAGED_KEYS, key);
}

function getScopeForKey(key) {
  return MANAGED_KEYS[key]?.scope || "user";
}

async function resolveOwnerKeys() {
  if (resolvedOwnerKeys) {
    return resolvedOwnerKeys;
  }

  let sessionUserId = "";

  try {
    const {
      data: { session },
    } = await client.auth.getSession();
    sessionUserId = String(session?.user?.id || "").trim();
  } catch (error) {
    console.warn("Unable to resolve the current Supabase session for cloud state.", error);
  }

  resolvedOwnerKeys = {
    user: sessionUserId ? `user:${sessionUserId}` : PREVIEW_OWNER_KEY,
    global: GLOBAL_OWNER_KEY,
  };

  return resolvedOwnerKeys;
}

async function upsertCloudValue(key, value) {
  if (!cloudStateEnabled || !isManagedKey(key)) {
    return;
  }

  const ownerKeys = await resolveOwnerKeys();
  const ownerKey = getScopeForKey(key) === "global" ? ownerKeys.global : ownerKeys.user;
  const payload = {
    owner_key: ownerKey,
    state_key: key,
    state_value: String(value),
    updated_at: new Date().toISOString(),
  };

  const { error } = await client
    .from(CLOUD_STATE_TABLE)
    .upsert(payload, { onConflict: "owner_key,state_key" });

  if (error) {
    throw error;
  }
}

async function deleteCloudValue(key) {
  if (!cloudStateEnabled || !isManagedKey(key)) {
    return;
  }

  const ownerKeys = await resolveOwnerKeys();
  const ownerKey = getScopeForKey(key) === "global" ? ownerKeys.global : ownerKeys.user;
  const { error } = await client
    .from(CLOUD_STATE_TABLE)
    .delete()
    .match({ owner_key: ownerKey, state_key: key });

  if (error) {
    throw error;
  }
}

function queueWrite(key, value) {
  if (!cloudStateEnabled || !isManagedKey(key)) {
    return;
  }

  if (pendingWrites.has(key)) {
    clearTimeout(pendingWrites.get(key));
  }

  const timerId = window.setTimeout(async () => {
    pendingWrites.delete(key);
    try {
      await upsertCloudValue(key, value);
      dispatchStateEvent(CLOUD_STATE_SYNCED_EVENT, { key, action: "upsert" });
    } catch (error) {
      console.warn(`Unable to persist ${key} to Supabase cloud state.`, error);
    }
  }, 250);

  pendingWrites.set(key, timerId);
}

function queueDelete(key) {
  if (!cloudStateEnabled || !isManagedKey(key)) {
    return;
  }

  if (pendingWrites.has(key)) {
    clearTimeout(pendingWrites.get(key));
    pendingWrites.delete(key);
  }

  window.setTimeout(async () => {
    try {
      await deleteCloudValue(key);
      dispatchStateEvent(CLOUD_STATE_SYNCED_EVENT, { key, action: "delete" });
    } catch (error) {
      console.warn(`Unable to remove ${key} from Supabase cloud state.`, error);
    }
  }, 0);
}

async function hydrateManagedKeysFromCloud() {
  const ownerKeys = await resolveOwnerKeys();
  const ownerKeyValues = Array.from(new Set([ownerKeys.user, ownerKeys.global]));
  const managedKeyList = Object.keys(MANAGED_KEYS);

  const { data, error } = await client
    .from(CLOUD_STATE_TABLE)
    .select("owner_key,state_key,state_value")
    .in("owner_key", ownerKeyValues)
    .in("state_key", managedKeyList);

  if (error) {
    throw error;
  }

  const remoteState = new Map();
  (data || []).forEach((row) => {
    const stateKey = String(row.state_key || "");
    if (!stateKey) {
      return;
    }

    const scope = getScopeForKey(stateKey);
    const expectedOwnerKey = scope === "global" ? ownerKeys.global : ownerKeys.user;
    if (String(row.owner_key || "") === expectedOwnerKey) {
      remoteState.set(stateKey, String(row.state_value || ""));
    }
  });

  const migrationWrites = [];

  managedKeyList.forEach((key) => {
    if (remoteState.has(key)) {
      writeLocalValue(key, remoteState.get(key));
      return;
    }

    const localValue = readLocalValue(key);
    if (localValue !== null) {
      migrationWrites.push(upsertCloudValue(key, localValue));
    }
  });

  if (migrationWrites.length) {
    await Promise.allSettled(migrationWrites);
  }
}

function installStoragePatch() {
  if (storageProto.__simpCourseCloudStatePatched) {
    return;
  }

  Object.defineProperty(storageProto, "__simpCourseCloudStatePatched", {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  storageProto.setItem = function patchedSetItem(key, value) {
    nativeSetItem.call(this, key, value);

    if (this === window.localStorage && isManagedKey(key)) {
      window.__simpCourseCloudStateInstance?.queueWrite?.(String(key), String(value));
    }
  };

  storageProto.removeItem = function patchedRemoveItem(key) {
    nativeRemoveItem.call(this, key);

    if (this === window.localStorage && isManagedKey(key)) {
      window.__simpCourseCloudStateInstance?.queueDelete?.(String(key));
    }
  };
}

async function ensureCloudStateReady() {
  if (!cloudStateReadyPromise) {
    cloudStateReadyPromise = (async () => {
      try {
        await hydrateManagedKeysFromCloud();
      } catch (error) {
        cloudStateEnabled = false;
        console.warn(
          "Supabase cloud state is unavailable. Falling back to browser-only storage until the table is created.",
          error
        );
      } finally {
        dispatchStateEvent(CLOUD_STATE_READY_EVENT, { enabled: cloudStateEnabled });
      }
    })();
  }

  return cloudStateReadyPromise;
}

installStoragePatch();

const api = {
  CLOUD_STATE_READY_EVENT,
  CLOUD_STATE_SYNCED_EVENT,
  isManagedKey,
  queueWrite,
  queueDelete,
  ready: ensureCloudStateReady,
  async refresh() {
    cloudStateReadyPromise = null;
    return ensureCloudStateReady();
  },
  get enabled() {
    return cloudStateEnabled;
  },
};

window.__simpCourseCloudStateInstance = api;
window.SIMPCourseCloudState = api;
