# 📥 **OmniDownloader**
> _تطبيق مكتبي متقدم لتحميل الفيديوهات ومعالجة الوسائط المتعددة بسرعة فائقة، يدمج بين كفاءة Rust في الواجهة الخلفية ومرونة React في واجهة المستخدم._

<div align="center">
  <img src="https://img.shields.io/badge/Language-English-blue?style=flat-square" alt="English">
  <a href="locales/README.en.md">English Version</a> |
  <img src="https://img.shields.io/badge/Language-Arabic-green?style=flat-square" alt="Arabic">
  <a href="#">النسخة العربية</a>
</div>

---

## 📖 **نظرة عامة**
> _يعد OmniDownloader الأداة المثلى لالتقاط مقاطع الفيديو من الإنترنت بنقرة واحدة بفضل إضافة المتصفح الخاصة به. يعتمد التطبيق على معالجات Native Sidecars لاستخراج الميديا بدقة عالية وتوفير ملخصات فيديو باستخدام الذكاء الاصطناعي._

---

## 📋 **قائمة المحتويات** <a id="toc"></a>
1. [✨ المميزات الرئيسية](#features)
2. [💻 التقنيات المستخدمة](#tech-stack)
3. [🚀 ابدأ الآن](#getting-started)
4. [🤖 التلخيص بالذكاء الاصطناعي (Gemini AI)](#gemini-ai)
5. [🔌 التكامل عبر خادم HTTP](#http-server)
6. [📁 هيكلية المشروع](#project-structure)
7. [📜 التراخيص](#license)

---

## ✨ **المميزات الرئيسية** <a id="features"></a>
- **🔗 إضافة متصفح مخصصة**: إرسال الروابط فوراً من المتصفح إلى البرنامج عبر خادم HTTP مدمج.
- **⚡ أداء فائق**: استخراج وتحميل متزامن للبيانات من خلال `yt-dlp` و `FFmpeg` محلياً عبر Rust.
- **✨ التلخيص الذكي**: سحب نصوص الحوار (Subtitles) في الفيديو وتلخيصها فورياً وبلغات متعددة محلياً عبر Gemini AI.
- **🛡️ موثوق وتجاوبي**: واجهة سلسة وبسيطة مصممة بعناية باستخدام React و TailwindCSS لراحة المستخدم.

<div align="center">
  <a href="#toc">🔝 العودة للأعلى</a>
</div>

---

## 💻 **التقنيات المستخدمة** <a id="tech-stack"></a>
- **Tauri 2.0 & Rust**: المحرك الأساسي والخادم الداخلي لإدارة الذاكرة والـ Sidecars.
- **React & TypeScript**: تصميم التجربة الرسومية للتطبيق المستقل وإضافة المتصفح.
- **TailwindCSS**: بناء واجهة تفاعلية وعصرية.
- **Gemini AI API**: توليد ملخصات احترافية من النصوص المستخرجة للفيديو.
- **yt-dlp & FFmpeg**: المحركات المسؤولة عن تحليل وتحميل ومعالجة الفيديو الخلفية.

<div align="center">
  <a href="#toc">🔝 العودة للأعلى</a>
</div>

---

## 🚀 **ابدأ الآن** <a id="getting-started"></a>

### المتطلبات الأساسية
- [x] **Node.js (v18+)**
- [x] **Rust (Stable)**
- [x] **pnpm** (مثبت عالمياً)
- [x] توافر `ffmpeg` و `yt-dlp` كـ sidecars في مسار المشروع.

### خطوات التثبيت
1. استنساخ المستودع:
   ```bash
   git clone https://github.com/Ahmad-J-Bary/omni-downloader.git
   cd OmniDownloader
   ```

2. تثبيت الحزم:
   ```bash
   pnpm install
   ```

3. تشغيل التطبيق في وضع التطوير:
   ```bash
   pnpm tauri dev
   ```

<div align="center">
  <a href="#toc">🔝 العودة للأعلى</a>
</div>

---

## 🤖 **التلخيص بالذكاء الاصطناعي (Gemini AI)** <a id="gemini-ai"></a>
لا يقوم OmniDownloader بالتحميل فحسب! بفضل التكامل المتقدم مع Gemini AI، يقوم التطبيق بتحميل نص الفيديو الأصلي، وتمريره في الخلفية عبر واجهة Google AI API، لينتج لك ملخصاً شاملاً لما يدور في الفيديو مقروءاً بلغتك!

<div align="center">
  <a href="#toc">🔝 العودة للأعلى</a>
</div>

---

## 🔌 **التكامل عبر خادم HTTP المدمج** <a id="http-server"></a>
يتم تشغيل خادم `tiny_http` خفيف جداً على المنفذ `7433` مكتوب بالكامل بلغة Rust ويدمج في البرنامج الأصلي. تقوم إضافة المتصفح المستقلة في المجلد `extension/` بالتحدث مع هذا الخادم لتحميل المحتوى بنقرة الزر الأيمن.

<div align="center">
  <a href="#toc">🔝 العودة للأعلى</a>
</div>

---

## 📁 **هيكلية المشروع** <a id="project-structure"></a>
 ```bash
 OmniDownloader/
 ├── extension/            # شيفرة وكود إضافة المتصفح (Browser Extension)
 ├── src/                  # واجهة المستخدم الخاصة بالتطبيق (React)
 ├── src-tauri/            # المحرك الخلفي المبني بلغة Rust
 │   ├── src/lib.rs        # يحتوي على تعريف الخادم HTTP والـ Sidecars
 │   └── tauri.conf.json   # إعدادات التطبيق والأذون المسموحة
 └── locales/              # التوثيق والترجمة لمختلف اللغات
 ```

<div align="center">
  <a href="#toc">🔝 العودة للأعلى</a>
</div>

---

## 📜 **التراخيص** <a id="license"></a>
هذا المشروع مرخص بموجب رخصة MIT. راجع ملف `LICENSE` لمزيد من المعلومات.

<div align="center">
  <a href="#toc">🔝 العودة للأعلى</a>
</div>

<p align="center"> تم التطوير بكل ❤️ بواسطة <a href="https://github.com/Ahmad-J-Bary">@Ahmad Abdelbary</a> </p>