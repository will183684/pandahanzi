import { useState } from "react";
import { C } from "../theme";

/* ===================================================================
   常见问题 —— 登录页的「❓ 常见问题」打开这个面板。给家长看的。

   两条原则，改内容时请守住：
     · 只写确定的事。课程安排、课包规则这些以老师给的说明为准，
       没说过的一律不写 —— 家长会当真，猜错了比不写更糟。
     · 说人话，短。家长多半是在手机上、孩子在旁边催的时候看这个。
   老师和教务那边有各自的界面和培训，不放在这儿。
   =================================================================== */

const GROUPS = [
  {
    who: "📖 上课",
    items: [
      {
        q: "一节课是怎么上的？",
        a: "一节课一小时，流程是：复习旧知 → 情境引入 → 在故事里学 10 个新字 → 知识拓展 → 重点巩固 → 五字书写 → 布置课后作业。",
      },
      {
        q: "什么时候上课？会放假吗？",
        a: "上课时间跟美国学期同步。中美两边的假期都会放假。",
      },
      {
        q: "用什么软件上课？",
        a: "用 Voov 会议。会议号在群公告里，每次上课前可以去群里看一眼。",
      },
    ],
  },
  {
    who: "✍️ 课后练习",
    items: [
      {
        q: "课后要做什么？",
        a: "在这个 App 里做当次课的练习，另外还有重点字的书写作业。两次课之间做完就行，不限具体时间。",
      },
      {
        q: "六个练习一定要一次做完吗？",
        a: "不用。做完一个点亮一颗星，随时可以退出，下次接着做。",
      },
      {
        q: "做过的练习还能再做吗？",
        a: "可以。做过的会显示「⭐ 之前完成过」，重做不会把星星弄丢，做几遍都行。",
      },
      {
        q: "首页只有一课，之前学的去哪了？",
        a: "首页显示的是正在上的那一课。之前上过的都在「📚 历史记录」里，点进去随时能重做，进度照样记。",
      },
      {
        q: "老师看得到孩子做了没有吗？",
        a: "看得到，老师在后台能实时看到每个孩子的完成情况。另外每节课开始有复习小考，课后的书写作业老师会批改并给反馈。",
      },
    ],
  },
  {
    who: "💳 课包",
    items: [
      {
        q: "画画课包和中文课包能共用吗？",
        a: "能共用。兄弟姐妹之间也可以共用同一个课包。",
      },
    ],
  },
  {
    who: "💡 使用上的问题",
    items: [
      {
        q: "孩子的名字和邀请码从哪里来？",
        a: "都问老师要。名字要和老师登记的一致，邀请码是每个班一个。",
      },
      {
        q: "听不到读音怎么办？",
        a: "先看手机侧面的静音键是不是打开了 —— 网页里的声音会被它静掉。再确认音量没关到底。老师给这一课录过音就放老师的原声，没录的话用手机自带的朗读。",
      },
      {
        q: "打开还是旧的界面，看不到新内容？",
        a: "清一下缓存再重新打开就好。微信里：我 → 设置 → 通用 → 存储空间 → 清理缓存。页面最底下有一行版本号，可以对一下是不是最新的。",
      },
      {
        q: "孩子的小动物头像怎么换？",
        a: "在孩子自己的首页，点头像下面的「换个小动物 🔄」。",
      },
      {
        q: "手机上怎么用更顺手？",
        a: "用 Safari 或 Chrome 打开链接，「分享 → 添加到主屏幕」，之后就像一个 App 一样点开，比在微信里打开顺手。",
      },
    ],
  },
];

function Item({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", textAlign: "left", minHeight: 48, padding: "12px 0",
          background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          fontSize: 15, fontWeight: 700, color: C.ink,
        }}
      >
        <span>{q}</span>
        <span style={{ color: "#B7AE9F", fontSize: 13, flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.7, color: "#6B6356" }}>{a}</p>
      )}
    </div>
  );
}

export default function FaqPanel({ onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)" }} />
      <div style={{
        position: "relative", width: "min(460px, 94vw)", height: "100%", background: C.bg,
        borderLeft: `1px solid ${C.border}`, overflowY: "auto", animation: "pa-slidein .3s ease",
        padding: 18, boxSizing: "border-box",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 6, position: "sticky", top: -18, background: C.bg, padding: "8px 0", zIndex: 2,
        }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>❓ 常见问题</h2>
          <button onClick={onClose} style={{
            minHeight: 44, minWidth: 44, borderRadius: 12, border: `2px solid ${C.border}`,
            background: "#fff", fontSize: 18, cursor: "pointer",
          }}>✕</button>
        </div>

        {GROUPS.map((g) => (
          <div key={g.who} style={{
            background: C.card, border: `2px solid ${C.border}`, borderRadius: 16,
            padding: "4px 14px 6px", marginBottom: 12,
          }}>
            <div style={{
              fontWeight: 800, fontSize: 15, color: "#8A8276",
              padding: "10px 0 2px", borderBottom: `2px solid ${C.border}`,
            }}>{g.who}</div>
            {g.items.map((it) => <Item key={it.q} {...it} />)}
          </div>
        ))}

        <p style={{ fontSize: 13, color: "#9C9382", lineHeight: 1.7, margin: "4px 0 24px" }}>
          这里没写到的，直接问孩子的老师就好 🐼
        </p>
      </div>
    </div>
  );
}
