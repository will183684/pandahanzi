import { useState, useEffect } from "react";
import { C } from "../theme";
import { getClasses } from "../supabaseClient";
import { Card } from "../components/ui";

/* ===================================================================
   Student Manager (教务老师) — add / delete / move students across classes
   =================================================================== */
export default function StudentManager({ activeClassId, onSaveClasses, pushToast }) {
  const [list, setList] = useState(null); // [{id,name,invite_code,students:[]}]
  const [newName, setNewName] = useState("");
  const [addTo, setAddTo] = useState(activeClassId || "");

  useEffect(() => {
    let alive = true;
    getClasses().then((cs) => {
      if (!alive) return;
      const norm = cs.map((c) => ({ ...c, students: Array.isArray(c.students) ? c.students : [] }));
      setList(norm);
      if (!addTo && norm[0]) setAddTo(norm[0].id);
    }).catch(() => pushToast("读取班级失败 ⚠️"));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (nlist) => {
    setList(nlist);
    onSaveClasses(nlist);
  };

  const addStudent = () => {
    const nm = newName.trim();
    if (!nm || !addTo) return;
    const target = list.find((c) => c.id === addTo);
    if (target && target.students.includes(nm)) { pushToast("这个名字已在该班"); return; }
    commit(list.map((c) => (c.id === addTo ? { ...c, students: [...c.students, nm] } : c)));
    setNewName("");
  };
  const removeStudent = (clsId, nm) => {
    commit(list.map((c) => (c.id === clsId ? { ...c, students: c.students.filter((x) => x !== nm) } : c)));
  };
  const moveStudent = (fromId, nm, toId) => {
    if (!toId || toId === fromId) return;
    commit(list.map((c) => {
      if (c.id === fromId) return { ...c, students: c.students.filter((x) => x !== nm) };
      if (c.id === toId) return { ...c, students: c.students.includes(nm) ? c.students : [...c.students, nm] };
      return c;
    }));
  };

  const inputStyle = {
    minHeight: 52, padding: "10px 14px", borderRadius: 12, fontSize: 16,
    border: `2px solid ${C.border}`, background: "#fff", boxSizing: "border-box",
  };

  if (!list) return <Card><p style={{ color: "#9C9382" }}>正在加载班级…</p></Card>;

  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>👧 学生管理</h3>
      <p style={{ fontSize: 13, color: "#9C9382", marginTop: 0 }}>教务老师可新增 / 删除学生，并把孩子分配到不同班级。名单为空的班级，任何名字都能登录。</p>

      {/* add */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <input style={{ ...inputStyle, flex: "1 1 140px" }} value={newName} placeholder="学生名字"
          onChange={(ev) => setNewName(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && addStudent()} />
        <select style={{ ...inputStyle }} value={addTo} onChange={(ev) => setAddTo(ev.target.value)}>
          {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={addStudent} style={{
          minHeight: 52, padding: "0 18px", borderRadius: 12, border: "none", background: C.bamboo,
          color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer",
        }}>＋ 添加</button>
      </div>

      {/* per-class rosters */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {list.map((c) => (
          <div key={c.id} style={{ border: `2px solid ${c.id === activeClassId ? C.bamboo : C.border}`, borderRadius: 14, padding: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>
              {c.name} <span style={{ fontSize: 12, color: "#9C9382", fontWeight: 600 }}>邀请码 {c.invite_code} · {c.students.length} 人</span>
            </div>
            {c.students.length === 0 && <span style={{ color: "#9C9382", fontSize: 14 }}>暂无学生</span>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {c.students.map((nm) => (
                <div key={nm} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, flex: "1 1 80px" }}>{nm}</span>
                  <select defaultValue="" onChange={(ev) => { moveStudent(c.id, nm, ev.target.value); ev.target.value = ""; }}
                    style={{ ...inputStyle, minHeight: 44, padding: "6px 10px", fontSize: 14 }}>
                    <option value="" disabled>移动到…</option>
                    {list.filter((o) => o.id !== c.id).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <button onClick={() => removeStudent(c.id, nm)} style={{
                    minHeight: 44, padding: "0 12px", borderRadius: 10, border: `2px solid ${C.border}`,
                    background: "#fff", color: C.red, fontWeight: 700, cursor: "pointer",
                  }}>删除</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
