import { useState, useEffect } from "react";
import { C } from "../theme";
import { getClasses, renameStudentEverywhereRpc } from "../supabaseClient";
import { Card, ConfirmDialog } from "../components/ui";

/* ===================================================================
   Student Manager (教务老师) — add / delete / move students across classes
   =================================================================== */
export default function StudentManager({ activeClassId, onSaveClasses, pushToast }) {
  const [list, setList] = useState(null); // [{id,name,invite_code,students:[]}]
  const [newName, setNewName] = useState("");
  const [addTo, setAddTo] = useState(activeClassId || "");
  const [editKey, setEditKey] = useState(null);  // "clsId|oldName" 如果在编辑
  const [editVal, setEditVal] = useState("");
  const [allEditName, setAllEditName] = useState(null);   // 在「全部学生」里改名的那个
  const [allEditVal, setAllEditVal] = useState("");
  const [pendingPurge, setPendingPurge] = useState(null); // 待确认彻底删除的名字

  useEffect(() => {
    let alive = true;
    getClasses().then((cs) => {
      if (!alive) return;
      let norm = cs.map((c) => ({ ...c, students: Array.isArray(c.students) ? c.students : [] }));

      // 如果还没有 allStudents，从当前所有学生初始化一次
      if (norm[0] && !norm[0].allStudents) {
        const allStudents = [];
        norm.forEach((c) => {
          (c.students || []).forEach((nm) => {
            if (!allStudents.includes(nm)) allStudents.push(nm);
          });
        });
        norm = norm.map((c, i) => i === 0 ? { ...c, allStudents } : c);
      }

      setList(norm);
      if (!addTo && norm[0]) setAddTo(norm[0].id);
    }).catch(() => pushToast("读取班级失败 ⚠️"));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 历史名单默认由「原有历史 ∪ 各班当前名单」推出来。
     彻底删除时必须能绕开这个并集，否则名字会被班级名单又补回来，
     所以留了 forceHistory 这个口子。 */
  const commit = (nlist, forceHistory) => {
    if (forceHistory) {
      const updated = nlist.map((c, i) => (i === 0 ? { ...c, allStudents: forceHistory } : c));
      setList(updated);
      onSaveClasses(updated);
      return;
    }
    // 收集所有学生（包括历史），从第一个班级的 allStudents 开始
    const historical = (nlist[0]?.allStudents || []).slice();
    const current = new Set();
    nlist.forEach((c) => {
      (c.students || []).forEach((nm) => current.add(nm));
    });
    // 新增的学生加入历史列表
    current.forEach((nm) => {
      if (!historical.includes(nm)) historical.push(nm);
    });
    // 在所有班级上存一份全局列表（用第一个班级做容器）
    const updatedList = nlist.map((c, i) => i === 0 ? { ...c, allStudents: historical } : c);
    setList(updatedList);
    onSaveClasses(updatedList);
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
    // 删除学生时，把他加入"已删除"名单，这样他还能在全部学生里看到
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

  /* 「全部学生」里改名：所有班级的名单 + 历史名单 + 学习进度一起改 */
  const renameEverywhere = async (oldName, raw) => {
    const nm = (raw || "").trim();
    if (!nm || nm === oldName) return;
    const historical = (list[0]?.allStudents || []);
    if (historical.includes(nm)) { pushToast(`已经有叫「${nm}」的学生了`); return; }

    try { await renameStudentEverywhereRpc(oldName, nm); }
    catch (e) { /* RPC 没建时只改名单，进度对不上就认了 */ }

    const nlist = list.map((c) => ({ ...c, students: (c.students || []).map((x) => (x === oldName ? nm : x)) }));
    commit(nlist, historical.map((x) => (x === oldName ? nm : x)));
    pushToast(`已改名：${oldName} → ${nm}`);
  };

  /* 彻底删除：建错了的学生，从各班名单和历史名单里一起抹掉。
     lesson_progress 里那条（如果有）留着 —— anon key 没有删它的权限，
     而且建错的学生本来就没有练习记录。 */
  const purgeStudent = (nm) => {
    const nlist = list.map((c) => ({ ...c, students: (c.students || []).filter((x) => x !== nm) }));
    commit(nlist, (list[0]?.allStudents || []).filter((x) => x !== nm));
    pushToast(`已彻底删除：${nm}`);
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

      {/* 全部学生统计（包括曾经创建过的所有学生，即使已删除） */}
      {(() => {
        // 从所有班级里收集当前学生
        const currentStudents = new Set();
        list.forEach((c) => {
          (c.students || []).forEach((nm) => currentStudents.add(nm));
        });

        // 尝试从全局列表获取（如果存在）；否则就用当前学生
        const globalAllStudents = list[0]?.allStudents || [];
        const allStudents = globalAllStudents.length > 0
          ? globalAllStudents
          : Array.from(currentStudents).sort();

        // 标记哪些学生已被删除
        const deletedStudents = new Set(
          allStudents.filter((nm) => !currentStudents.has(nm))
        );

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
              {deletedStudents.size > 0 && (
                <span style={{ fontSize: 12, color: "#999", marginLeft: 8 }}>（{deletedStudents.size} 人已删除）</span>
              )}
            </div>
            {allStudents.length === 0 ? (
              <span style={{ color: "#9C9382", fontSize: 14 }}>还没有学生</span>
            ) : (
              /* 名字建错了得能就地改掉或抹掉 —— 原来这里只是一排只读的标签，
                 建错一个名字就永远躺在名单里。 */
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {allStudents.map((nm) => {
                  const gone = deletedStudents.has(nm);
                  const editing = allEditName === nm;
                  return (
                    <div key={nm} style={{
                      display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
                      background: gone ? "#F4F1EC" : "#fff",
                      border: `1px solid ${C.border}`, borderRadius: 10, padding: "6px 10px",
                    }}>
                      {editing ? (
                        <>
                          <input
                            autoFocus
                            value={allEditVal}
                            onChange={(ev) => setAllEditVal(ev.target.value)}
                            onKeyDown={(ev) => {
                              if (ev.key === "Enter") { renameEverywhere(nm, allEditVal); setAllEditName(null); }
                              else if (ev.key === "Escape") setAllEditName(null);
                            }}
                            style={{ ...inputStyle, flex: "1 1 100px", minHeight: 40, padding: "6px 10px", fontSize: 14 }}
                          />
                          <button
                            onClick={() => { renameEverywhere(nm, allEditVal); setAllEditName(null); }}
                            style={{
                              minHeight: 40, padding: "0 12px", borderRadius: 10, border: "none",
                              background: C.bamboo, color: "#fff", fontWeight: 700, cursor: "pointer",
                            }}>保存</button>
                          <button onClick={() => setAllEditName(null)} style={{
                            minHeight: 40, padding: "0 10px", borderRadius: 10,
                            border: `2px solid ${C.border}`, background: "#fff", color: "#8A8276", cursor: "pointer",
                          }}>取消</button>
                        </>
                      ) : (
                        <>
                          <span style={{
                            flex: "1 1 80px", fontWeight: 700, fontSize: 15,
                            opacity: gone ? 0.6 : 1,
                            textDecoration: gone ? "line-through" : "none",
                          }}>
                            {nm}
                            {gone && <span style={{ fontSize: 12, color: "#9C9382", marginLeft: 8, textDecoration: "none" }}>不在任何班级</span>}
                          </span>
                          <button
                            onClick={() => { setAllEditName(nm); setAllEditVal(nm); }}
                            style={{
                              minHeight: 40, padding: "0 12px", borderRadius: 10,
                              border: `2px solid ${C.border}`, background: "#fff",
                              fontSize: 13, fontWeight: 700, color: "#8A8276", cursor: "pointer",
                            }}>✏️ 改名</button>
                          <button
                            onClick={() => setPendingPurge(nm)}
                            style={{
                              minHeight: 40, padding: "0 12px", borderRadius: 10,
                              border: `2px solid ${C.border}`, background: "#fff",
                              fontSize: 13, fontWeight: 700, color: C.red, cursor: "pointer",
                            }}>🗑️ 彻底删除</button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {pendingPurge && (
        <ConfirmDialog
          text={
            `确定彻底删除「${pendingPurge}」吗？\n\n`
            + `他会从「全部学生」和所有班级名单里消失，之后想找回来只能重新添加。\n`
            + `如果只是想把他移出某个班级，用下面班级里的「删除」就行 —— 那样名字还留在这份全部名单里。`
          }
          confirmLabel="彻底删除"
          cancelLabel="不删了"
          onCancel={() => setPendingPurge(null)}
          onConfirm={() => { const nm = pendingPurge; setPendingPurge(null); purgeStudent(nm); }}
        />
      )}

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
