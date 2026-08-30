import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  supabase, getClasses, saveClasses,
  getCurriculum, getClassLessons, getClassCharsBrief, getClassLessonChars,
  startClassLesson, updateClassLesson, completeClassLesson, saveClassLessonChars,
  getClassProgress, markProgress, getProfiles, saveProfile, deleteClassLesson,
  saveSharedAudio, getCharSharedAudios, getSharedAudioByHanzi, getWordAudios,
} from "./supabaseClient";
import { C, ACTIVITIES, DEFAULT_AVATAR } from "./theme";
import { toMeta, progressMap } from "./curriculum";
import Panda from "./components/Panda";
import { Toast, Shell, BigButton } from "./components/ui";
import ActivityHost from "./activities/ActivityHost";
import Landing from "./screens/Landing";
import StudentHome from "./screens/StudentHome";
import ReviewHome from "./screens/ReviewHome";
import ArchivePanel from "./screens/ArchivePanel";
import LessonPicker from "./screens/LessonPicker";
import AvatarPicker from "./components/AvatarPicker";
import TeacherArea, { ghostBtn } from "./screens/TeacherArea";

/* ============================================================
   Panda Chinese · 中文识字
   根组件：持有当前班级 + 排课状态，落库到 Supabase，并在
   登录页 / 学生页 / 老师页之间路由。
   课程库（1200 字 / 240 课）是全局只读数据，进程内缓存一次。
   ============================================================ */
/* 一条完成记录的身份：同一节课 + 同一个孩子 + 同一个活动 */
const rowTag = (r) => r.class_lesson_id + "|" + r.student_name + "|" + r.activity_key;
const sameRow = (a) => (b) => rowTag(a) === rowTag(b);

/* 重取回来的数据里补上还没被服务器确认的那几条，否则刚点亮的星星会被抹掉 */
function withPending(rows, pending) {
  if (!pending.size) return rows;
  const have = new Set(rows.map(rowTag));
  const extra = [];
  pending.forEach((tag) => {
    if (have.has(tag)) return;
    const [lessonId, name, key] = tag.split("|");
    extra.push({
      class_lesson_id: Number(lessonId), student_name: name, activity_key: key,
      completed_at: new Date().toISOString(),
    });
  });
  return extra.length ? [...rows, ...extra] : rows;
}

export default function PandaHanziApp() {
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const pushToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }, []);

  // ---- session / class ----
  const [session, setSession] = useState(null);       // {role:'parent'|'teacher'|'admin', name?}
  const [activeClass, setActiveClass] = useState(null);

  // ---- data ----
  const [curriculum, setCurriculum] = useState(null); // 全局课程库
  const [classLessons, setClassLessons] = useState([]);
  const [charsBrief, setCharsBrief] = useState([]);   // 本班所有课的字（无录音，列表预览用）
  const [viewChars, setViewChars] = useState([]);     // 当前查看那节课的完整字表（含录音）
  const [progressRows, setProgressRows] = useState([]);
  const [profiles, setProfiles] = useState({});       // 学生名 -> {avatar}
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [charsTick, setCharsTick] = useState(0);      // 触发重取 viewChars

  // ---- ui ----
  const [activeActivity, setActiveActivity] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [reviewId, setReviewId] = useState(null);     // 回顾中的 class_lesson id

  /* ---------------- 课程库：全局加载一次 ---------------- */
  useEffect(() => {
    let alive = true;
    getCurriculum()
      .then((c) => { if (alive) setCurriculum(c); })
      .catch(() => pushToast("课程库加载失败，请检查网络 ⚠️"));
    return () => { alive = false; };
  }, [pushToast]);

  /* ---------------- 本班数据 ----------------
     下面的加载/订阅只认班级 id，不认 activeClass 这个对象。
     改班名会 setActiveClass 出一个新对象，如果 effect 依赖整个对象，
     每敲一个字都会重新加载一次 —— 界面闪回「正在加载」、tab 被重置，
     表现就是班名根本改不动。 */
  const activeClassId = activeClass ? activeClass.id : null;

  /* 已经点亮、但服务器还没确认的完成记录（"课id|名字|活动"）。
     重取整表时要把它们保住，详见 markComplete。 */
  const pendingRef = useRef(new Set());

  const reload = useCallback(async () => {
    if (!activeClassId) return;
    const lessons = await getClassLessons(activeClassId);
    const ids = lessons.map((l) => l.id);
    const [brief, prog, profs] = await Promise.all([
      getClassCharsBrief(ids), getClassProgress(ids), getProfiles(activeClassId),
    ]);
    setClassLessons(lessons);
    setCharsBrief(brief);
    setProgressRows(withPending(prog, pendingRef.current));
    setProfiles(profs);
  }, [activeClassId]);

  useEffect(() => {
    if (!activeClassId) return undefined;
    let alive = true;
    setLoaded(false);
    reload()
      .then(() => { if (alive) setLoaded(true); })
      .catch(() => {
        if (!alive) return;
        pushToast("连接数据库失败，请检查网络 ⚠️");
        setLoaded(true);
      });
    return () => { alive = false; };
  }, [activeClassId, reload, pushToast]);

  /* ---------------- realtime ---------------- */
  useEffect(() => {
    if (!activeClassId) return undefined;
    let alive = true;
    let timer = null;
    const refetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!alive) return;
        reload().catch(() => {});
        setCharsTick((t) => t + 1);
      }, 250);
    };
    // class_lesson_chars / lesson_progress 没有 class_id 列，没法按班过滤，
    // 收到任何变更都重取一次；数据量小，代价可以忽略。
    const channel = supabase
      .channel("v2-sync-" + activeClassId)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "class_lessons", filter: `class_id=eq.${activeClassId}` }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "class_lesson_chars" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "lesson_progress" }, refetch)
      .subscribe();
    return () => { alive = false; if (timer) clearTimeout(timer); supabase.removeChannel(channel); };
  }, [activeClassId, reload]);

  /* ---------------- 派生 ---------------- */
  /* 当前这节课：优先「正在上」的那节；老师点过「完成本课」之后就没有 active 了，
     这时回退到最近上过的一节 —— 否则学生首页会立刻变成「还没安排」，
     想复习刚上完的课只能去翻历史记录。 */
  const currentLesson = useMemo(() => {
    const active = classLessons.find((l) => l.status === "active");
    if (active) return active;
    return classLessons.reduce((best, l) => (!best || l.seq > best.seq ? l : best), null);
  }, [classLessons]);
  const reviewing = reviewId != null;
  const viewLesson = useMemo(
    () => (reviewing ? classLessons.find((l) => l.id === reviewId) || null : currentLesson),
    [reviewing, reviewId, classLessons, currentLesson]
  );
  const viewLessonId = viewLesson ? viewLesson.id : null;

  /* 当前查看那节课的完整字表（含录音）。
     charsFor 记录 viewChars 属于哪节课 —— 字表是异步到的，不记的话
     在它到达之前学生会闪一下「老师还没安排」。 */
  const [charsFor, setCharsFor] = useState(null);
  useEffect(() => {
    if (!viewLessonId) { setViewChars([]); setCharsFor(null); return undefined; }
    let alive = true;
    getClassLessonChars(viewLessonId)
      .then((cs) => { if (alive) { setViewChars(cs); setCharsFor(viewLessonId); } })
      .catch(() => { if (alive) setCharsFor(viewLessonId); });
    return () => { alive = false; };
  }, [viewLessonId, charsTick]);

  /* 词语和句子里用到、但不在本课字表里的字的录音。
     「小羊」的「小」可能属于别的课，字表里没有它 —— 不单独取一次的话，
     老师明明录过，孩子在拼词语里听到的还是机器音。
     只认词句的文本内容，不认 lesson 对象身份，免得每次重取都重查。 */
  const vocabKey = viewLesson
    ? (viewLesson.vocab || []).join("") + "|" + (viewLesson.sentence || "")
    : "";
  const [extraAudio, setExtraAudio] = useState({});
  /* 整词录音：L4 起是纯听力，必须用老师念的整词，不能拿单字接 */
  const [wordAudio, setWordAudio] = useState({});
  useEffect(() => {
    const words = (viewLesson && viewLesson.vocab) || [];
    if (!words.length) { setWordAudio({}); return undefined; }
    let alive = true;
    getWordAudios(words).then((m) => {
      if (!alive) return;
      const out = {};
      m.forEach((v, w) => { if (v.audio_url) out[w] = v.audio_url; });
      setWordAudio(out);
    }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocabKey, charsTick]);

  useEffect(() => {
    const want = Array.from(new Set(vocabKey.split("").filter((c) => /[\u4e00-\u9fa5]/.test(c))));
    if (!want.length) { setExtraAudio({}); return undefined; }
    let alive = true;
    getSharedAudioByHanzi(want)
      .then((m) => {
        if (!alive) return;
        const out = {};
        m.forEach((v, hanzi) => { if (v.audio_url) out[hanzi] = v.audio_url; });
        setExtraAudio(out);
      })
      .catch(() => { /* 查不到就都用机器音 */ });
    return () => { alive = false; };
  }, [vocabKey, charsTick]);

  const viewMeta = useMemo(
    () => toMeta(viewLesson, viewChars, curriculum, extraAudio, wordAudio),
    [viewLesson, viewChars, curriculum, extraAudio, wordAudio]
  );

  const who = session && session.role === "parent" ? session.name : null;
  const viewProgress = useMemo(
    () => progressMap(progressRows, viewLessonId, ACTIVITIES, who),
    [progressRows, viewLessonId, who]
  );
  const getProgressFor = useCallback(
    (id) => progressMap(progressRows, id, ACTIVITIES, who),
    [progressRows, who]
  );

  const charsByLesson = useMemo(() => {
    const m = new Map();
    charsBrief.forEach((c) => {
      if (!m.has(c.class_lesson_id)) m.set(c.class_lesson_id, []);
      m.get(c.class_lesson_id).push(c);
    });
    m.forEach((list) => list.sort((a, b) => a.pos - b.pos));
    return m;
  }, [charsBrief]);
  const charsOf = useCallback(
    (id) => (charsByLesson.get(id) || []).map((c) => c.hanzi).join(""),
    [charsByLesson]
  );

  /* 历史记录按课程库的课号排（L1第1课、L1第2课…），不是按上课先后。
     老师和孩子都是照着课号找课的，按 seq 排看着就是乱的。
     自建的课没有课号，排最后，按上课先后。 */
  const lessonsInOrder = useMemo(() => {
    const noOf = (l) => {
      const src = curriculum && l.lesson_id != null ? curriculum.lessonById.get(l.lesson_id) : null;
      return src ? src.lesson_no : Infinity;
    };
    return classLessons.slice().sort((a, b) => {
      const na = noOf(a), nb = noOf(b);
      return na !== nb ? na - nb : a.seq - b.seq;   // Infinity 相等时落到 seq
    });
  }, [classLessons, curriculum]);

  /* ---------------- 老师操作 ---------------- */
  const run = useCallback(async (fn, okMsg, errMsg) => {
    setBusy(true);
    try {
      await fn();
      await reload();
      setCharsTick((t) => t + 1);
      if (okMsg) pushToast(okMsg);
    } catch (e) {
      pushToast(errMsg || "操作失败 ⚠️");
    }
    setBusy(false);
  }, [reload, pushToast]);

  const pickLesson = useCallback((lesson) => {
    setPickerOpen(false);
    run(
      () => startClassLesson(activeClass.id, lesson, classLessons),
      `已选用：${lesson.title || "第" + lesson.lesson_no + "课"} 📚`,
      "选课失败 ⚠️"
    );
  }, [activeClass, classLessons, run]);

  const saveLesson = useCallback((patch) => {
    if (!currentLesson) return;
    run(() => updateClassLesson(currentLesson.id, patch), "已保存 ✅", "保存失败 ⚠️");
  }, [currentLesson, run]);

  const saveChars = useCallback((rows) => {
    if (!currentLesson || !curriculum || !session) return;
    run(
      async () => {
        await saveClassLessonChars(currentLesson.id, rows);
        // 如果老师有录音，也保存到共享音频库（方便其他班级复用）
        if (session.role === "teacher" && session.name) {
          const charMap = new Map(curriculum.characters.map((c) => [c.hanzi, c]));
          for (const row of rows) {
            if (row.audio_url && charMap.has(row.hanzi)) {
              const char = charMap.get(row.hanzi);
              try {
                await saveSharedAudio(char.id, session.name, row.audio_url);
              } catch (e) {
                // 共享音频表不存在时忽略
              }
            }
          }
        }
      },
      null,
      "字表保存失败 ⚠️"
    );
  }, [currentLesson, curriculum, session, run]);

  /* 删掉某一次课（字表和进度靠外键级联）。删的是当前正在上的课时，
     currentLesson 会自动回退到上一次课。 */
  const removeLesson = useCallback((id) => {
    run(() => deleteClassLesson(id), "已删除这次课 🗑️", "删除失败 ⚠️");
    if (reviewId === id) setReviewId(null);
  }, [run, reviewId]);

  const finishLesson = useCallback(() => {
    if (!currentLesson || currentLesson.status !== "active") return;
    run(
      () => completeClassLesson(currentLesson.id),
      "本课已完成 ✅　学生仍可继续复习，直到你选下一课",
      "操作失败 ⚠️"
    );
  }, [currentLesson, run]);

  /* ---------------- 学生完成一个活动 ---------------- */
  /* 孩子在「历史回顾」里重做旧课也算数 —— 记在那节课名下。
     以前这里直接 return，孩子照样看到「太棒了」，但什么都没存下来，
     看上去就像系统漏记了。老师端的回顾仍然是只读的（他们不是学生）。 */
  const markComplete = useCallback((activityIndex) => {
    if (!viewLessonId) return;
    if (!session || session.role !== "parent" || !session.name) return;
    const key = ACTIVITIES[activityIndex].key;
    const name = session.name;
    const lessonId = viewLessonId;
    const row = { class_lesson_id: lessonId, student_name: name, activity_key: key, completed_at: new Date().toISOString() };
    const tag = lessonId + "|" + name + "|" + key;

    /* 先本地点亮星星，同时把这条记进 pendingRef。
       realtime 一有风吹草动就整表重取，重取的 SELECT 可能跑在我们这条
       INSERT 落库之前 —— 不挂起来的话星星会被刚取回的旧数据抹掉。 */
    pendingRef.current.add(tag);
    setProgressRows((prev) => (prev.some(sameRow(row)) ? prev : [...prev, row]));

    markProgress(lessonId, name, key)
      .then(() => { pendingRef.current.delete(tag); })
      .catch(() => {
        // 存不上就把星星收回去，别让孩子以为记下了
        pendingRef.current.delete(tag);
        setProgressRows((prev) => prev.filter((r) => !sameRow(row)(r)));
        pushToast("进度没存上，请检查网络后再做一遍 ⚠️");
      });
  }, [viewLessonId, session, pushToast]);

  /* ---------------- 学生头像 ---------------- */
  const myAvatar = (session && session.role === "parent" && session.name
    && profiles[session.name] && profiles[session.name].avatar) || DEFAULT_AVATAR;

  const chooseAvatar = useCallback((a) => {
    if (!activeClass || !session || session.role !== "parent" || !session.name) return;
    const name = session.name;
    setProfiles((prev) => ({ ...prev, [name]: { ...(prev[name] || {}), avatar: a } }));
    setAvatarOpen(false);
    saveProfile(activeClass.id, name, { avatar: a }).catch(() => pushToast("头像保存失败 ⚠️"));
  }, [activeClass, session, pushToast]);

  /* ---------------- 进出班级 ---------------- */
  const enterClass = useCallback((cls, sess) => {
    setLoaded(false);
    setClassLessons([]); setCharsBrief([]); setViewChars([]); setProgressRows([]);
    setActiveClass(cls);
    setSession(sess);
    setReviewId(null); setActiveActivity(null); setArchiveOpen(false); setPickerOpen(false);
  }, []);

  /* 清掉班级相关的一切，但可以选择保留登录身份 */
  const resetClassState = useCallback(() => {
    setActiveClass(null); setLoaded(false);
    setClassLessons([]); setCharsBrief([]); setViewChars([]); setProgressRows([]); setProfiles({});
    setReviewId(null); setActiveActivity(null); setArchiveOpen(false);
    setPickerOpen(false); setAvatarOpen(false);
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    resetClassState();
  }, [resetClassState]);

  /* 只退出这个班，身份还在 —— 回到「选择班级」那一屏，不用重新输口令 */
  const leaveClass = useCallback(() => {
    resetClassState();
  }, [resetClassState]);

  const saveAllClasses = useCallback((nlist) => {
    saveClasses(nlist).catch(() => pushToast("班级保存失败 ⚠️"));
    setActiveClass((a) => {
      if (!a) return a;
      const mine = nlist.find((c) => c.id === a.id);
      return mine ? { ...a, ...mine } : a;
    });
  }, [pushToast]);

  const openReview = useCallback((id) => {
    setReviewId(id); setArchiveOpen(false); setActiveActivity(null);
  }, []);
  const exitReview = useCallback(() => { setReviewId(null); setActiveActivity(null); }, []);

  /* --------------------------- RENDER --------------------------- */

  if (!activeClass) {
    return (
      <Shell>
        <Landing onEnter={enterClass} pushToast={pushToast} session={session} />
        <Toast msg={toast} />
      </Shell>
    );
  }

  if (!loaded) {
    return (
      <Shell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "48px 0" }}>
          <div style={{ animation: "pa-jump 1.2s ease-in-out infinite" }}><Panda sz={110} ex="curious" /></div>
          <p style={{ color: "#8A8276" }}>正在加载…</p>
        </div>
        <Toast msg={toast} />
      </Shell>
    );
  }

  const reviewBanner = reviewing ? (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      background: "#FBEFCB", borderBottom: `2px solid ${C.gold}`, padding: "10px 16px", flexWrap: "wrap",
    }}>
      <span style={{ fontWeight: 800, color: "#8a6d12" }}>
        🔒 回顾模式 · {viewLesson ? viewLesson.title : ""}
      </span>
      <button onClick={exitReview} style={ghostBtn}>返回本课 ↩</button>
    </div>
  ) : null;

  const archive = archiveOpen ? (
    <ArchivePanel
      lessons={lessonsInOrder} currentId={currentLesson ? currentLesson.id : null}
      charsOf={charsOf} getProgress={getProgressFor}
      onClose={() => setArchiveOpen(false)} onReview={openReview}
      canDelete={!!session && session.role !== "parent"} onDelete={removeLesson}
    />
  ) : null;

  /* ---------------- 老师 / 教务 ---------------- */
  if (session.role === "teacher" || session.role === "admin") {
    return (
      <Shell banner={reviewBanner}>
        {reviewing && viewMeta ? (
          activeActivity == null ? (
            <ReviewHome meta={viewMeta} onOpenActivity={setActiveActivity} onExit={exitReview} />
          ) : (
            <ActivityHost activityIndex={activeActivity} meta={viewMeta} readOnly
              onComplete={() => {}} onBack={() => setActiveActivity(null)} />
          )
        ) : (
          <TeacherArea
            role={session.role}
            className={activeClass.name}
            roster={activeClass.students || []}
            activeClassId={activeClass.id}
            classLessons={classLessons}
            charsOf={charsOf}
            session={session}
            lesson={currentLesson}
            chars={viewChars}
            charsFor={charsFor}
            progressRows={progressRows}
            profiles={profiles}
            level={viewMeta ? viewMeta.level : null}
            curriculum={curriculum}
            myClassIds={session.role === "teacher" ? (session.classIds || []) : null}
            busy={busy}
            onOpenPicker={() => setPickerOpen(true)}
            onSaveLesson={saveLesson}
            onSaveChars={saveChars}
            onCompleteLesson={finishLesson}
            /* 「课程编辑」自己存自己的库，存完让 App 重新拉一遍班级数据 */
            onAfterSave={() => { reload().catch(() => {}); setCharsTick((t) => t + 1); }}
            onOpenArchive={() => setArchiveOpen(true)}
            onLogout={logout}
            onLeaveClass={leaveClass}
            onSaveClasses={saveAllClasses}
            pushToast={pushToast}
          />
        )}
        {pickerOpen && curriculum && (
          <LessonPicker
            curriculum={curriculum} classLessons={classLessons} busy={false}
            onPick={pickLesson} onClose={() => setPickerOpen(false)}
          />
        )}
        {archive}
        <Toast msg={toast} />
      </Shell>
    );
  }

  /* ---------------- 家长 / 学生 ---------------- */
  /* 这节课的字表还在路上 —— 显示加载中，别误报「没安排」 */
  if (viewLesson && charsFor !== viewLesson.id) {
    return (
      <Shell banner={reviewBanner}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "48px 0" }}>
          <div style={{ animation: "pa-jump 1.2s ease-in-out infinite" }}><Panda sz={110} ex="curious" /></div>
          <p style={{ color: "#8A8276" }}>正在加载…</p>
        </div>
        <Toast msg={toast} />
      </Shell>
    );
  }

  if (!reviewing && (!viewMeta || viewMeta.chars.length === 0)) {
    return (
      <Shell banner={reviewBanner}>
        <div style={{ textAlign: "center", padding: "40px 16px" }}>
          <Panda sz={130} avatar={myAvatar} />
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>老师还没安排本周内容</h2>
          <p style={{ color: "#8A8276" }}>过一会儿再来看看吧 🐼</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
            <BigButton color={C.bamboo} light onClick={() => setArchiveOpen(true)}>📚 历史记录</BigButton>
            <BigButton color={C.bamboo} light onClick={logout}>退出登录</BigButton>
          </div>
        </div>
        {archive}
        <Toast msg={toast} />
      </Shell>
    );
  }

  return (
    <Shell banner={reviewBanner}>
      {activeActivity == null ? (
        reviewing ? (
          /* 回顾模式也用孩子自己的头像；老师端那个 ReviewHome 不传，保持品牌熊猫 */
          <ReviewHome meta={viewMeta} avatar={myAvatar} onOpenActivity={setActiveActivity} onExit={exitReview} />
        ) : (
          <StudentHome
            studentName={session.name} meta={viewMeta} progress={viewProgress} readOnly={false}
            avatar={myAvatar} onChangeAvatar={() => setAvatarOpen(true)}
            onOpenActivity={setActiveActivity} onOpenArchive={() => setArchiveOpen(true)} onLogout={logout}
          />
        )
      ) : (
        <ActivityHost
          /* 学生自己重做旧课也计入那节课，所以这里不是只读 */
          activityIndex={activeActivity} meta={viewMeta} readOnly={false}
          done={!!viewProgress[activeActivity]} avatar={myAvatar}
          onComplete={markComplete} onBack={() => setActiveActivity(null)}
        />
      )}
      {archive}
      {avatarOpen && (
        <AvatarPicker current={myAvatar} onPick={chooseAvatar} onClose={() => setAvatarOpen(false)} />
      )}
      <Toast msg={toast} />
    </Shell>
  );
}
