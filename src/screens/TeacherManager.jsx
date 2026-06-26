import { useState, useEffect } from "react";
import { C } from "../theme";
import { getClasses, getTeachers, saveTeachers } from "../supabaseClient";
import { Card } from "../components/ui";

/* ===================================================================
   Teacher Manager (教务老师) — add / delete teachers, assign classes
   =================================================================== */
export default function TeacherManager({ pushToast }) {
  const [teachers, setTeachers] = useState(null);
  const [classes, setClasses] = useState([]);
  const [newName, setNewName] = useState("");
  const [newPasscode, setNewPasscode] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([getTeachers(), getClasses()]).then(([ts, cs]) => {
      if (!alive) return;
      setTeachers(ts);
      setClasses(cs);
    }).catch(() => pushToast("读取数据失败 ⚠️"));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (nlist) => {
    setTeachers(nlist);
    saveTeachers(nlist).catch(() => pushToast("保存失败 ⚠️"));
  };

  const addTeacher = () => {
    const nm = newName.trim();
    const pc = newPasscode.trim();
    if (!nm) { pushToast("请输入老师名字"); return; }
    if (!pc) { pushToast("请设置口令"); return; }
    if (teachers.some((t) => t.passcode === pc)) { pushToast("口令已被使用，请换一个"); return; }
    const t = {
      id: "t_" + Math.random().toString(36).slice(2, 9),
      name: nm,
      passcode: pc,
      classIds: [],
    };
    commit([...teachers, t]);
    setNewName("");
    setNewPasscode("");
    pushToast(`已添加老师：${nm} ✅`);
  };

  const removeTeacher = (tid) => {
    const t = teachers.find((x) => x.id === tid);
    if (!t) return;
    if (!window.confirm(`确定要删除老师 "${t.name}" 吗？`)) return;
    commit(teachers.filter((x) => x.id !== tid));
    pushToast(`已删除老师：${t.name}`);
  };

  const toggleClass = (tid, clsId) => {
    commit(teachers.map((t) => {
      if (t.id !== tid) return t;
      const ids = Array.isArray(t.classIds) ? t.classIds : [];
      const next = ids.includes(clsId) ? ids.filter((x) => x !== clsId) : [...ids, clsId];
      return { ...t, classIds: next };
    }));
  };

  const updatePasscode = (tid, newPc) => {
    commit(teachers.map((t) => t.id === tid ? { ...t, passcode: newPc } : t));
  };

  const inputStyle = {
    minHeight: 52, padding: "10px 14px", borderRadius: 12, fontSize: 16,
    border: `2px solid ${C.border}`, background: "#fff", boxSizing: "border-box",
  };

  if (!teachers) return <Card><p style={{ color: "#9C9382" }}>正在加载…</p></Card>;

  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>🧑‍🏫 授课老师管理</h3>
      <p style={{ fontSize: 13, color: "#9C9382", marginTop: 0 }}>
        在这里添加授课老师、设置口令，并分配可管理的班级。每位老师用自己的口令登录后只能看到被分配的班级。
      </p>

      {/* add teacher */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <input style={{ ...inputStyle, flex: "1 1 120px" }} value={newName} placeholder="老师名字"
          onChange={(ev) => setNewName(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && addTeacher()} />
        <input style={{ ...inputStyle, flex: "1 1 120px" }} value={newPasscode} placeholder="登录口令"
          onChange={(ev) => setNewPasscode(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && addTeacher()} />
        <button onClick={addTeacher} style={{
          minHeight: 52, padding: "0 18px", borderRadius: 12, border: "none", background: C.bamboo,
          color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer",
        }}>＋ 添加</button>
      </div>

      {/* teacher list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {teachers.length === 0 && <span style={{ color: "#9C9382", fontSize: 14 }}>还没有授课老师。</span>}
        {teachers.map((t) => (
          <div key={t.id} style={{ border: `2px solid ${C.border}`, borderRadius: 14, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 16 }}>{t.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#8A8276", fontWeight: 700 }}>口令:</span>
                <input
                  style={{
                    padding: "4px 8px", borderRadius: 8, border: `2px solid ${C.border}`,
                    fontSize: 13, width: 100, fontWeight: 700, background: "#fff",
                  }}
                  value={t.passcode}
                  onChange={(ev) => updatePasscode(t.id, ev.target.value)}
                />
                <button onClick={() => removeTeacher(t.id)} style={{
                  minHeight: 36, padding: "0 12px", borderRadius: 10, border: `2px solid ${C.border}`,
                  background: "#fff", color: C.red, fontWeight: 700, cursor: "pointer", fontSize: 13,
                }}>删除</button>
              </div>
            </div>

            {/* class assignment checkboxes */}
            <div style={{ fontSize: 13, color: "#8A8276", fontWeight: 700, marginBottom: 6 }}>分配班级：</div>
            {classes.length === 0 && <span style={{ color: "#9C9382", fontSize: 13 }}>还没有班级</span>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {classes.map((c) => {
                const assigned = Array.isArray(t.classIds) && t.classIds.includes(c.id);
                return (
                  <label key={c.id} style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                    borderRadius: 10, border: `2px solid ${assigned ? C.bamboo : C.border}`,
                    background: assigned ? "#EBF5EC" : "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700,
                  }}>
                    <input type="checkbox" checked={assigned} onChange={() => toggleClass(t.id, c.id)}
                      style={{ accentColor: C.bamboo, width: 18, height: 18 }} />
                    {c.name}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
