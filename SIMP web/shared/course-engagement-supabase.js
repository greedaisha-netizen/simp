import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
} from "../SIMP-PROJECT-main/supabase.js";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const COURSE_SCHEMA_CANDIDATES = ["course", "courses"];
const READY_EVENT = "simp-course-engagement-ready";
const UPDATED_EVENT = "simp-course-engagement-updated";

const TABLES = {
  review: "course_review",
  submission: "course_assessment_submission",
  forumPost: "course_forum_post",
  forumReply: "course_forum_reply",
  forumPostLike: "course_forum_post_like",
  forumReplyLike: "course_forum_reply_like",
  lessonProgress: "course_lesson_progress",
  scheduleSession: "course_schedule_session",
};

const CACHE_KEYS = {
  reviews: "simpCourseReviews",
  forumPosts: "simpGlobalForumPosts",
  lessonProgress: "simpLessonProgress",
  scheduleSessions: "myStudyRoomSchedule",
  assessmentSubmissions: "simpAssessmentSubmissions",
};

const storageProto = Object.getPrototypeOf(window.localStorage);
const nativeSetItem = storageProto.setItem;

let activeCourseSchemaPromise = null;
let currentActorPromise = null;
let readyPromise = null;

function dispatchEvent(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
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

function randomId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getSchemaTable(schemaName, tableName) {
  if (typeof client.schema === "function") {
    return client.schema(schemaName).from(tableName);
  }

  return client.from(`${schemaName}.${tableName}`);
}

async function getActiveCourseSchema() {
  if (!activeCourseSchemaPromise) {
    activeCourseSchemaPromise = (async () => {
      for (const schemaName of COURSE_SCHEMA_CANDIDATES) {
        const { error } = await getSchemaTable(schemaName, TABLES.review)
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

async function resolveCurrentActor() {
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

    const [adminResult, installerResult] = await Promise.allSettled([
      client.from("admin").select("id,email,name").eq("id", user.id).maybeSingle(),
      client
        .from("installer")
        .select("id,email,name")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    const adminRow =
      adminResult.status === "fulfilled" ? adminResult.value.data : null;
    const installerRow =
      installerResult.status === "fulfilled" ? installerResult.value.data : null;

    if (adminRow?.id) {
      return {
        id: adminRow.id,
        role: "admin",
        name: adminRow.name || user.user_metadata?.name || "SIMP Admin",
        email: adminRow.email || user.email || "",
      };
    }

    if (installerRow?.id) {
      return {
        id: installerRow.id,
        role: "learner",
        name: installerRow.name || user.user_metadata?.name || user.email || "Learner",
        email: installerRow.email || user.email || "",
      };
    }

    return {
      id: user.id,
      role: "learner",
      name: user.user_metadata?.name || user.email || "Learner",
      email: user.email || "",
    };
  })();

  return currentActorPromise;
}

function writeLocalCache(key, value) {
  nativeSetItem.call(window.localStorage, key, JSON.stringify(value));
}

function readLocalCache(key) {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function mapReviewRow(row) {
  return {
    id: String(row?.id || ""),
    authorId: String(row?.author_id || ""),
    authorName: String(row?.author_name || "Learner"),
    courseId: String(row?.course_id || ""),
    levelId: String(row?.level_id || ""),
    lessonId: String(row?.lesson_id || ""),
    courseTitle: String(row?.course_title || ""),
    levelTitle: String(row?.level_title || ""),
    lessonTitle: String(row?.lesson_title || ""),
    rating: Number(row?.rating || 0),
    body: String(row?.body || ""),
    createdAt: normalizeTimestamp(row?.created_at),
    updatedAt: normalizeTimestamp(row?.updated_at),
  };
}

function mapSubmissionRow(row) {
  return {
    id: String(row?.id || ""),
    resultId: String(row?.result_id || ""),
    authorId: String(row?.author_id || ""),
    authorName: String(row?.author_name || "Learner"),
    libraryId: String(row?.library_id || ""),
    courseId: String(row?.course_id || ""),
    levelId: String(row?.level_id || ""),
    lessonId: String(row?.lesson_id || ""),
    assessmentId: String(row?.assessment_id || ""),
    assessmentVersion: String(row?.assessment_version || "v1"),
    courseTitle: String(row?.course_title || ""),
    levelTitle: String(row?.level_title || ""),
    lessonTitle: String(row?.lesson_title || ""),
    status: String(row?.status || "pending"),
    objectiveCorrect: Number(row?.objective_correct || 0),
    objectiveTotal: Number(row?.objective_total || 0),
    scoreTotal: Number(row?.score_total || 0),
    passingScore: Number(row?.passing_score || 0),
    scoreEarned:
      row?.score_earned === null || row?.score_earned === undefined
        ? null
        : Number(row.score_earned),
    pendingEssayCount: Number(row?.pending_essay_count || 0),
    submittedAt: normalizeTimestamp(row?.submitted_at),
    gradedAt: normalizeTimestamp(row?.graded_at),
    gradedBy: String(row?.graded_by || ""),
    essayResponses: Array.isArray(row?.essay_responses) ? row.essay_responses : [],
    reviewNotes: String(row?.review_notes || ""),
  };
}

function mapProgressRow(row) {
  return {
    courseId: String(row?.course_id || ""),
    levelId: String(row?.level_id || ""),
    lessonId: String(row?.lesson_id || ""),
    courseTitle: String(row?.course_title || ""),
    levelTitle: String(row?.level_title || ""),
    lessonTitle: String(row?.lesson_title || ""),
    totalSlides: Number(row?.total_slides || 0),
    currentSlideIndex: Number(row?.current_slide_index || 0),
    maxSlideReached: Number(row?.max_slide_reached || 0),
    viewedSlides: Array.isArray(row?.viewed_slides) ? row.viewed_slides : [],
    progressPercent: Number(row?.progress_percent || 0),
    startedAt: normalizeTimestamp(row?.started_at),
    lastVisitedAt: normalizeTimestamp(row?.last_visited_at),
    completedAt: normalizeTimestamp(row?.completed_at),
    timeSpentMs: Number(row?.time_spent_ms || 0),
    sessionCount: Number(row?.session_count || 0),
  };
}

function mapScheduleRow(row) {
  return {
    id: String(row?.id || ""),
    date: String(row?.date || ""),
    startTime: String(row?.start_time || "09:00"),
    endTime: String(row?.end_time || "10:00"),
    durationMinutes: Number(row?.duration_minutes || 60),
    courseId: String(row?.course_id || ""),
    levelId: String(row?.level_id || ""),
    lessonId: String(row?.lesson_id || ""),
    courseTitle: String(row?.course_title || ""),
    levelTitle: String(row?.level_title || ""),
    lessonTitle: String(row?.lesson_title || ""),
    notes: String(row?.notes || ""),
    createdAt: normalizeTimestamp(row?.created_at),
    updatedAt: normalizeTimestamp(row?.updated_at),
  };
}

function canSeedGlobalRecord(actor, record) {
  if (!actor?.id) {
    return false;
  }

  if (actor.role === "admin") {
    return true;
  }

  return String(record?.authorId || "") === actor.id;
}

async function seedReviewsFromLocal(rows) {
  const actor = await resolveCurrentActor();
  const reviewTable = await fromCourse(TABLES.review);
  const payload = rows
    .filter((row) => canSeedGlobalRecord(actor, row))
    .map((row) => ({
      id: String(row.id || randomId("review")),
      author_id: String(row.authorId || actor?.id || ""),
      author_name: String(row.authorName || actor?.name || "Learner"),
      course_id: String(row.courseId || ""),
      level_id: String(row.levelId || ""),
      lesson_id: String(row.lessonId || ""),
      course_title: String(row.courseTitle || ""),
      level_title: String(row.levelTitle || ""),
      lesson_title: String(row.lessonTitle || ""),
      rating: Math.max(1, Math.min(5, Number(row.rating || 0))),
      body: String(row.body || ""),
      created_at: row.createdAt ? toIsoString(row.createdAt) : toIsoString(),
      updated_at: row.updatedAt ? toIsoString(row.updatedAt) : toIsoString(),
    }));

  if (!payload.length) {
    return;
  }

  const { error } = await reviewTable.upsert(payload, { onConflict: "id" });
  if (error) {
    throw error;
  }
}

async function seedAssessmentSubmissionsFromLocal(rows) {
  const actor = await resolveCurrentActor();
  const submissionTable = await fromCourse(TABLES.submission);
  const payload = rows
    .filter((row) => canSeedGlobalRecord(actor, row))
    .map((row) => ({
      id: String(row.id || randomId("assessment-submission")),
      result_id: String(row.resultId || ""),
      author_id: String(row.authorId || actor?.id || ""),
      author_name: String(row.authorName || actor?.name || "Learner"),
      library_id: String(row.libraryId || ""),
      course_id: String(row.courseId || ""),
      level_id: String(row.levelId || ""),
      lesson_id: String(row.lessonId || ""),
      assessment_id: String(row.assessmentId || ""),
      assessment_version: String(row.assessmentVersion || "v1"),
      course_title: String(row.courseTitle || ""),
      level_title: String(row.levelTitle || ""),
      lesson_title: String(row.lessonTitle || ""),
      status: String(row.status || "pending"),
      objective_correct: Number(row.objectiveCorrect || 0),
      objective_total: Number(row.objectiveTotal || 0),
      score_total: Number(row.scoreTotal || 0),
      passing_score: Number(row.passingScore || 0),
      score_earned:
        row.scoreEarned === null || row.scoreEarned === undefined
          ? null
          : Number(row.scoreEarned),
      pending_essay_count: Number(row.pendingEssayCount || 0),
      submitted_at: row.submittedAt ? toIsoString(row.submittedAt) : toIsoString(),
      graded_at: row.gradedAt ? toIsoString(row.gradedAt) : null,
      graded_by: String(row.gradedBy || ""),
      essay_responses: Array.isArray(row.essayResponses) ? row.essayResponses : [],
      review_notes: String(row.reviewNotes || ""),
    }));

  if (!payload.length) {
    return;
  }

  const { error } = await submissionTable.upsert(payload, { onConflict: "id" });
  if (error) {
    throw error;
  }
}

async function seedForumFromLocal(posts) {
  const actor = await resolveCurrentActor();
  const forumPostTable = await fromCourse(TABLES.forumPost);
  const forumReplyTable = await fromCourse(TABLES.forumReply);
  const postLikeTable = await fromCourse(TABLES.forumPostLike);
  const replyLikeTable = await fromCourse(TABLES.forumReplyLike);

  const postRows = [];
  const replyRows = [];
  const postLikes = [];
  const replyLikes = [];
  const includedReplyIds = new Set();

  const walkReplies = (postId, replies = [], parentReplyId = "") => {
    replies.forEach((reply) => {
      const canSeedReply = actor?.role === "admin" || String(reply?.authorId || "") === actor?.id;
      const nextReplyId = String(reply?.id || randomId("reply"));
      if (canSeedReply) {
        includedReplyIds.add(nextReplyId);
        replyRows.push({
          id: nextReplyId,
          post_id: postId,
          parent_reply_id: parentReplyId && includedReplyIds.has(parentReplyId) ? parentReplyId : null,
          author_id: String(reply?.authorId || actor?.id || ""),
          author_name: String(reply?.authorName || actor?.name || "Learner"),
          body: String(reply?.message || ""),
          created_at: reply?.createdAt ? toIsoString(reply.createdAt) : toIsoString(),
          updated_at: reply?.updatedAt ? toIsoString(reply.updatedAt) : toIsoString(),
        });

        if (actor?.role === "learner" && reply?.likedByLearner) {
          replyLikes.push({ reply_id: nextReplyId, actor_id: actor.id, created_at: toIsoString() });
        }
        if (actor?.role === "admin" && reply?.likedByAdmin) {
          replyLikes.push({ reply_id: nextReplyId, actor_id: actor.id, created_at: toIsoString() });
        }
      }

      walkReplies(postId, reply?.replies || [], canSeedReply ? nextReplyId : "");
    });
  };

  posts.forEach((post) => {
    const canSeedPost = canSeedGlobalRecord(actor, post);
    const postId = String(post?.id || randomId("forum"));
    if (canSeedPost) {
      postRows.push({
        id: postId,
        author_id: String(post?.authorId || actor?.id || ""),
        author_name: String(post?.authorName || actor?.name || "Learner"),
        type: String(post?.type || "discussion"),
        course_id: String(post?.courseId || "all"),
        course_title: String(post?.courseTitle || ""),
        title: String(post?.title || ""),
        body: String(post?.body || ""),
        status: String(post?.status || (actor?.role === "admin" ? "approved" : "pending")),
        created_at: post?.createdAt ? toIsoString(post.createdAt) : toIsoString(),
        updated_at: post?.updatedAt ? toIsoString(post.updatedAt) : toIsoString(),
        submitted_at: post?.submittedAt ? toIsoString(post.submittedAt) : toIsoString(),
        reviewed_at: post?.reviewedAt ? toIsoString(post.reviewedAt) : null,
        reviewed_by: String(post?.reviewedBy || ""),
      });

      if (actor?.role === "learner" && post?.likedByLearner) {
        postLikes.push({ post_id: postId, actor_id: actor.id, created_at: toIsoString() });
      }
      if (actor?.role === "admin" && post?.likedByAdmin) {
        postLikes.push({ post_id: postId, actor_id: actor.id, created_at: toIsoString() });
      }

      walkReplies(postId, post?.replies || []);
    }
  });

  if (postRows.length) {
    const { error } = await forumPostTable.upsert(postRows, { onConflict: "id" });
    if (error) {
      throw error;
    }
  }

  if (replyRows.length) {
    const { error } = await forumReplyTable.upsert(replyRows, { onConflict: "id" });
    if (error) {
      throw error;
    }
  }

  if (postLikes.length) {
    const { error } = await postLikeTable.upsert(postLikes, {
      onConflict: "post_id,actor_id",
      ignoreDuplicates: true,
    });
    if (error) {
      throw error;
    }
  }

  if (replyLikes.length) {
    const { error } = await replyLikeTable.upsert(replyLikes, {
      onConflict: "reply_id,actor_id",
      ignoreDuplicates: true,
    });
    if (error) {
      throw error;
    }
  }
}

function makeForumReplyTree(flatReplies, actor, replyLikesByReplyId) {
  const replyMap = new Map();
  const rootReplies = [];

  flatReplies.forEach((reply) => {
    const likeSet = replyLikesByReplyId.get(reply.id) || new Set();
    replyMap.set(reply.id, {
      id: String(reply.id || ""),
      postId: String(reply.post_id || ""),
      parentReplyId: String(reply.parent_reply_id || ""),
      authorId: String(reply.author_id || ""),
      authorName: String(reply.author_name || "Learner"),
      message: String(reply.body || ""),
      createdAt: normalizeTimestamp(reply.created_at),
      updatedAt: normalizeTimestamp(reply.updated_at),
      likes: likeSet.size,
      likedByLearner:
        actor?.role === "learner" ? likeSet.has(actor.id) : false,
      likedByAdmin: actor?.role === "admin" ? likeSet.has(actor.id) : false,
      replies: [],
    });
  });

  flatReplies.forEach((reply) => {
    const mapped = replyMap.get(reply.id);
    if (!mapped) {
      return;
    }

    const parentId = String(reply.parent_reply_id || "");
    if (parentId && replyMap.has(parentId)) {
      replyMap.get(parentId).replies.push(mapped);
      return;
    }

    rootReplies.push(mapped);
  });

  const sortReplies = (replies) => {
    replies.sort((left, right) => Number(left.createdAt || 0) - Number(right.createdAt || 0));
    replies.forEach((reply) => sortReplies(reply.replies));
  };

  sortReplies(rootReplies);
  return rootReplies;
}

async function fetchReviewRows() {
  const reviewTable = await fromCourse(TABLES.review);
  const { data, error } = await reviewTable
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => mapReviewRow(row));
}

async function refreshReviewsCache(options = {}) {
  let rows = await fetchReviewRows();
  if (!rows.length && options.seedFromLocal) {
    const localRows = readLocalCache(CACHE_KEYS.reviews);
    if (localRows.length) {
      await seedReviewsFromLocal(localRows);
      rows = await fetchReviewRows();
    }
  }
  writeLocalCache(CACHE_KEYS.reviews, rows);
  dispatchEvent(UPDATED_EVENT, { type: "reviews" });
  return rows;
}

async function fetchAssessmentSubmissionRows() {
  const submissionTable = await fromCourse(TABLES.submission);
  const { data, error } = await submissionTable
    .select("*")
    .order("submitted_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => mapSubmissionRow(row));
}

async function refreshAssessmentSubmissionsCache(options = {}) {
  let rows = await fetchAssessmentSubmissionRows();
  if (!rows.length && options.seedFromLocal) {
    const localRows = readLocalCache(CACHE_KEYS.assessmentSubmissions);
    if (localRows.length) {
      await seedAssessmentSubmissionsFromLocal(localRows);
      rows = await fetchAssessmentSubmissionRows();
    }
  }
  writeLocalCache(CACHE_KEYS.assessmentSubmissions, rows);
  dispatchEvent(UPDATED_EVENT, { type: "assessment-submissions" });
  return rows;
}

async function fetchLessonProgressRows() {
  const progressTable = await fromCourse(TABLES.lessonProgress);
  const { data, error } = await progressTable
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => mapProgressRow(row));
}

async function refreshLessonProgressCache(options = {}) {
  let rows = await fetchLessonProgressRows();
  if (!rows.length && options.seedFromLocal) {
    const localRows = readLocalCache(CACHE_KEYS.lessonProgress);
    if (localRows.length) {
      await replaceLessonProgressEntries(localRows);
      rows = await fetchLessonProgressRows();
    }
  }
  writeLocalCache(CACHE_KEYS.lessonProgress, rows);
  dispatchEvent(UPDATED_EVENT, { type: "lesson-progress" });
  return rows;
}

async function fetchScheduleRows() {
  const scheduleTable = await fromCourse(TABLES.scheduleSession);
  const { data, error } = await scheduleTable
    .select("*")
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => mapScheduleRow(row));
}

async function refreshScheduleCache(options = {}) {
  let rows = await fetchScheduleRows();
  if (!rows.length && options.seedFromLocal) {
    const localRows = readLocalCache(CACHE_KEYS.scheduleSessions);
    if (localRows.length) {
      await replaceScheduleSessions(localRows);
      rows = await fetchScheduleRows();
    }
  }
  writeLocalCache(CACHE_KEYS.scheduleSessions, rows);
  dispatchEvent(UPDATED_EVENT, { type: "schedule-sessions" });
  return rows;
}

async function fetchForumPosts() {
  const actor = await resolveCurrentActor();
  const postTable = await fromCourse(TABLES.forumPost);
  const replyTable = await fromCourse(TABLES.forumReply);
  const postLikeTable = await fromCourse(TABLES.forumPostLike);
  const replyLikeTable = await fromCourse(TABLES.forumReplyLike);

  const { data: posts, error: postError } = await postTable
    .select("*")
    .order("submitted_at", { ascending: false });

  if (postError) {
    throw postError;
  }

  if (!posts?.length) {
    return [];
  }

  const postIds = posts.map((post) => post.id);
  const { data: replies, error: replyError } = await replyTable
    .select("*")
    .in("post_id", postIds)
    .order("created_at", { ascending: true });

  if (replyError) {
    throw replyError;
  }

  const { data: postLikes, error: postLikesError } = await postLikeTable
    .select("post_id,actor_id")
    .in("post_id", postIds);

  if (postLikesError) {
    throw postLikesError;
  }

  const replyIds = (replies || []).map((reply) => reply.id);
  let replyLikes = [];
  if (replyIds.length) {
    const replyLikesResult = await replyLikeTable
      .select("reply_id,actor_id")
      .in("reply_id", replyIds);

    if (replyLikesResult.error) {
      throw replyLikesResult.error;
    }

    replyLikes = replyLikesResult.data || [];
  }

  const postLikesByPostId = new Map();
  (postLikes || []).forEach((item) => {
    const set = postLikesByPostId.get(item.post_id) || new Set();
    set.add(String(item.actor_id || ""));
    postLikesByPostId.set(item.post_id, set);
  });

  const replyLikesByReplyId = new Map();
  replyLikes.forEach((item) => {
    const set = replyLikesByReplyId.get(item.reply_id) || new Set();
    set.add(String(item.actor_id || ""));
    replyLikesByReplyId.set(item.reply_id, set);
  });

  const repliesByPostId = new Map();
  (replies || []).forEach((reply) => {
    const list = repliesByPostId.get(reply.post_id) || [];
    list.push(reply);
    repliesByPostId.set(reply.post_id, list);
  });

  return posts.map((post) => {
    const likeSet = postLikesByPostId.get(post.id) || new Set();
    return {
      id: String(post.id || ""),
      authorId: String(post.author_id || ""),
      authorName: String(post.author_name || "Learner"),
      type: String(post.type || "discussion"),
      courseId: String(post.course_id || "all"),
      courseTitle: String(post.course_title || ""),
      title: String(post.title || ""),
      body: String(post.body || ""),
      status: String(post.status || "pending"),
      createdAt: normalizeTimestamp(post.created_at),
      updatedAt: normalizeTimestamp(post.updated_at),
      submittedAt: normalizeTimestamp(post.submitted_at),
      reviewedAt: normalizeTimestamp(post.reviewed_at),
      reviewedBy: String(post.reviewed_by || ""),
      likes: likeSet.size,
      likedByLearner:
        actor?.role === "learner" ? likeSet.has(actor.id) : false,
      likedByAdmin: actor?.role === "admin" ? likeSet.has(actor.id) : false,
      replies: makeForumReplyTree(
        repliesByPostId.get(post.id) || [],
        actor,
        replyLikesByReplyId
      ),
    };
  });
}

async function refreshForumPostsCache(options = {}) {
  let rows = await fetchForumPosts();
  if (!rows.length && options.seedFromLocal) {
    const localRows = readLocalCache(CACHE_KEYS.forumPosts);
    if (localRows.length) {
      await seedForumFromLocal(localRows);
      rows = await fetchForumPosts();
    }
  }
  writeLocalCache(CACHE_KEYS.forumPosts, rows);
  dispatchEvent(UPDATED_EVENT, { type: "forum-posts" });
  return rows;
}

function buildProgressRowId(entry) {
  return [
    "progress",
    entry.courseId || "course",
    entry.levelId || "level",
    entry.lessonId || "lesson",
  ].join("::");
}

function progressEntryToRow(entry, actorId) {
  return {
    id: buildProgressRowId(entry),
    learner_id: actorId,
    course_id: String(entry.courseId || ""),
    level_id: String(entry.levelId || ""),
    lesson_id: String(entry.lessonId || ""),
    course_title: String(entry.courseTitle || ""),
    level_title: String(entry.levelTitle || ""),
    lesson_title: String(entry.lessonTitle || ""),
    total_slides: Number(entry.totalSlides || 0),
    current_slide_index: Number(entry.currentSlideIndex || 0),
    max_slide_reached: Number(entry.maxSlideReached || 0),
    viewed_slides: Array.isArray(entry.viewedSlides) ? entry.viewedSlides : [],
    progress_percent: Number(entry.progressPercent || 0),
    started_at: entry.startedAt ? toIsoString(entry.startedAt) : null,
    last_visited_at: entry.lastVisitedAt ? toIsoString(entry.lastVisitedAt) : null,
    completed_at: entry.completedAt ? toIsoString(entry.completedAt) : null,
    time_spent_ms: Number(entry.timeSpentMs || 0),
    session_count: Number(entry.sessionCount || 0),
    updated_at: toIsoString(),
  };
}

function scheduleEntryToRow(entry, actorId) {
  return {
    id: String(entry.id || randomId("schedule")),
    learner_id: actorId,
    date: String(entry.date || ""),
    start_time: String(entry.startTime || "09:00"),
    end_time: String(entry.endTime || "10:00"),
    duration_minutes: Number(entry.durationMinutes || 60),
    course_id: String(entry.courseId || ""),
    level_id: String(entry.levelId || ""),
    lesson_id: String(entry.lessonId || ""),
    course_title: String(entry.courseTitle || ""),
    level_title: String(entry.levelTitle || ""),
    lesson_title: String(entry.lessonTitle || ""),
    notes: String(entry.notes || ""),
    updated_at: toIsoString(),
  };
}

async function replaceLessonProgressEntries(entries) {
  const actor = await resolveCurrentActor();
  if (!actor?.id) {
    throw new Error("You must be signed in to save lesson progress.");
  }

  const progressTable = await fromCourse(TABLES.lessonProgress);
  const rows = (Array.isArray(entries) ? entries : []).map((entry) =>
    progressEntryToRow(entry, actor.id)
  );
  const rowIds = rows.map((row) => row.id);

  if (rows.length) {
    const { error } = await progressTable.upsert(rows, { onConflict: "id" });
    if (error) {
      throw error;
    }
  }

  let deleteQuery = progressTable.delete().eq("learner_id", actor.id);
  if (rowIds.length) {
    deleteQuery = deleteQuery.not("id", "in", `(${rowIds.map((id) => `"${id}"`).join(",")})`);
  }

  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    throw deleteError;
  }

  writeLocalCache(CACHE_KEYS.lessonProgress, entries || []);
  dispatchEvent(UPDATED_EVENT, { type: "lesson-progress" });
  return entries || [];
}

async function replaceScheduleSessions(entries) {
  const actor = await resolveCurrentActor();
  if (!actor?.id) {
    throw new Error("You must be signed in to save schedule sessions.");
  }

  const scheduleTable = await fromCourse(TABLES.scheduleSession);
  const rows = (Array.isArray(entries) ? entries : []).map((entry) =>
    scheduleEntryToRow(entry, actor.id)
  );
  const rowIds = rows.map((row) => row.id);

  if (rows.length) {
    const { error } = await scheduleTable.upsert(rows, { onConflict: "id" });
    if (error) {
      throw error;
    }
  }

  let deleteQuery = scheduleTable.delete().eq("learner_id", actor.id);
  if (rowIds.length) {
    deleteQuery = deleteQuery.not("id", "in", `(${rowIds.map((id) => `"${id}"`).join(",")})`);
  }

  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    throw deleteError;
  }

  const nextEntries = rows.map((row) => mapScheduleRow(row));
  writeLocalCache(CACHE_KEYS.scheduleSessions, nextEntries);
  dispatchEvent(UPDATED_EVENT, { type: "schedule-sessions" });
  return nextEntries;
}

async function submitReview(input) {
  const actor = await resolveCurrentActor();
  if (!actor?.id) {
    throw new Error("You must be signed in to submit a review.");
  }

  const reviewTable = await fromCourse(TABLES.review);
  const reviewId =
    input.id ||
    `review-${input.courseId || "course"}-${input.levelId || "level"}-${
      input.lessonId || "lesson"
    }-${actor.id}`;
  const payload = {
    id: reviewId,
    author_id: actor.id,
    author_name: actor.name || input.authorName || "Learner",
    course_id: String(input.courseId || ""),
    level_id: String(input.levelId || ""),
    lesson_id: String(input.lessonId || ""),
    course_title: String(input.courseTitle || ""),
    level_title: String(input.levelTitle || ""),
    lesson_title: String(input.lessonTitle || ""),
    rating: Math.max(1, Math.min(5, Number(input.rating || 0))),
    body: String(input.body || ""),
    created_at: input.createdAt ? toIsoString(input.createdAt) : toIsoString(),
    updated_at: toIsoString(),
  };

  const { data, error } = await reviewTable
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await refreshReviewsCache();
  return mapReviewRow(data);
}

async function createAssessmentSubmission(input) {
  const actor = await resolveCurrentActor();
  if (!actor?.id) {
    throw new Error("You must be signed in to submit an assessment.");
  }

  const submissionTable = await fromCourse(TABLES.submission);
  const payload = {
    id: String(input.id || randomId("assessment-submission")),
    result_id: String(input.resultId || ""),
    author_id: actor.id,
    author_name: actor.name || input.authorName || "Learner",
    library_id: String(input.libraryId || ""),
    course_id: String(input.courseId || ""),
    level_id: String(input.levelId || ""),
    lesson_id: String(input.lessonId || ""),
    assessment_id: String(input.assessmentId || ""),
    assessment_version: String(input.assessmentVersion || "v1"),
    course_title: String(input.courseTitle || ""),
    level_title: String(input.levelTitle || ""),
    lesson_title: String(input.lessonTitle || ""),
    status: String(input.status || "pending"),
    objective_correct: Number(input.objectiveCorrect || 0),
    objective_total: Number(input.objectiveTotal || 0),
    score_total: Number(input.scoreTotal || 0),
    passing_score: Number(input.passingScore || 0),
    score_earned:
      input.scoreEarned === null || input.scoreEarned === undefined
        ? null
        : Number(input.scoreEarned),
    pending_essay_count: Number(input.pendingEssayCount || 0),
    submitted_at: input.submittedAt ? toIsoString(input.submittedAt) : toIsoString(),
    graded_at: input.gradedAt ? toIsoString(input.gradedAt) : null,
    graded_by: String(input.gradedBy || ""),
    essay_responses: Array.isArray(input.essayResponses) ? input.essayResponses : [],
    review_notes: String(input.reviewNotes || ""),
  };

  const { data, error } = await submissionTable
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await refreshAssessmentSubmissionsCache();
  return mapSubmissionRow(data);
}

async function gradeAssessmentSubmission(submissionId, updates = {}) {
  const submissionTable = await fromCourse(TABLES.submission);
  const payload = {
    status: String(updates.status || "graded"),
    score_earned:
      updates.scoreEarned === null || updates.scoreEarned === undefined
        ? null
        : Number(updates.scoreEarned),
    objective_correct: Number(updates.objectiveCorrect || 0),
    objective_total: Number(updates.objectiveTotal || 0),
    score_total: Number(updates.scoreTotal || 0),
    passing_score: Number(updates.passingScore || 0),
    pending_essay_count: Number(updates.pendingEssayCount || 0),
    graded_at: updates.gradedAt ? toIsoString(updates.gradedAt) : toIsoString(),
    graded_by: String(updates.gradedBy || "SIMP Admin"),
    review_notes: String(updates.reviewNotes || ""),
  };

  const { data, error } = await submissionTable
    .update(payload)
    .eq("id", submissionId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await refreshAssessmentSubmissionsCache();
  return mapSubmissionRow(data);
}

async function createForumPost(input) {
  const actor = await resolveCurrentActor();
  if (!actor?.id) {
    throw new Error("You must be signed in to post in the forum.");
  }

  const forumPostTable = await fromCourse(TABLES.forumPost);
  const nowIso = toIsoString();
  const status = actor.role === "admin" ? "approved" : "pending";
  const payload = {
    id: String(input.id || randomId(actor.role === "admin" ? "admin-forum" : "forum")),
    author_id: actor.id,
    author_name: actor.role === "admin" ? "SIMP Admin" : actor.name || "Learner",
    type: String(input.type || "discussion"),
    course_id: String(input.courseId || "all"),
    course_title: String(input.courseTitle || ""),
    title: String(input.title || ""),
    body: String(input.body || ""),
    status,
    created_at: input.createdAt ? toIsoString(input.createdAt) : nowIso,
    updated_at: nowIso,
    submitted_at: input.submittedAt ? toIsoString(input.submittedAt) : nowIso,
    reviewed_at: status === "approved" ? nowIso : null,
    reviewed_by: status === "approved" ? "SIMP Admin" : "",
  };

  const { data, error } = await forumPostTable
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await refreshForumPostsCache();
  return data;
}

async function updateForumPost(postId, updates = {}) {
  const forumPostTable = await fromCourse(TABLES.forumPost);
  const payload = {
    updated_at: toIsoString(),
  };

  if (updates.title !== undefined) {
    payload.title = String(updates.title || "");
  }

  if (updates.body !== undefined) {
    payload.body = String(updates.body || "");
  }

  if (updates.status) {
    payload.status = String(updates.status);
  }

  if (updates.reviewedAt !== undefined) {
    payload.reviewed_at = updates.reviewedAt ? toIsoString(updates.reviewedAt) : null;
  }

  if (updates.reviewedBy !== undefined) {
    payload.reviewed_by = String(updates.reviewedBy || "");
  }

  const { data, error } = await forumPostTable
    .update(payload)
    .eq("id", postId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await refreshForumPostsCache();
  return data;
}

async function deleteForumPost(postId) {
  const forumPostTable = await fromCourse(TABLES.forumPost);
  const { error } = await forumPostTable.delete().eq("id", postId);

  if (error) {
    throw error;
  }

  await refreshForumPostsCache();
}

async function createForumReply({ postId, parentReplyId = "", body }) {
  const actor = await resolveCurrentActor();
  if (!actor?.id) {
    throw new Error("You must be signed in to reply.");
  }

  const forumReplyTable = await fromCourse(TABLES.forumReply);
  const payload = {
    id: randomId("reply"),
    post_id: String(postId || ""),
    parent_reply_id: parentReplyId || null,
    author_id: actor.id,
    author_name: actor.role === "admin" ? "SIMP Admin" : actor.name || "Learner",
    body: String(body || ""),
    created_at: toIsoString(),
    updated_at: toIsoString(),
  };

  const { data, error } = await forumReplyTable
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await refreshForumPostsCache();
  return data;
}

async function updateForumReply(replyId, updates = {}) {
  const forumReplyTable = await fromCourse(TABLES.forumReply);
  const { data, error } = await forumReplyTable
    .update({
      body: String(updates.body || ""),
      updated_at: toIsoString(),
    })
    .eq("id", replyId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await refreshForumPostsCache();
  return data;
}

async function deleteForumReply(replyId) {
  const forumReplyTable = await fromCourse(TABLES.forumReply);
  const { error } = await forumReplyTable.delete().eq("id", replyId);

  if (error) {
    throw error;
  }

  await refreshForumPostsCache();
}

async function toggleForumPostLike(postId) {
  const actor = await resolveCurrentActor();
  if (!actor?.id) {
    throw new Error("You must be signed in to like a post.");
  }

  const postLikeTable = await fromCourse(TABLES.forumPostLike);
  const { data: existing, error: existingError } = await postLikeTable
    .select("post_id")
    .eq("post_id", postId)
    .eq("actor_id", actor.id)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }

  if (existing) {
    const { error } = await postLikeTable
      .delete()
      .eq("post_id", postId)
      .eq("actor_id", actor.id);

    if (error) {
      throw error;
    }
  } else {
    const { error } = await postLikeTable.insert({
      post_id: postId,
      actor_id: actor.id,
      created_at: toIsoString(),
    });

    if (error) {
      throw error;
    }
  }

  await refreshForumPostsCache();
}

async function toggleForumReplyLike(replyId) {
  const actor = await resolveCurrentActor();
  if (!actor?.id) {
    throw new Error("You must be signed in to like a reply.");
  }

  const replyLikeTable = await fromCourse(TABLES.forumReplyLike);
  const { data: existing, error: existingError } = await replyLikeTable
    .select("reply_id")
    .eq("reply_id", replyId)
    .eq("actor_id", actor.id)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }

  if (existing) {
    const { error } = await replyLikeTable
      .delete()
      .eq("reply_id", replyId)
      .eq("actor_id", actor.id);

    if (error) {
      throw error;
    }
  } else {
    const { error } = await replyLikeTable.insert({
      reply_id: replyId,
      actor_id: actor.id,
      created_at: toIsoString(),
    });

    if (error) {
      throw error;
    }
  }

  await refreshForumPostsCache();
}

async function ready() {
  if (!readyPromise) {
    readyPromise = (async () => {
      await getActiveCourseSchema();
      await resolveCurrentActor();
      await Promise.allSettled([
        // Reviews should reflect Supabase-only state so old local samples do not
        // reappear in admin/learner inboxes after the migration.
        refreshReviewsCache(),
        refreshAssessmentSubmissionsCache({ seedFromLocal: true }),
        refreshForumPostsCache({ seedFromLocal: true }),
        refreshLessonProgressCache({ seedFromLocal: true }),
        refreshScheduleCache({ seedFromLocal: true }),
      ]);
      dispatchEvent(READY_EVENT, {});
    })();
  }

  return readyPromise;
}

window.SIMPCourseEngagement = {
  READY_EVENT,
  UPDATED_EVENT,
  ready,
  getCurrentActor: resolveCurrentActor,
  refreshReviewsCache,
  refreshAssessmentSubmissionsCache,
  refreshForumPostsCache,
  refreshLessonProgressCache,
  refreshScheduleCache,
  replaceLessonProgressEntries,
  replaceScheduleSessions,
  submitReview,
  createAssessmentSubmission,
  gradeAssessmentSubmission,
  createForumPost,
  updateForumPost,
  deleteForumPost,
  createForumReply,
  updateForumReply,
  deleteForumReply,
  toggleForumPostLike,
  toggleForumReplyLike,
  approveForumPost(postId) {
    return updateForumPost(postId, {
      status: "approved",
      reviewedAt: Date.now(),
      reviewedBy: "SIMP Admin",
    });
  },
  rejectForumPost: deleteForumPost,
};
