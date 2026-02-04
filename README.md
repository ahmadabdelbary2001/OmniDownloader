# 🚀 OmniDownloader

A modern, premium, and unified media downloader built with **Tauri v2**, **React**, and **Vanilla CSS**. OmniDownloader leverages the power of `yt-dlp` and `ffmpeg` to provide a seamless, high-quality downloading experience.

## ✨ Key Features

- **🌐 Unified Search**: Powerful search capability directly within the app, providing the top 10 results from YouTube with live previews.
- **🛡️ 403-Bypass Engine**: Intelligent multi-client retry logic (web, mobile, android, ios) to bypass YouTube's "403 Forbidden" errors.
- **🎬 Single-File Output**: Integrated **FFmpeg** engine that automatically merges high-definition video and audio into a single, standard `.mp4` file.
- **📥 Batch Processing**: Support for downloading multiple links at once.
- **⚡ Smart Extraction**: Specialized support for Telegram links and site-specific direct extraction (e.g., Fuqster/BigTitBitches).
- **🚀 Premium UI/UX**: Professional dark mode interface with real-time logs and progress tracking.

## 🚀 Getting Started

### Prerequisites

- **FFmpeg**: Included in the project root for automatic merging.
- **yt-dlp**: Packaged as a sidecar for high-performance extraction.

### Installation & Running

1. Clone the repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Launch the development environment:
   ```bash
   pnpm tauri dev
   ```

## 🛠️ Project Structure

- **src/**: React Frontend logic.
  - **components/Downloader.tsx**: Core logic for searching, extracting, and downloading.
- **src-tauri/**: Rust-based backend powered by Tauri v2.
  - **capabilities/default.json**: Enhanced security settings for sidecar spawning.
  - **bin/**: Sidecar binaries (`yt-dlp`, `wget`).
- **ffmpeg.exe**: Fixed static build used for high-quality media merging.

## 🌐 Global GitHub Management
The project is configured to work with a global identity switcher (`hub` command) available in your PowerShell profile, allowing seamless switching between multiple GitHub accounts.

---
*Created with ❤️ for a superior downloading experience.*