# 🌍 自转地球 · Auto-Rotating Globe

基于 Three.js (WebGL) 的自转 3D 虚拟地球。

## ✨ 功能
- 高清地球贴图（昼夜 + 法线 + 高光）+ 半透明云层
- Fresnel 蓝色大气辉光着色器
- 程序化星空背景（无需外部纹理）
- **自动自转**（右上角可开关）
- OrbitControls：拖拽旋转 / 滚轮缩放（带阻尼惯性）

## 🚀 运行
```bash
python3 -m http.server 8901   # 访问 http://localhost:8901
```

纯 Web、无构建步骤，所有依赖与贴图本地化，离线可运行。
