# MotionX 🎮

> **Real-Time Camera Hand-Controlled 2D Platformer Game**  
> Built purely with Vanilla HTML5, CSS3, JavaScript, and MediaPipe AI Hand Tracking. Zero framework overhead.

🌐 **Live Deployment:** [https://nishanth-1628.github.io/MotionX/](https://nishanth-1628.github.io/MotionX/)

---

## 🌟 Overview

**MotionX** is a 2D pixel-art platformer controlled using real physical hand gestures detected in real-time via your device's camera. Using on-device AI computer vision (MediaPipe Hands), players navigate obstacles, perform jumps, break blocks, and defeat glitch beetles across 20 distinct realms.

---

## ✨ Features

- 🖐️ **Dual-Hand AI Control System:**
  - **Left Hand (Attack):** Open hand to charge, close fist to strike/break blocks.
  - **Right Hand (Movement):** Point Left / Right / Up (Jump) / Down (Crouch).
  - Also includes fallback **Touch / Keyboard / Click Controls**.
- 🌌 **20 Unique Handcrafted Levels & Animated Parallax Backgrounds:**
  - **World 1 — Cyber City (Levels 1–4):** Neon Awakening, Rooftop Leap, Grid Abyss, First Contact.
  - **World 2 — Bioluminescent Nature (Levels 5–8):** Spore Caverns, Overgrowth Run, Swarm Canopy, Shifting Moss.
  - **World 3 — Underground Foundry (Levels 9–12):** Piston Core, Steam Maze, Overclock, Conveyor Hazard.
  - **World 4 — Deep Cyberspace & Retrowave (Levels 13–16):** Data Stream, Glitch Vector, Syntax Sprint, Hyperspace Beat.
  - **World 5 — Ancient Celestial Ruins (Levels 17–20):** Forgotten Nexus, Titan's Gate, Chrono Collapse, The Chrono Core.
- ❤️ **3 Lives System & Cyber Coins:** Start each level with 3 lives. Collect floating cyber coins to boost your score while navigating hazardous terrain!
- 🚩 **Holographic Checkpoint Beacons:** Strategic mid-level checkpoints save your progress in real-time. When taking damage or falling, respawn directly at your active checkpoint with force-shield invulnerability while preserving collected coins!
- 🎵 **Adaptive Chiptune Synth Audio:** Custom Web Audio API synthesizer matching level BPM and beats.
- 🏆 **Local Leaderboard & Mission Archive:** Track your scores, coins collected, and cleared levels across all 20 levels.

---

## 🚀 Running Locally

```bash
# Clone the repository
git clone https://github.com/Nishanth-1628/MotionX.git

# Navigate to the project directory
cd MotionX

# Run the local server
npm start
# or
node server.js
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔒 Privacy

All hand-tracking and camera processing occurs **100% locally** in your browser using WebAssembly. No video or webcam streams are transmitted to any server.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.