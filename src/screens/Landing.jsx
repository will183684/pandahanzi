import { useState } from "react";
import { C, TEACHER_CODE, ADMIN_CODE } from "../theme";
import { normCode } from "../utils";
import { getClasses, saveClasses } from "../supabaseClient";
import Panda from "../components/Panda";
import { Card, BigButton } from "../components/ui";

/* ===================================================================
   Landing — single teacher passcode + class list/create; parent join
   =================================================================== */
export default function Landing({ onEnter, pushToast }) {
  const [tab, setTab] = useState("parent");
  const [childName, setChildName] = useState("");
  const [invite, setInvite] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [teacherRole, setTeacherRole] = useState("teacher");
  const [classes, setClasses] = useState([]);
  const [newName, setNewName] = useState("");
  const [newInvite, setNewInvite] = useState("");

  const inputStyle = {
    width: "100%", minHeight: 56, padding: "0 16px", borderRadius: 14, fontSize: 17,
    border: `2px solid ${C.border}`, background: "#fff", boxSizing: "border-box",
  };
  const lbl = { fontWeight: 700, fontSize: 15 };

  const submitParent = async () => {
    setErr("");
    const nm = childName.trim();
    if (!nm) { setErr("请输入小朋友的名字"); return; }
    if (!invite.trim()) { setErr("请输入班级邀请码"); return; }
    setBusy(true);
    try {
      const list = await getClasses();
      const cls = list.find((c) => normCode(c.invite_code) === normCode(invite));
      if (!cls) { setErr("邀请码不对，请联系老师确认 🐼"); setBusy(false); return; }
      const roster = Array.isArray(cls.students) ? cls.students : [];
      if (roster.length > 0 && !roster.includes(nm)) {
        setErr("找不到这个名字，请联系老师确认 🐼"); setBusy(false); return;
      }
      onEnter(cls, { role: "parent", name: nm });
    } catch (e) {
      setErr("连接失败，请检查网络 ⚠️"); setBusy(false);
    }
  };

  const submitTeacher = async () => {
    setErr("");
    let role = null;
    if (pw === ADMIN_CODE) role = "admin";
    else if (pw === TEACHER_CODE) role = "teacher";
    if (!role) { setErr("口令不对，请再试一次"); return; }
    setTeacherRole(role);
    setBusy(true);
    try {
      const list = await getClasses();
      setClasses(list); setAuthed(true);
    } catch (e) { setErr("连接失败，请检查网络 ⚠️"); }
    setBusy(false);
  };

  const createClass = async () => {
    setErr("");
    const nm = newName.trim(); const code = newInvite.trim();
    if (!nm) { setErr("请输入班级名称"); return; }
    if (!code) { setErr("请设置家长邀请码"); return; }
    setBusy(true);
    try {
      const list = await getClasses();
      if (list.some((c) => normCode(c.invite_code) === normCode(code))) {
        setErr("这个邀请码已被别的班级用了，换一个"); setBusy(false); return;
      }
      const cls = { id: "cls_" + Math.random().toString(36).slice(2, 9), name: nm, invite_code: code, students: [] };
      await saveClasses([...list, cls]);
      onEnter(cls, { role: teacherRole });
    } catch (e) { setErr("建班失败，请检查网络 ⚠️"); setBusy(false); }
  };

  const tabs = [{ k: "parent", label: "🏠 家长" }, { k: "teacher", label: "👩‍🏫 老师" }];

  return (
    <div style={{ maxWidth: 460, margin: "10px auto" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 18 }}>
        <Panda sz={110} ex="curious" />
        <h1 style={{ fontSize: 24, margin: "8px 0 2px" }}>熊猫画画班</h1>
        <p style={{ color: "#8A8276", margin: 0 }}>欢迎回来，一起练汉字吧！</p>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, background: "#F1E9DC", padding: 6, borderRadius: 14 }}>
        {tabs.map((t) => (
          <button key={t.k} onClick={() => { setTab(t.k); setErr(""); }} style={{
            flex: 1, minHeight: 48, borderRadius: 10, border: "none", cursor: "pointer", fontSize: 15, fontWeight: 700,
            background: tab === t.k ? "#fff" : "transparent", color: tab === t.k ? C.ink : "#8A8276",
            boxShadow: tab === t.k ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
          }}>{t.label}</button>
        ))}
      </div>

      <Card>
        {tab === "parent" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={lbl}>小朋友的名字</label>
            <input style={inputStyle} value={childName} placeholder="例如：小明"
              onChange={(ev) => setChildName(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && submitParent()} />
            <label style={lbl}>班级邀请码</label>
            <input style={inputStyle} value={invite} placeholder="老师给的邀请码"
              onChange={(ev) => setInvite(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && submitParent()} />
            <BigButton color={C.bamboo} onClick={submitParent} disabled={busy} style={{ marginTop: 4 }}>
              {busy ? "请稍候…" : "开始练习 🚀"}
            </BigButton>
          </div>
        )}

        {tab === "teacher" && !authed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={lbl}>老师口令</label>
            <input style={inputStyle} type="password" value={pw} placeholder="请输入老师口令"
              onChange={(ev) => setPw(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && submitTeacher()} />
            <p style={{ fontSize: 13, color: "#9C9382", margin: 0 }}>授课老师 / 教务老师各用各的口令，进去后选/建自己的班</p>
            <BigButton color={C.bamboo} onClick={submitTeacher} disabled={busy}>{busy ? "请稍候…" : "进入 →"}</BigButton>
          </div>
        )}

        {tab === "teacher" && authed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={lbl}>选择班级</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {classes.length === 0 && <span style={{ color: "#9C9382", fontSize: 14 }}>还没有班级，下面新建一个吧。</span>}
                {classes.map((c) => (
                  <button key={c.id} onClick={() => onEnter(c, { role: teacherRole })} style={{
                    textAlign: "left", minHeight: 56, padding: "10px 16px", borderRadius: 14,
                    border: `2px solid ${C.border}`, background: "#fff", cursor: "pointer",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span style={{ fontWeight: 800, fontSize: 17 }}>{c.name}</span>
                    <span style={{ fontSize: 13, color: "#9C9382" }}>邀请码 {c.invite_code} →</span>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ borderTop: `1px dashed ${C.border}`, paddingTop: 12 }}>
              <label style={lbl}>＋ 新建班级</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                <input style={inputStyle} value={newName} placeholder="班级名称，例如：周六中班"
                  onChange={(ev) => setNewName(ev.target.value)} />
                <input style={inputStyle} value={newInvite} placeholder="家长邀请码，例如：PANDA2026"
                  onChange={(ev) => setNewInvite(ev.target.value)} />
                <BigButton color={C.gold} onClick={createClass} disabled={busy}>{busy ? "请稍候…" : "建好并进入 🏫"}</BigButton>
              </div>
            </div>
          </div>
        )}

        {err && <p style={{ color: C.red, fontWeight: 700, marginTop: 12, marginBottom: 0 }}>{err}</p>}
      </Card>
    </div>
  );
}
