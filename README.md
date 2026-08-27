<div align="center">

# 🏏 ScoreMaster Pro
### *The Ultimate Modern Live Cricket Scoring & Analytics Suite*

![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![Offline](https://img.shields.io/badge/PWA-Offline%20Ready-10b981?style=for-the-badge)

<p align="center">
  A high-performance, feature-rich web application built for local matches, gully cricket, club tournaments, and professional leagues. Featuring ball-by-ball live scoring, automated official PDF scorecard exports, 3D fairplay coin toss, team captain badges, customizable extra run rules, and complete offline IndexedDB auto-saving.
</p>

</div>

---

## ✨ Features at a Glance

### ⚡ Live Ball-by-Ball Scoring Engine
- **Instant Scoring Controls**: Tap 0, 1, 2, 3, 4 (Boundary 🔥), and 6 (Sixer 🚀).
- **Extra Runs & Custom Rules**: Support for Wides (+1), No-Balls (+1), Byes, Leg Byes, and Penalty runs.
- **Free Hit Tracking**: Automatic `⚡ FREE HIT IN PROGRESS` banner on No-Balls (batter can only be out by Run Out).
- **Innings & Over Workflows**:
  - Initial Opener Modal: Prompts selection of Striker, Non-Striker, and Opening Bowler.
  - Over Completion Modal: Prompts selection of the next bowler after every 6 legal deliveries.
  - 1st Innings Summary: Displays 1st Innings total and calculated Target for 2nd Innings.
- **Undo & Redo Engine**: Rebuilds entire innings figures dynamically without corrupting statistics.
- **Red "End Match" Button**: Easily terminate a match early with immediate saving to history.

### 👑 Squad Roster & Captain Management
- Custom team names, squad size selection (2 to 11+ players per team), and player roles (*Batter, Bowler, All-rounder, Wicketkeeper*).
- **Captain Selection**: Assign team captains with a single click, displaying `👑 (C)` badges across scorecards and commentary.

### 🪙 Fairplay 3D Animated Coin Toss
- Physical 3D animated coin flip built with CSS 3D transforms.
- Accurate 50/50 randomized physics engine ensuring unbiased Heads or Tails results.
- Interactive decision selector (*Elect to Bat / Elect to Bowl*).

### 📄 Professional PDF Scorecards & Social Sharing
- **1-Click PDF Generation**: Hidden iframe print stream that bypasses browser popup blockers completely.
- **Full Match Reports**: Generates a clean printable document containing:
  - 1st Innings Batting & Bowling Tables
  - 2nd Innings Batting & Bowling Tables
  - Extras Breakdown & Toss Result
  - Official Winner Banner
- **Social Sharing**: Web Share API integration with clipboard copy fallback.

### 🏠 Landing Dashboard & Match History
- **Home Landing View**: Hero banner, quick stats, quick start match action buttons, and recent match showcase cards.
- **Match History Archive**:
  - Sorted by creation date descending.
  - One-click **Resume Live Match** for ongoing games.
  - View full scorecards, export PDFs, share results, or delete past matches.

### 🎨 Modern UI & Offline First Architecture
- Glassmorphic card design with custom input glowing rings, status badges, and spring animations.
- **Dark & Light Mode**: Seamless theme toggling tailored for daylight ground conditions or night reading.
- **100% Offline Capability**: Uses IndexedDB for client-side persistence, JSON import/export backup, and CSV raw data exports.
- **Confetti Victory Celebrations**: Built-in canvas particle fireworks animation with trophy bounce upon match conclusion (includes a close cross button `X` for smooth navigation).

---

## 🛠️ Tech Stack

- **Frontend Framework**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Storage**: Browser `IndexedDB` API
- **Animations**: HTML5 Canvas Particle Confetti & CSS 3D Transforms

---

## 🚀 Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) (v18 or higher) installed on your machine.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/scoremaster.git
   cd scoremaster
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open in browser**:
   Navigate to `http://localhost:5173` to start scoring!

---

## 📦 Building for Production

To build the project for deployment:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

---

## 🌐 Deploying to GitHub Pages

1. In `vite.config.ts`, set the `base` path to match your GitHub repository name:
   ```typescript
   export default defineConfig({
     base: '/scoremaster/',
     plugins: [react()]
   })
   ```

2. Push your project to GitHub:
   ```bash
   git add .
   git commit -m "Deploy ScoreMaster Pro"
   git push origin main
   ```

3. Go to your GitHub Repository ➔ **Settings** ➔ **Pages**.
4. Under **Build and deployment** ➔ **Source**, select **GitHub Actions** (or deploy via [Vercel](https://vercel.com) / [Netlify](https://netlify.com)).

---

## 📁 Project Structure

```
ScoreMaster/
├── public/              # Static assets & PWA service worker
├── src/
│   ├── main.tsx         # Main Application Entry, Views & Scoring Logic
│   └── styles.css       # Custom Glassmorphic CSS & Layout Styling
├── index.html           # HTML Entry Point
├── package.json         # Dependencies and Scripts
├── vite.config.ts       # Vite Configuration
└── README.md            # Documentation
```

---

## 📄 License

This project is licensed under the **MIT License** - feel free to use, modify, and distribute for your own leagues and matches.

---

<div align="center">
  <sub>Built with ❤️ for Cricket Enthusiasts Worldwide</sub>
</div>
