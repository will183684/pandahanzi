/* ============================== Panda ==============================
   吉祥物 —— 从品牌 logo 里裁出来的熊猫头（public/mascot.png）。

   之前这里是一只手绘 SVG 熊猫（戴贝雷帽、拿画笔），跟登录页的 logo
   是两种画风，全 app 看起来像两只不同的熊猫。现在统一用 logo 里的这只。

   `ex`（表情）保留在签名里只是为了让原有调用点不用改 —— 图片是静态的，
   表情变化没有了。跳动/脉冲之类的动画本来就由调用方用 CSS 加，不受影响。
   ================================================================== */
export default function Panda({ sz = 120, ex }) {   // eslint-disable-line no-unused-vars
  return (
    <img
      src="/mascot.png"
      alt=""
      width={sz}
      height={sz}
      style={{
        display: "block",
        width: sz,
        height: sz,
        borderRadius: "50%",
        objectFit: "cover",
        flexShrink: 0,
      }}
    />
  );
}
