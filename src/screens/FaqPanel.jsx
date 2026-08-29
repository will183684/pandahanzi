import { useState } from "react";
import { C } from "../theme";

/* ===================================================================
   常见问题 —— 登录页的「❓ 常见问题」打开这个面板。

   内容都是这个 app 真实的行为，别写成通用客服话术：
   家长最常卡在「孩子练的是哪一课」和「没声音」，老师最常卡在
   「改了内容学生怎么看不到」，这几条要说准。
   =================================================================== */

const GROUPS = [
  {
    who: "🏠 家长",
    items: [
      {
        q: "孩子的名字和邀请码从哪里来？",
        a: "都由老师提供。名字要和老师在班级名单里登记的一致；邀请码是每个班一个，问老师要。名单为空的班级，任何名字都能进。",
      },
      {
        q: "首页只有一课，之前学的去哪了？",
        a: "首页显示的是老师「正在上」的那一课。之前上过的课都在「📚 历史记录」里，点进去可以随时重做，进度照样记。",
      },
      {
        q: "六个练习一定要一次做完吗？",
        a: "不用。做完一个就点亮一颗星，随时可以退出，下次接着做。两次课之间做完就行，不限时间。",
      },
      {
        q: "做过的练习还能再做吗？",
        a: "可以，做过的会显示「⭐ 之前完成过」，重做不会把星星弄丢，做几遍都行。",
      },
      {
        q: "听不到读音怎么办？",
        a: "先看手机侧面的静音键是不是打开了 —— 网页里的声音会被它静掉。再确认音量没关到底。如果老师给这一课录了音就放老师的原声，没录的话用手机自带的朗读功能。",
      },
      {
        q: "孩子的小动物头像怎么换？",
        a: "在孩子自己的首页，点头像下面的「换个小动物 🔄」就能挑。",
      },
    ],
  },
  {
    who: "👩‍🏫 老师",
    items: [
      {
        q: "怎么给班级安排课程？",
        a: "进「📊 进度」，点「📚 布置课程」挑一节课。挑好之后孩子的首页就会变成这一课，上一节自动记为已上过（内容和录音都留着）。",
      },
      {
        q: "怎么改某一课的字、拼音或录音？",
        a: "进「📚 课程编辑」，本班的课都列在那儿，点任意一节直接改，改完点保存。这里只改内容，不会影响班级正在上哪一课。",
      },
      {
        q: "我改了内容，学生为什么看不到？",
        a: "改动是立刻生效的。如果改的不是「正在上」的那一课，孩子要在「📚 历史记录」里进那一课才看得到 —— 首页永远只显示正在上的课。",
      },
      {
        q: "我录的音，别的班能用吗？",
        a: "能。保存之后这个字的录音就进了共享库，别的老师选到同一课时会自动带上，字表里会标「📻 某某老师 配音」。本班自己录过的优先用自己的。",
      },
      {
        q: "录音上传失败怎么办？",
        a: "先看提示写的是什么。写「没有上传权限」是后台配置问题，找管理员；写别的一般是网络。录完记得点保存，不然只是暂存在这一页。",
      },
      {
        q: "同一课重新布置，之前的内容会丢吗？",
        a: "不会。同一课再布置一次是回到原来那条记录，字表、录音、孩子的进度都还在，不会新建一份空白的。",
      },
    ],
  },
  {
    who: "🔧 教务",
    items: [
      {
        q: "改了学生名字，他做过的记录还在吗？",
        a: "在。改名会同步更新这个孩子所有的练习记录，不会因为换个名字就从头开始。",
      },
      {
        q: "把学生从班级删掉，就找不回来了吗？",
        a: "不会。「全部学生」里还能看到他，显示成划掉的样子，需要的话可以重新加回班级。",
      },
      {
        q: "一个孩子可以换班吗？",
        a: "可以。在「👧 学生」里点他名字旁边的「移动到…」选目标班级。",
      },
    ],
  },
  {
    who: "💡 都看看",
    items: [
      {
        q: "打开还是旧的界面，看不到新功能？",
        a: "多半是浏览器缓存住了旧版本。页面最底下有一行版本号，可以对一下。微信里打开的话：我 → 设置 → 通用 → 存储空间 → 清理缓存，然后重新点开链接。",
      },
      {
        q: "手机上怎么用起来更顺手？",
        a: "用 Safari 或 Chrome 打开链接，「分享 → 添加到主屏幕」，之后就像一个 app 一样点开，比在微信里打开体验好。",
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
          还有别的问题？直接问孩子的老师，或者联系教务老师。
        </p>
      </div>
    </div>
  );
}
