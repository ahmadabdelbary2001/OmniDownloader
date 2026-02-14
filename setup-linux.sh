#!/bin/bash
echo "🚀 Setting up OmniDownloader for Linux..."

# 1. Install Dependencies
echo "📦 Installing Node dependencies..."
if command -v corepack &> /dev/null; then
    corepack enable
    corepack pnpm install
else
    echo "❌ corepack not found. Please install pnpm manually: npm i -g pnpm && pnpm install"
fi

# 2. Setup Binaries
echo "🔧 Setting up binaries..."
mkdir -p src-tauri/bin

# yt-dlp
if [ ! -f src-tauri/bin/ytdlp-x86_64-unknown-linux-gnu ]; then
    echo "📥 Downloading yt-dlp..."
    wget "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux" -O src-tauri/bin/ytdlp-x86_64-unknown-linux-gnu
    chmod +x src-tauri/bin/ytdlp-x86_64-unknown-linux-gnu
else
    echo "✅ yt-dlp already exists."
fi

# ffmpeg
if [ ! -f src-tauri/bin/ffmpeg-x86_64-unknown-linux-gnu ]; then
    echo "📥 Downloading ffmpeg (this may take a while)..."
    wget -O ffmpeg.tar.xz "https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-amd64-static.tar.xz"
    tar -xvf ffmpeg.tar.xz
    mv ffmpeg-git-*-amd64-static/ffmpeg src-tauri/bin/ffmpeg-x86_64-unknown-linux-gnu
    rm -rf ffmpeg.tar.xz ffmpeg-git-*-amd64-static
    chmod +x src-tauri/bin/ffmpeg-x86_64-unknown-linux-gnu
else
    echo "✅ ffmpeg already exists."
fi

# wget
if [ ! -f src-tauri/bin/wget-x86_64-unknown-linux-gnu ]; then
    echo "🔗 Symlinking wget..."
    ln -sf $(which wget) src-tauri/bin/wget-x86_64-unknown-linux-gnu
else
    echo "✅ wget already set up."
fi

echo "✅ Setup complete! Run 'pnpm tauri dev' to start."
