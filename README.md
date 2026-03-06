# 🚀 OmniDownloader v2.5.0
**A Professional, Multi-Platform Media Downloader Hub**

[Arabic Version 🌐](./README.ar.md)

---

## 🌐 Overview

OmniDownloader is a premium, high-performance media downloading solution built with **Tauri v2**, **React**, and **Rust**. It provides a unified, sleek interface for searching, analyzing, and downloading high-quality media from YouTube, Telegram, and 1000+ other sites. The project follows **Atomic Design** principles and utilizes a robust hook-based logic for efficiency and scalability.

---

## ✨ Key Features

- **📥 Batch Processing**: Support for downloading multiple links simultaneously.
- **⚡ Smart Extraction**: Specialized support for Telegram links and 1000+ websites via `yt-dlp`.
- **🧩 Browser Extension**: Integrated extension for seamless extraction directly from your browser.
- **🎨 Premium UI/UX**: Professional dark mode interface optimized with Tailwind CSS and Framer Motion.
- **🏗️ Atomic Architecture**: Highly organized component structure (Atoms, Molecules, Organisms).
- **📋 Real-time Logs**: Live tracking of download progress and system activities.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Radix UI.
- **Backend**: Rust (Tauri v2), Sidecar Binaries (`yt-dlp`, `wget`).
- **Media Engine**: FFmpeg (Integrated for high-quality merging).
- **State Management**: Custom Hooks & React Context.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: (pnpm recommended)
- **Rust Toolchain**: Required for Tauri compilation.
- **FFmpeg**: Included in the project root.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/ahmadabdelbary2001/OmniDownloader.git
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Run in development mode:
   ```bash
   pnpm tauri dev
   ```

---

## 📂 Project Structure

- **`src/`**: React Frontend logic (Atomic Design).
  - **`components/`**: UI components divided into Atoms, Molecules, and Organisms.
  - **`hooks/`**: Core logic (Download Engine, Process Manager, Link Analyzer).
- **`src-tauri/`**: Rust backend and configuration.
  - **`bin/`**: Sidecar binaries for Windows (`yt-dlp`, `wget`).
- **`extension/`**: Chrome/Edge browser extension source code.
- **`ffmpeg.exe`**: Pre-built static binary for media processing.

---

## 🌐 Global GitHub Management
The project is configured to work with a global identity switcher (`hub` command) available in your PowerShell profile, allowing seamless switching between multiple GitHub accounts.

---
*Created with ❤️ by Ahmad Abdelbary for a superior downloading experience.*