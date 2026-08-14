import { useState, useEffect, useRef, useCallback } from "react";
import { C } from "../theme";
import { normCode } from "../utils";
import { getClasses, deleteClassRecords } from "../supabaseClient";
import { Card, BigButton, ConfirmDialog } from "../components/ui";

/* ===================================================================
   班级管理（教务）—— 新建 / 删除班级，改班名和家长邀请码。

   删班会连排课记录一起清掉（deleteClassRecords 同时删 kv 和
   class_lessons，字表和进度靠外键级联）。删的是当前所在的班时，
   直接退回登录页，否则界面会停在一个已经不存在的班上。
   =================================================================== */
export default function ClassManager({ activeClassId, onSaveClasses, onLeaveClass, pushToast }) {
  const [list, setList] = useState(null);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getClasses()
      .then((cs) => { if (alive) setList(cs.map((c) => ({ ...c, students: Array.isArray(c.students) ? c.students : [] }))); })
      .catch(() => pushToast("读取班级失败 ⚠️"));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 改班名/邀请码是逐字输入的，不能每敲一下就写一次库 —— 攒 600ms 再存。
     离开页面时把还没落地的改动补写掉，免得最后几个字丢了。 */
  const unsaved = useRef(null);
  const timer = useRef(null);

  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (unsaved.current) { onSaveClasses(unsaved.current); unsaved.current = null; }
  }, [onSaveClasses]);

  const commit = useCallback((nlist, immediate = false) => {
    setList(nlist);
    if (timer.current) clearTimeout(timer.current);
    if (immediate) { unsaved.current = null; onSaveClasses(nlist); return; }
    unsaved.current = nlist;
    timer.current = setTimeout(flush, 600);
  }, [onSaveClasses, flush]);

  useEffect(() => flush, [flush]);

  const patch = (id, key, value) => commit(list.map((c) => (c.id === id ? { ...c, [key]: value } : c)));

  const create = () => {
    const nm = newName.trim();
    const code = newCode.trim();
    if (!nm) { pushToast("请输入班级名称"); return; }
    if (!code) { pushToast("请设置家长邀请码"); return; }
    if (list.some((c) => normCode(c.invite_code) === normCode(code))) {
      pushToast("这个邀请码已被别的班用了，换一个"); return;
    }
    const cls = {
      id: "cls_" + Math.random().toString(36).slice(2, 9),
      name: nm, invite_code: code, students: [],
    };
    commit([...list, cls], true);
    setNewName(""); setNewCode("");
    pushToast(`已新建「${nm}」🏫`);
  };

  const [pending, setPending] = useState(null);

  const remove = async (cls) => {
    setPending(null);
    setBusy(true);
    try {
      commit(list.filter((c) => c.id !== cls.id), true);
      await deleteClassRecords(cls.id);
      pushToast(`「${cls.name}」已删除 🗑️`);
      if (cls.id === activeClassId && onLeaveClass) onLeaveClass();
    } catch (e) {
      pushToast("删除失败，请检查网络 ⚠️");
    }
    setBusy(false);
  };

  const inputStyle = {
    minHeight: 48, padding: "8px 12px", borderRadius: 10, fontSize: 15,
    border: `2px solid ${C.border}`, background: "#fff", boxSizing: "border-box",
  };

  if (!list) return <Card><p style={{ color: "#9C9382" }}>正在加载班级…</p></Card>;

  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>🏫 班级管理</h3>
      <p style={{ fontSize: 13, color: "#9C9382", marginTop: 0 }}>
        新建或删除班级，修改班名和家长邀请码。改了邀请码，家长要用新码才能进。
      </p>

      {/* 班级列表 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        {list.length === 0 && (
          <span style={{ color: "#9C9382", fontSize: 14 }}>还没有班级，在下面新建一个。</span>
        )}
        {list.map((c) => {
          const isCur = c.id === activeClassId;
          return (
            <div key={c.id} style={{
              border: `2px solid ${isCur ? C.bamboo : C.border}`, borderRadius: 14, padding: 12,
              background: isCur ? "#F6FBF7" : "#fff",
            }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                <input
                  value={c.name}
                  onChange={(ev) => patch(c.id, "name", ev.target.value)}
                  style={{ ...inputStyle, flex: "1 1 150px", fontWeight: 800 }}
                />
                {isCur && (
                  <span style={{ fontSize: 12, color: C.bamboo, fontWeight: 800 }}>当前所在</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: "#8A8276", fontWeight: 700 }}>邀请码</span>
                <input
                  value={c.invite_code || ""}
                  onChange={(ev) => patch(c.id, "invite_code", ev.target.value)}
                  style={{ ...inputStyle, width: 130, fontWeight: 700 }}
                />
                <span style={{ fontSize: 13, color: "#9C9382" }}>· {(c.students || []).length} 个学生</span>
                <button
                  onClick={() => setPending(c)}
                  disabled={busy}
                  style={{
                    marginLeft: "auto", minHeight: 44, padding: "0 14px", borderRadius: 10,
                    border: `2px solid ${C.red}55`, background: "#fff", color: C.red,
                    fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
                  }}
                >删除班级</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 新建 */}
      <div style={{ borderTop: `2px dashed ${C.border}`, paddingTop: 16 }}>
        <label style={{ fontWeight: 800, fontSize: 15, display: "block", marginBottom: 8 }}>＋ 新建班级</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={{ ...inputStyle, flex: "1 1 160px" }}
            value={newName} placeholder="班级名称，例如：周六中班"
            onChange={(ev) => setNewName(ev.target.value)}
          />
          <input
            style={{ ...inputStyle, flex: "0 1 150px" }}
            value={newCode} placeholder="家长邀请码"
            onChange={(ev) => setNewCode(ev.target.value)}
            onKeyDown={(ev) => ev.key === "Enter" && create()}
          />
          <BigButton color={C.bamboo} onClick={create} style={{ minHeight: 48, padding: "0 20px", fontSize: 16 }}>
            新建
          </BigButton>
        </div>
      </div>

      {pending && (
        <ConfirmDialog
          text={
            `确定删除班级「${pending.name}」吗？\n\n`
            + `会一并删除这个班的全部排课、字表、学生进度记录`
            + ((pending.students || []).length ? `（名单里还有 ${pending.students.length} 个学生）` : "")
            + `。\n字库和课程库不受影响。此操作无法撤销。`
          }
          confirmLabel="确定删除"
          cancelLabel="不删了"
          onCancel={() => setPending(null)}
          onConfirm={() => remove(pending)}
        />
      )}
    </Card>
  );
}
