import { useState, useEffect } from "react";
import { C } from "../theme";
import { getClasses, renameStudentEverywhereRpc } from "../supabaseClient";
import { Card } from "../components/ui";

/* ===================================================================
   Student Manager (教务老师) — add / delete / move students across classes
   =================================================================== */
export default function StudentManager({ activeClassId, onSaveClasses, pushToast }) {
  const [list, setList] = useState(null); // [{id,name,invite_code,students:[]}]
  const [newName, setNewName] = useState("");
  const [addTo, setAddTo] = useState(activeClassId || "");
  const [editKey, setEditKey] = useState(null);  // "clsId|oldName" 如果在编辑
  const [editVal, setEditVal] = useState("");

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
  const renameStudent = async (clsId, oldName, newName) => {
    const nm = newName.trim();
    if (!nm || nm === oldName) return;
    const target = list.find((c) => c.id === clsId);
    if (target && target.students.includes(nm)) { pushToast("这个名字已在该班"); return; }

    // 尝试调用 RPC 同时更新学习进度；如果函数不存在就只更新班级名单
    try {
      await renameStudentEverywhereRpc(oldName, nm);
    } catch (e) {
      // RPC 函数不存在（还没在 Supabase 创建）时，这里静默失败，继续只更新班级名单
    }

    commit(list.map((c) => (c.id === clsId ? { ...c, students: c.students.map((x) => x === oldName ? nm : x) } : c)));
    pushToast(`已改名：${oldName} → ${nm}`);
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

      {/* 全部学生统计 */}
      {(() => {
        const allStudents = [];
        list.forEach((c) => {
          (c.students || []).forEach((nm) => {
            if (!allStudents.includes(nm)) allStudents.push(nm);
          });
        });
        allStudents.sort();
        return (
          <div style={{
            background: "#FBEFCB",
            border: `2px solid ${C.border}`,
            borderRadius: 14,
            padding: 12,
            marginBottom: 16,
          }}>
            <div style={{ fontWeight: 800, marginBottom: 8, fontSize: 15 }}>
              📋 全部学生 <span style={{ fontSize: 13, color: "#8A8276" }}>共 {allStudents.length} 人</span>
            </div>
            {allStudents.length === 0 ? (
              <span style={{ color: "#9C9382", fontSize: 14 }}>还没有学生</span>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {allStudents.map((nm) => (
                  <span key={nm} style={{
                    background: "#fff",
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    padding: "4px 10px",
                    fontSize: 14,
                    fontWeight: 600,
                  }}>
                    {nm}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* per-class rosters */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {list.map((c) => (
          <div key={c.id} style={{ border: `2px solid ${c.id === activeClassId ? C.bamboo : C.border}`, borderRadius: 14, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 800 }}>
                {c.name} <span style={{ fontSize: 12, color: "#9C9382", fontWeight: 600 }}>· {c.students.length} 人</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, color: "#8A8276", fontWeight: 700 }}>邀请码:</span>
                <input
                  style={{
                    padding: "4px 8px", borderRadius: 8, border: `2px solid ${C.border}`,
                    fontSize: 13, width: 100, fontWeight: 700, background: "#fff",
                  }}
                  value={c.invite_code || ""}
                  onChange={(ev) => {
                    const code = ev.target.value;
                    commit(list.map((item) => item.id === c.id ? { ...item, invite_code: code } : item));
                  }}
                />
              </div>
            </div>
            {c.students.length === 0 && <span style={{ color: "#9C9382", fontSize: 14 }}>暂无学生</span>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {c.students.map((nm) => {
                const isEditing = editKey === `${c.id}|${nm}`;
                return (
                  <div key={nm} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editVal}
                        onChange={(ev) => setEditVal(ev.target.value)}
                        onBlur={() => {
                          renameStudent(c.id, nm, editVal);
                          setEditKey(null);
                        }}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter") {
                            renameStudent(c.id, nm, editVal);
                            setEditKey(null);
                          } else if (ev.key === "Escape") {
                            setEditKey(null);
                          }
                        }}
                        style={{
                          ...inputStyle,
                          flex: "1 1 80px",
                          minHeight: 44,
                          padding: "8px 10px",
                          fontSize: 14,
                        }}
                      />
                    ) : (
                      <span
                        onClick={() => {
                          setEditKey(`${c.id}|${nm}`);
                          setEditVal(nm);
                        }}
                        style={{
                          fontWeight: 700,
                          flex: "1 1 80px",
                          cursor: "pointer",
                          padding: "4px 8px",
                          borderRadius: 6,
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(ev) => {
                          ev.currentTarget.style.background = "#F5EFE7";
                        }}
                        onMouseLeave={(ev) => {
                          ev.currentTarget.style.background = "transparent";
                        }}
                        title="点击编辑名字"
                      >
                        {nm}
                      </span>
                    )}
                    {!isEditing && (
                      <>
                        <select
                          defaultValue=""
                          onChange={(ev) => { moveStudent(c.id, nm, ev.target.value); ev.target.value = ""; }}
                          style={{ ...inputStyle, minHeight: 44, padding: "6px 10px", fontSize: 14 }}
                        >
                          <option value="" disabled>移动到…</option>
                          {list.filter((o) => o.id !== c.id).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                        <button
                          onClick={() => removeStudent(c.id, nm)}
                          style={{
                            minHeight: 44,
                            padding: "0 12px",
                            borderRadius: 10,
                            border: `2px solid ${C.border}`,
                            background: "#fff",
                            color: C.red,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          删除
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
