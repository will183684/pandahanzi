/* ============================== Panda ==============================
   吉祥物 —— 从品牌 logo 里裁出来的熊猫头（public/mascot.png）。

   之前这里是一只手绘 SVG 熊猫（戴贝雷帽、拿画笔），跟登录页的 logo
   是两种画风，全 app 看起来像两只不同的熊猫。现在统一用 logo 里的这只。

   传了 `avatar`（一个 emoji）就显示小朋友自己选的动物，用在学生自己的
   界面上；表头、加载中、教务弹窗等不传，保持品牌熊猫。

   `ex`（表情）保留在签名里只是为了让原有调用点不用改 —— 图片是静态的，
   表情变化没有了。跳动/脉冲之类的动画本来就由调用方用 CSS 加，不受影响。
   ================================================================== */
export default function Panda({ sz = 120, ex, avatar }) {   // eslint-disable-line no-unused-vars
  const circle = {
    display: "block",
    width: sz,
    height: sz,
    borderRadius: "50%",
    flexShrink: 0,
  };

  if (avatar) {
    return (
      <div
        style={{
          ...circle,
          background: "#FED820",          // 跟 logo 里的黄色一致
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: Math.round(sz * 0.58),
          lineHeight: 1,
          userSelect: "none",
        }}
      >
        {avatar}
      </div>
    );
  }

  return (
    <img src="/mascot.png" alt="" width={sz} height={sz} style={{ ...circle, objectFit: "cover" }} />
  );
}
