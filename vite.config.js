import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* 打包时间打进包里，页脚显示。
   手机上（尤其微信内置浏览器）缓存住旧版是常事，有这个才能一眼分清
   「功能没发上去」还是「你这台设备拿的是旧包」。 */
const BUILD_TIME = new Date().toISOString().slice(0, 16).replace("T", " ");

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist" },
  define: { __BUILD_TIME__: JSON.stringify(BUILD_TIME) },
});
