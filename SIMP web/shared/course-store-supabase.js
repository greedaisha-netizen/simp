import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
} from "../SIMP-PROJECT-main/supabase.js";

const baseStore = window.SIMPCourseStore;

if (!baseStore) {
  throw new Error("SIMPCourseStore must be loaded before course-store-supabase.js");
}

const COURSE_SCHEMA = "course";
const COURSE_TABLE = "courses";
const SECTION_TABLE = "sections";
const SECTION_CONTENT_TABLE = "section_contents";
const CLOUD_STATE_TABLE = "simp_course_state";
const CLOUD_STATE_OWNER_KEY = "global:course-module";
const COURSE_STATUS_STATE_KEY = "simpCoursePublishState";

const CURRENT_SEED_IDS = [
  "networking-support-infrastructure",
  "computer-hardware-it-support",
  "cybersecurity-operations-fundamentals",
  "linux-system-administration",
  "cloud-support-microsoft-365",
];

const mainClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const coursesClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: COURSE_SCHEMA },
});

const clone = (value) =>
  typeof baseStore.clone === "function"
    ? baseStore.clone(value)
    : JSON.parse(JSON.stringify(value));

const slugify = (value) =>
  typeof baseStore.slugify === "function"
    ? baseStore.slugify(value)
    : String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || `course-${Date.now()}`;

const generateCourseId = () =>
  typeof baseStore.generateCourseId === "function"
    ? baseStore.generateCourseId()
    : (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(16).padStart(8, "0")}-${Math.random()
            .toString(16)
            .slice(2, 6)
            .padEnd(4, "0")}-4000-a000-${Math.random()
            .toString(16)
            .slice(2, 14)
            .padEnd(12, "0")}`);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value) => UUID_PATTERN.test(String(value || "").trim());
const ensureUuid = (value) => (isUuid(value) ? String(value).trim() : generateCourseId());

const fallbackImage =
  "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=250&fit=crop";
const originalMethods = {
  getPublishedCourses: baseStore.getPublishedCourses?.bind(baseStore),
  getApprovedCourses: baseStore.getApprovedCourses?.bind(baseStore),
  getDraftCourses: baseStore.getDraftCourses?.bind(baseStore),
  savePublishedCourses: baseStore.savePublishedCourses?.bind(baseStore),
  getCourseById: baseStore.getCourseById?.bind(baseStore),
  upsertCourse: baseStore.upsertCourse?.bind(baseStore),
  deleteCourse: baseStore.deleteCourse?.bind(baseStore),
};

let courseCache = [];

async function getCurrentCourseAdminContext() {
  const {
    data: { user },
    error: userError,
  } = await mainClient.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user?.id) {
    throw new Error(
      "No authenticated Supabase user was found. Please sign out, sign back in, and try saving again."
    );
  }

  const normalizedEmail = String(user.email || "").trim().toLowerCase();
  const { data: adminById, error: adminByIdError } = await mainClient
    .from("admin")
    .select("id,email,role")
    .eq("id", user.id)
    .maybeSingle();

  if (adminByIdError) {
    throw adminByIdError;
  }

  let adminRow = adminById || null;

  if (!adminRow && normalizedEmail) {
    const { data: adminByEmail, error: adminByEmailError } = await mainClient
      .from("admin")
      .select("id,email,role")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (adminByEmailError) {
      throw adminByEmailError;
    }

    adminRow = adminByEmail || null;
  }

  return {
    user,
    adminRow,
    normalizedEmail,
  };
}

async function ensureCourseWriteAccess() {
  const { user, adminRow, normalizedEmail } = await getCurrentCourseAdminContext();

  console.info("Course save auth check:", {
    authUserId: user.id,
    authEmail: normalizedEmail,
    adminRowId: adminRow?.id || null,
    adminRowEmail: adminRow?.email || null,
    adminRole: adminRow?.role || null,
  });

  if (!adminRow) {
    throw new Error(
      `Signed-in user ${normalizedEmail || user.id} does not have a matching row in public.admin.`
    );
  }

  if (String(adminRow.id || "") !== String(user.id || "")) {
    throw new Error(
      `Admin row mismatch: auth user id ${user.id} does not match public.admin id ${adminRow.id}.`
    );
  }

  if (!["admin", "superadmin"].includes(String(adminRow.role || "").toLowerCase())) {
    throw new Error(
      `Admin role ${adminRow.role || "(empty)"} is not allowed to save courses.`
    );
  }

  return { user, adminRow };
}

async function loadCourseStatusState() {
  const { data, error } = await mainClient
    .from(CLOUD_STATE_TABLE)
    .select("state_value")
    .match({
      owner_key: CLOUD_STATE_OWNER_KEY,
      state_key: COURSE_STATUS_STATE_KEY,
    })
    .maybeSingle();

  if (error) {
    throw error;
  }

  try {
    const parsed = JSON.parse(String(data?.state_value || "{}"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

async function saveCourseStatusState(statusMap) {
  const payload = {
    owner_key: CLOUD_STATE_OWNER_KEY,
    state_key: COURSE_STATUS_STATE_KEY,
    state_value: JSON.stringify(statusMap || {}),
    updated_at: new Date().toISOString(),
  };

  const { error } = await mainClient
    .from(CLOUD_STATE_TABLE)
    .upsert(payload, { onConflict: "owner_key,state_key" });

  if (error) {
    throw error;
  }
}

function dispatchStoreUpdated() {
  if (typeof originalMethods.savePublishedCourses === "function") {
    originalMethods.savePublishedCourses(courseCache);
    return;
  }

  window.dispatchEvent(
    new CustomEvent(baseStore.STORE_UPDATED_EVENT || "simp-course-store-updated", {
      detail: { courses: clone(courseCache) },
    })
  );
}

function getCachedCourse(courseId) {
  return courseCache.find((course) => course.id === courseId) || null;
}

function normalizeQuestionType(type) {
  return ["essay", "identification", "matching"].includes(type)
    ? type
    : "multiple-choice";
}

function normalizeQuestions(questions = []) {
  return (Array.isArray(questions) ? questions : []).map((question, index) => {
    const type = normalizeQuestionType(question?.type);
    const choices = Array.isArray(question?.choices)
      ? question.choices
      : Array.isArray(question?.options)
      ? question.options
      : ["", "", "", ""];

    return {
      id: question?.id || `question-${Date.now()}-${index + 1}`,
      number: index + 1,
      type,
      prompt: question?.prompt || question?.question || "",
      choices,
      answerIndex: Number.isInteger(question?.answerIndex)
        ? question.answerIndex
        : Number.isInteger(question?.correctAnswer)
        ? question.correctAnswer
        : 0,
      rubric: question?.rubric || "",
      correctAnswer: question?.correctAnswer || "",
      pairs: Array.isArray(question?.pairs) ? question.pairs : [],
    };
  });
}

function normalizeLessonPayload(payload = {}, lessonIndex = 0, fallbackIds = {}) {
  const lessonId =
    payload.lessonId || payload.id || fallbackIds.lessonId || `lesson-${lessonIndex + 1}`;
  const slides = Array.isArray(payload.slides) ? payload.slides : [];
  const assessmentSource = payload.assessment || {};
  const assessmentQuestions = normalizeQuestions(
    assessmentSource.questions || payload.questions || []
  );
  const assessmentId =
    assessmentSource.id || `${lessonId}-assessment`;

  return {
    id: lessonId,
    title: payload.title || `Lesson ${lessonIndex + 1}`,
    subtitle: payload.subtitle || "",
    slides,
    slideCount: Number(payload.slideCount) || slides.length || 0,
    duration:
      payload.duration ||
      `${slides.length || Number(payload.slideCount) || 0} slide${
        slides.length === 1 || Number(payload.slideCount) === 1 ? "" : "s"
      }`,
    assessments: assessmentQuestions.length
      ? [
          {
            id: assessmentId,
            title:
              assessmentSource.title ||
              `${payload.title || `Lesson ${lessonIndex + 1}`} Assessment`,
            description:
              assessmentSource.description ||
              "Assessment based on the lesson content.",
            duration: assessmentSource.duration || 10,
            totalQuestions: assessmentQuestions.length,
            passingScore: Number(assessmentSource.passingScore) || 70,
            isDraft: assessmentSource.isDraft !== false,
            questions: assessmentQuestions,
          },
        ]
      : [],
    questions: assessmentQuestions,
  };
}

function parseStructuredLesson(contentRow, lessonIndex = 0) {
  const rawBody = String(contentRow?.text_body || contentRow?.body || "").trim();

  if (!rawBody) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawBody);
    if (parsed && parsed.kind === "lesson") {
      return normalizeLessonPayload(parsed, lessonIndex, {
        lessonId: contentRow.id,
      });
    }
  } catch (error) {
    // Fall through to legacy plain-text support.
  }

  return {
    id: contentRow?.id || `lesson-${lessonIndex + 1}`,
    title: `Lesson ${lessonIndex + 1}`,
    subtitle: "",
    slides: [
      {
        id: `${contentRow?.id || `lesson-${lessonIndex + 1}`}-slide-1`,
        number: 1,
        title: `Slide 1`,
        lessonText: rawBody,
        keyNotes: "",
        visualDataUrl: contentRow?.video_url || "",
        visualType: contentRow?.video_url ? "video" : "",
      },
    ],
    slideCount: 1,
    duration: "1 slide",
    assessments: [],
    questions: [],
  };
}

function parseStructuredSectionLessons(contentRow) {
  const rawBody = String(contentRow?.text_body || contentRow?.body || "").trim();

  if (!rawBody) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawBody);
    if (parsed && parsed.kind === "section-lessons" && Array.isArray(parsed.lessons)) {
      return parsed.lessons.map((lesson, lessonIndex) =>
        normalizeLessonPayload(lesson, lessonIndex)
      );
    }
  } catch (error) {
    // Fall back to per-row legacy parsing.
  }

  return null;
}

function buildCourseFromSupabaseRow(courseRow, sections, cachedCourse, statusMap = {}) {
  const levels = sections.map((section, levelIndex) => {
    const bundledLessons = (section.contents || []).length
      ? parseStructuredSectionLessons(section.contents[0])
      : null;
    const lessons = bundledLessons
      ? bundledLessons
      : (section.contents || []).map((content, lessonIndex) =>
          parseStructuredLesson(content, lessonIndex)
        );

    return {
      id: section.id,
      title: section.title || `Level ${levelIndex + 1}`,
      description: section.description || "",
      price: Number(section.price) || 0,
      lessons: lessons.filter(Boolean),
    };
  });

  const totalSlides = levels.reduce(
    (courseTotal, level) =>
      courseTotal +
      (level.lessons || []).reduce(
        (levelTotal, lesson) =>
          levelTotal + Number(lesson.slideCount || lesson.slides?.length || 0),
        0
      ),
    0
  );

  return {
    id: courseRow.id,
    slug: cachedCourse?.slug || slugify(courseRow.title),
    title: courseRow.title || cachedCourse?.title || "Untitled Course",
    creator: cachedCourse?.creator || "Admin",
    description: courseRow.description || "",
    category: courseRow.category || cachedCourse?.category || "General",
    thumbnail: cachedCourse?.thumbnail || fallbackImage,
    thumbnailOriginalRef: cachedCourse?.thumbnailOriginalRef || "",
    thumbnailCrop: cachedCourse?.thumbnailCrop || null,
    badge: cachedCourse?.badge || "New",
    rating: cachedCourse?.rating || "0.0",
    reviews: cachedCourse?.reviews || "0 reviews",
    duration: `${totalSlides} slide${totalSlides === 1 ? "" : "s"}`,
    duration_minutes:
      Number(courseRow.duration_minutes) ||
      Number(cachedCourse?.duration_minutes) ||
      Math.max(10, totalSlides),
    totalSlides,
    students: cachedCourse?.students || "0",
    status:
      statusMap?.[courseRow.id] ||
      cachedCourse?.status ||
      courseRow.status ||
      "draft",
    level: Number(courseRow.level) || levels.length || 0,
    tags: Array.isArray(courseRow.tags)
      ? courseRow.tags
      : Array.isArray(cachedCourse?.tags)
      ? cachedCourse.tags
      : [],
    created_at: courseRow.created_at || cachedCourse?.created_at || null,
    updated_at: courseRow.updated_at || cachedCourse?.updated_at || null,
    levels,
  };
}

async function fetchSupabaseCourseTree() {
  const courseStatusState = await loadCourseStatusState().catch(() => ({}));
  const { data: courseRows, error: courseError } = await coursesClient
    .from(COURSE_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (courseError) {
    throw courseError;
  }

  if (!courseRows?.length) {
    return [];
  }

  const courseIds = courseRows.map((row) => row.id);
  const { data: sectionRows, error: sectionError } = await coursesClient
    .from(SECTION_TABLE)
    .select("*")
    .in("course_id", courseIds)
    .order("position", { ascending: true });

  if (sectionError) {
    throw sectionError;
  }

  const sectionIds = (sectionRows || []).map((row) => row.id);
  let contentRows = [];

  if (sectionIds.length) {
    const { data, error } = await coursesClient
      .from(SECTION_CONTENT_TABLE)
      .select("*")
      .in("section_id", sectionIds)
      .order("position", { ascending: true });

    if (error) {
      throw error;
    }

    contentRows = data || [];
  }

  const contentsBySection = new Map();
  for (const contentRow of contentRows) {
    const sectionContent = contentsBySection.get(contentRow.section_id) || [];
    sectionContent.push(contentRow);
    contentsBySection.set(contentRow.section_id, sectionContent);
  }

  const sectionsByCourse = new Map();
  for (const sectionRow of sectionRows || []) {
    const courseSections = sectionsByCourse.get(sectionRow.course_id) || [];
    courseSections.push({
      ...sectionRow,
      contents: contentsBySection.get(sectionRow.id) || [],
    });
    sectionsByCourse.set(sectionRow.course_id, courseSections);
  }

  return courseRows.map((courseRow) =>
    buildCourseFromSupabaseRow(
      courseRow,
      sectionsByCourse.get(courseRow.id) || [],
      getCachedCourse(courseRow.id),
      courseStatusState
    )
  );
}

async function refreshFromSupabase() {
  let supabaseCourses = await fetchSupabaseCourseTree();

  // Seed default courses if they are missing in the database and we are on an admin page
  const isAdminPage =
    typeof window !== "undefined" &&
    window.location &&
    (window.location.pathname.includes("/admin_pages/") ||
      window.location.pathname.includes("/ADDING_COURSE/"));

  if (isAdminPage) {
    const missingSeedIds = CURRENT_SEED_IDS.filter(
      (seedId) => !supabaseCourses.some((c) => c.id === seedId)
    );

    if (missingSeedIds.length > 0) {
      console.info("Seeding missing courses to Supabase:", missingSeedIds);
      const originalCourses =
        typeof originalMethods.getPublishedCourses === "function"
          ? originalMethods.getPublishedCourses()
          : [];

      for (const seedId of missingSeedIds) {
        const seedCourse = originalCourses.find((c) => c.id === seedId);
        if (seedCourse) {
          try {
            await syncCourseToSupabase(seedCourse);
            console.info(`Successfully seeded ${seedId} to Supabase`);
          } catch (err) {
            console.error(`Failed to seed ${seedId} to Supabase:`, err);
          }
        }
      }

      // Re-fetch after seeding
      supabaseCourses = await fetchSupabaseCourseTree();
    }
  }

  courseCache = supabaseCourses;
  dispatchStoreUpdated();
  return clone(courseCache);
}

function buildLessonBody(lesson) {
  const firstAssessment = Array.isArray(lesson?.assessments)
    ? lesson.assessments[0] || null
    : null;
  const lessonId = ensureUuid(lesson?.id);
  const assessmentId = firstAssessment ? ensureUuid(firstAssessment.id) : null;

  return JSON.stringify({
    kind: "lesson",
    lessonId,
    title: lesson?.title || "",
    subtitle: lesson?.subtitle || "",
    slideCount: Number(lesson?.slideCount) || lesson?.slides?.length || 0,
    duration: lesson?.duration || "",
    slides: Array.isArray(lesson?.slides) ? lesson.slides : [],
    assessment: firstAssessment
      ? {
          id: assessmentId,
          title: firstAssessment.title || "",
          description: firstAssessment.description || "",
          duration: Number(firstAssessment.duration) || 10,
          passingScore: Number(firstAssessment.passingScore) || 70,
          isDraft: firstAssessment.isDraft !== false,
          questions: normalizeQuestions(firstAssessment.questions || []),
        }
      : null,
  });
}

function buildSectionLessonsBody(level) {
  const lessons = (Array.isArray(level?.lessons) ? level.lessons : []).map((lesson) => {
    const lessonId = ensureUuid(lesson?.id);
    const firstAssessment = Array.isArray(lesson?.assessments)
      ? lesson.assessments[0] || null
      : null;

    return {
      kind: "lesson",
      lessonId,
      title: lesson?.title || "",
      subtitle: lesson?.subtitle || "",
      slideCount: Number(lesson?.slideCount) || lesson?.slides?.length || 0,
      duration: lesson?.duration || "",
      slides: Array.isArray(lesson?.slides) ? lesson.slides : [],
      assessment: firstAssessment
        ? {
            id: ensureUuid(firstAssessment.id),
            title: firstAssessment.title || "",
            description: firstAssessment.description || "",
            duration: Number(firstAssessment.duration) || 10,
            passingScore: Number(firstAssessment.passingScore) || 70,
            isDraft: firstAssessment.isDraft !== false,
            questions: normalizeQuestions(firstAssessment.questions || []),
          }
        : null,
    };
  });

  return JSON.stringify({
    kind: "section-lessons",
    lessons,
  });
}

async function syncCourseToSupabase(courseInput) {
  await ensureCourseWriteAccess();

  const course = clone(courseInput);
  const existingCourse = getCachedCourse(course.id);
  const courseId = course.id || generateCourseId();
  const levels = (Array.isArray(course.levels) ? course.levels : []).map((level) => {
    const nextLevelId = ensureUuid(level?.id);
    const lessons = (Array.isArray(level?.lessons) ? level.lessons : []).map((lesson) => {
      const nextLessonId = ensureUuid(lesson?.id);
      const assessments = (Array.isArray(lesson?.assessments) ? lesson.assessments : []).map(
        (assessment, index) => ({
          ...assessment,
          id: ensureUuid(assessment?.id || (index === 0 ? nextLessonId : "")),
        })
      );

      return {
        ...lesson,
        id: nextLessonId,
        assessments,
      };
    });

    return {
      ...level,
      id: nextLevelId,
      lessons,
    };
  });
  const topLevel =
    Number.isFinite(Number(course.level)) && Number(course.level) > 0
      ? Number(course.level)
      : levels.length;

  const courseRow = {
    id: courseId,
    title: course.title || "Untitled Course",
    description: course.description || "",
    category: course.category || existingCourse?.category || "General",
    level: topLevel,
    duration_minutes:
      Number(course.duration_minutes) ||
      Number(existingCourse?.duration_minutes) ||
      Math.max(10, Number(course.totalSlides) || 0),
  };

  const { error: courseError } = await coursesClient
    .from(COURSE_TABLE)
    .upsert(courseRow, { onConflict: "id" });

  if (courseError) {
    throw courseError;
  }

  const { data: existingSections, error: existingSectionsError } = await coursesClient
    .from(SECTION_TABLE)
    .select("id")
    .eq("course_id", courseId);

  if (existingSectionsError) {
    throw existingSectionsError;
  }

  const nextSectionIds = [];
  const sectionRows = levels.map((level, index) => {
    const sectionId = ensureUuid(level.id);
    nextSectionIds.push(sectionId);
    return {
      id: sectionId,
      course_id: courseId,
      title: level.title || `Level ${index + 1}`,
      position: index + 1,
      price: Number(level.price) || 0,
      description: level.description || "",
    };
  });

  if (sectionRows.length) {
    const { error: sectionUpsertError } = await coursesClient
      .from(SECTION_TABLE)
      .upsert(sectionRows, { onConflict: "id" });

    if (sectionUpsertError) {
      throw sectionUpsertError;
    }
  }

  const removedSectionIds = (existingSections || [])
    .map((row) => row.id)
    .filter((sectionId) => !nextSectionIds.includes(sectionId));

  if (removedSectionIds.length) {
    await coursesClient
      .from(SECTION_CONTENT_TABLE)
      .delete()
      .in("section_id", removedSectionIds);
    const { error: sectionDeleteError } = await coursesClient
      .from(SECTION_TABLE)
      .delete()
      .in("id", removedSectionIds);

    if (sectionDeleteError) {
      throw sectionDeleteError;
    }
  }

  const { data: existingContentRows, error: existingContentError } = await coursesClient
    .from(SECTION_CONTENT_TABLE)
    .select("id,section_id")
    .in("section_id", nextSectionIds.length ? nextSectionIds : ["__none__"]);

  if (existingContentError && nextSectionIds.length) {
    throw existingContentError;
  }

  const existingContentBySectionId = new Map(
    (existingContentRows || []).map((row) => [row.section_id, row])
  );

  const contentRows = [];
  for (let levelIndex = 0; levelIndex < levels.length; levelIndex += 1) {
    const level = levels[levelIndex];
    const sectionId = nextSectionIds[levelIndex];
    const existingContentRow = existingContentBySectionId.get(sectionId);
    const sectionBody = buildSectionLessonsBody(level);

    contentRows.push({
      id: ensureUuid(existingContentRow?.id),
      section_id: sectionId,
      content_type: "text",
      position: 1,
      text_body: sectionBody,
      body: sectionBody,
      video_url: null,
      quiz_id: null,
      duration_seconds: null,
    });
  }

  if (contentRows.length) {
    const { error: contentUpsertError } = await coursesClient
      .from(SECTION_CONTENT_TABLE)
      .upsert(contentRows, { onConflict: "id" });

    if (contentUpsertError) {
      throw contentUpsertError;
    }
  }

  const nextContentIds = contentRows.map((row) => row.id);
  const removedContentIds = (existingContentRows || [])
    .map((row) => row.id)
    .filter((contentId) => !nextContentIds.includes(contentId));

  if (removedContentIds.length) {
    const { error: contentDeleteError } = await coursesClient
      .from(SECTION_CONTENT_TABLE)
      .delete()
      .in("id", removedContentIds);

    if (contentDeleteError) {
      throw contentDeleteError;
    }
  }

  const currentStatusState = await loadCourseStatusState().catch(() => ({}));
  currentStatusState[courseId] = course.status === "approved" ? "approved" : "draft";
  await saveCourseStatusState(currentStatusState);

  return courseId;
}

const readyPromise = refreshFromSupabase().catch((error) => {
  console.warn("Supabase course sync failed.", error);
  courseCache = [];
  dispatchStoreUpdated();
  return clone(courseCache);
});

baseStore.ready = () => readyPromise;
baseStore.refreshFromSupabase = async () => refreshFromSupabase();

baseStore.getPublishedCourses = () => clone(courseCache);
baseStore.getApprovedCourses = () =>
  clone(courseCache.filter((course) => course.status === "approved"));
baseStore.getDraftCourses = () =>
  clone(courseCache.filter((course) => course.status !== "approved"));
baseStore.getCourseById = (courseId) =>
  clone(courseCache.find((course) => course.id === courseId) || null);

baseStore.upsertCourse = async (course) => {
  const nextCourse = clone(course);
  nextCourse.id = nextCourse.id || generateCourseId();
  try {
    await syncCourseToSupabase(nextCourse);
    await refreshFromSupabase();
    return baseStore.getCourseById(nextCourse.id);
  } catch (error) {
    console.error("Supabase course upsert failed.", error);
    throw error;
  }
};

baseStore.deleteCourse = async (courseId) => {
  try {
    const { data: sectionRows, error: sectionLookupError } = await coursesClient
      .from(SECTION_TABLE)
      .select("id")
      .eq("course_id", courseId);

    if (sectionLookupError) {
      throw sectionLookupError;
    }

    const sectionIds = (sectionRows || []).map((row) => row.id);
    if (sectionIds.length) {
      const { error: contentDeleteError } = await coursesClient
        .from(SECTION_CONTENT_TABLE)
        .delete()
        .in("section_id", sectionIds);

      if (contentDeleteError) {
        throw contentDeleteError;
      }

      const { error: sectionDeleteError } = await coursesClient
        .from(SECTION_TABLE)
        .delete()
        .in("id", sectionIds);

      if (sectionDeleteError) {
        throw sectionDeleteError;
      }
    }

    const { error: courseDeleteError } = await coursesClient
      .from(COURSE_TABLE)
      .delete()
      .eq("id", courseId);

    if (courseDeleteError) {
      throw courseDeleteError;
    }

    const currentStatusState = await loadCourseStatusState().catch(() => ({}));
    delete currentStatusState[courseId];
    await saveCourseStatusState(currentStatusState);

    courseCache = courseCache.filter((course) => course.id !== courseId);
    dispatchStoreUpdated();
  } catch (error) {
    console.error("Supabase course delete failed.", error);
    throw error;
  }
};

window.SIMPCourseStore = baseStore;
