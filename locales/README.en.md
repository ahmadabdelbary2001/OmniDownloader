# 📥 **OmniDownloader**
> _An advanced desktop application for lightning-fast video downloading and media processing, combining the high performance of a Rust backend with a flexible React user interface._

<div align="center">
  <img src="https://img.shields.io/badge/Language-English-blue?style=flat-square" alt="English">
  <a href="#">English Version</a> |
  <img src="https://img.shields.io/badge/Language-Arabic-green?style=flat-square" alt="Arabic">
  <a href="../README.md">Arabic Version</a>
</div>

---

## 📖 **Overview**
> _OmniDownloader is the ultimate tool to grab web videos in a single click through its custom browser extension. It utilizes low-level sidecar integrations for precision media extraction and incorporates Google Gemini AI for smart transcript summarization._

---

## 📋 **Table of Contents** <a id="toc"></a>
1. [✨ Key Features](#features)
2. [💻 Tech Stack](#tech-stack)
3. [🚀 Getting Started](#getting-started)
4. [🤖 AI Summaries (Gemini)](#gemini-ai)
5. [🔌 HTTP Server Integration](#http-server)
6. [📁 Project Structure](#project-structure)
7. [📜 License](#license)

---

## ✨ **Key Features** <a id="features"></a>
- **🔗 Custom Browser Extension**: Sends video URLs directly from your browser context menu via a native HTTP server.
- **⚡ Supercharged Performance**: Asynchronous native media handling using `yt-dlp` and `FFmpeg` through Rust.
- **✨ Intelligent Summarization**: Auto-extracts subtitles and uses Google Gemini AI to generate readable local language summaries.
- **🛡️ Clean UI Design**: Flawless, responsive user experience backed by React and TailwindCSS.

<div align="center">
  <a href="#toc">🔝 Back to Top</a>
</div>

---

## 💻 **Tech Stack** <a id="tech-stack"></a>
- **Tauri 2.0 & Rust**: Core engine powering the HTTP local server, sidecar management, and file systems.
- **React & TypeScript**: Interactive frontend architecture for desktop rendering.
- **TailwindCSS**: Rapid and gorgeous styling methodology.
- **Gemini AI API**: Next-gen text and data summarization for transcripts.
- **yt-dlp & FFmpeg**: Binaries doing the heavy lifting under the hood.

<div align="center">
  <a href="#toc">🔝 Back to Top</a>
</div>

---

## 🚀 **Getting Started** <a id="getting-started"></a>

### Prerequisites
- [x] **Node.js (v18+)**
- [x] **Rust (Stable)**
- [x] **pnpm** (Installed globally)

### Installation Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/Ahmad-J-Bary/omni-downloader.git
   cd OmniDownloader
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Launch development server:
   ```bash
   pnpm tauri dev
   ```

<div align="center">
  <a href="#toc">🔝 Back to Top</a>
</div>

---

## 🤖 **AI Summaries (Gemini)** <a id="gemini-ai"></a>
More than just a downloader! By natively connecting to Gemini AI, the app automatically fetches original video transcripts through Rust and processes them directly via Google's AI API, generating an elegant summary for extensive videos.

<div align="center">
  <a href="#toc">🔝 Back to Top</a>
</div>

---

## 🔌 **HTTP Server Integration** <a id="http-server"></a>
A highly optimized `tiny_http` local server runs securely inside the native application on port `7433`. The enclosed browser extension silently handshakes with this native server to bridge the gap between browsing and downloading invisibly.

<div align="center">
  <a href="#toc">🔝 Back to Top</a>
</div>

---

## 📁 **Project Structure** <a id="project-structure"></a>
 ```bash
 OmniDownloader/
 ├── extension/            # Custom Browser extension source files
 ├── src/                  # React UI files
 ├── src-tauri/            # Rust Backend engine
 │   ├── src/lib.rs        # HTTP server bindings and HTTP/AI endpoints
 │   └── tauri.conf.json   # Build and security configs
 └── locales/              # Documentation in multiple languages
 ```

<div align="center">
  <a href="#toc">🔝 Back to Top</a>
</div>

---

## 📜 **License** <a id="license"></a>
This project is licensed under the MIT License. See the `LICENSE` file for details.

<div align="center">
  <a href="#toc">🔝 Back to Top</a>
</div>

<p align="center"> Developed with ❤️ by <a href="https://github.com/Ahmad-J-Bary">@Ahmad Abdelbary</a> </p>
