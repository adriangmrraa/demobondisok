# VIDEO BRIEF — Explainer vertical de la demo Demobondis

You are Codex running unattended in an Orca worktree of the `demobondisok` repo.
Your job: deliver ONE finished vertical explainer video, built from REAL screen
recordings of the LIVE deployment, good enough that the client understands the
product in a single viewing and we do not need a second round of edits.

Run end to end without asking anything. Never wait for approval. Never stop to
confirm a decision — make it, verify it, document it. If something is genuinely
impossible, deliver the best working version and state the exact limitation in
the report.

---

## 1. The audience and what the video must achieve

The audience is the **company that commissioned this demo** (transport / bus
operator). They are not developers. They have to watch ~3 minutes and come away
thinking: *"this is much more than a map, this is a product, and it's already
built and running."*

Therefore the video must, in this order:

1. Show what the demo IS, with real screens, no mocks, no slides.
2. Explain the **user's path**: what a person sees when they arrive for the
   first time, what a person sees when they come back, and why the home shows
   the information it shows (that "why" is the part that makes the client feel
   the product was thought through).
3. Prove **how few taps** it takes to reach the map with a trip already chosen —
   the different entry points must be shown as different paths, not described.
4. Teach the **map**: what each element is (lines, ramales/branches, stops,
   route drawing, framing of the selected route).
5. Teach **modo viaje** (trip mode): what it is, what it shows, when the user
   uses it, what it solves.
6. Close with the dimension of what was built: it is a real deployed product on
   a production URL, not a prototype.

Tone: explanatory and confident, never hyped. Rioplatense Spanish, plain words,
short sentences. The client should feel "someone designed this", not "someone
marketed this".

---

## 2. Non-negotiable rules

- **Real screens only.** Record the LIVE site `https://demobondisok-ten.vercel.app`
  (root 307-redirects to `/inicio`). Never rebuild the UI, never fake a screen,
  never use a placeholder image where the app should be.
- **Invent nothing.** Every label, number, line name, stop name, time or claim
  that appears on screen must exist in the real UI or in the repo's real data.
  If you cannot verify something, it does not go in the video.
- **Do not modify the app.** You may only ADD files under `video/` and one
  `.gitignore` line. `src/`, `app/`, `components/`, `lib/` stay untouched.
- Follow `AGENTS.md` / `CLAUDE.md` / `DESIGN.MD` conventions of this repo.
- Conventional commits, no AI attribution. One commit per gate.
- Silent video: **no audio track at all** (no voice-over, no music).

---

## 3. Output specs

- Canvas **1080 x 1920** (9:16), **30 fps**, H.264, `yuv420p`, `+faststart`.
- Duration **3:00 to 3:50**. Never longer than 4:00. Never shorter than 2:40.
- File size **under 40 MB** (use CRF 20-23).
- Layout of every scene:
  - **Phone mock on top** — the real mobile capture. Screen area **600 x 1298 px**
    at `x=240, y=80` (preserves the 390:844 mobile aspect). Bezel 16px, border
    radius 44px, 1px `#2A2A2E` border, soft drop shadow. Slight 3D tilt is
    allowed only if it does not crop the screen.
  - **Text panel on the bottom** — safe zone `y=1470..1870`, centered,
    max width 880px. Max **3 lines per scene**, font 46-54px, line-height 1.22,
    weight 600. Plus an optional **kicker** (chapter label) 26-30px, uppercase,
    letter-spacing 0.18em, accent color, above the main text. Optional 1-line
    supporting note at 34px, 60% opacity, below.
  - **Progress bar** 4px at the very top, full width, accent color, linear.
- Style: background `#0A0A0B` with a very soft radial gradient of the real brand
  accent (8-10% opacity) and a 3% SVG grain overlay. Accent color and type
  family must come from the project's real design tokens (`DESIGN.MD`,
  `app/globals.css`, Tailwind config). No emoji anywhere. No stock imagery.
- Motion: text enters per-line with 18-frame stagger (translateY 24→0, opacity
  0→1, spring damping 200/stiffness 90), exits with a fast 10-frame fade.
  Scene transitions: 12-frame cross-dissolve with a 1.02→1.00 scale settle.
  Phone screen content must never jitter or re-scale between a tap and its
  reaction.
- Every frame must be legible on a phone screen: minimum 46px main text, strong
  contrast (>= 7:1) against the background.

---

## 4. Scene plan (target timings; adjust ±15s total, keep the order)

| # | Time | Beat | Must show (real) | Copy intent |
|---|------|------|------------------|-------------|
| 1 | 0:00-0:12 | Hook | Live app opening on the phone | What this is, one idea, no buzzwords |
| 2 | 0:12-0:32 | Qué es | Home screen, real header, real content | It's a working product on a real URL |
| 3 | 0:32-1:05 | **Usuario nuevo** | First arrival: default state, what a newcomer sees, what the home offers | Why the home shows exactly this to someone who knows nothing |
| 4 | 1:05-1:35 | **Usuario recurrente** | The returning user's path: the state that differs on the real screen | What changes for someone who comes back, and why |
| 5 | 1:35-2:10 | **Llegar al mapa** | At least 3 real entry points, each in **1 or 2 taps**, each ending with a trip already chosen | "You never fight the interface to see your bus" |
| 6 | 2:10-2:50 | **El mapa** | Lines, ramales, stops, selected route drawing, framing | What each element is, what it answers |
| 7 | 2:50-3:25 | **Modo viaje** | Trip mode active: what it shows, what it tracks | When the user turns it on and what it solves |
| 8 | 3:25-3:50 | Cierre | Pull back to the whole app, real URL on screen | The dimension of what was built |

Hard requirement on beats 3 and 4: the difference between **new** and
**recurring** must be visible on the real screen. If the app keeps no persisted
state, then show the real difference that does exist (for example: what a
first visit shows versus what the app shows after the user has selected a line /
opened a trip / come back from the map) and phrase the copy strictly in terms of
what actually happens. **Do not invent a personalization feature.** If the honest
answer is "the home adapts by showing X", say that; if there is no recurrence
state, say what the returning user actually gets (for example, geolocation-based
nearest stop) and drop the word "recurrente" from the copy. Verify first,
then write.

---

## 5. Pipeline (gates in order; commit at each gate)

### G0 — Setup
- `npm install` at the worktree root is already done or running (Orca started it).
- Create `video/` with its own `package.json` (do not touch the app's deps).
- Verify `ffmpeg`/`ffprobe` are on PATH (they are).
- Chromium already exists at `C:/Users/Asus/AppData/Local/ms-playwright`; reuse
  it, do not download new browsers unless nothing works.

### G1 — Real screen inventory (blocking; no copy before this)
Use Playwright (Headless Chromium, viewport 390x844, deviceScaleFactor 2,
isMobile, hasTouch, locale `es-AR`, timezone `America/Argentina/Cordoba`) against
the live URL and produce `video/inventory/screens-inventory.md` with:
- every route you reach (URL path) and how you reached it (which tap),
- the real visible strings per screen (headers, labels, buttons, chips, empty
  states, section titles),
- the real data shown (line names/numbers, ramal names, stop names, times) —
  copy them verbatim, do not paraphrase,
- the exact tap coordinates and tap counts between screens,
- screenshots per state in `video/inventory/shots/`.

This file is the single source of truth for all copy. Every sentence in the
script must be traceable to an entry in it.

### G2 — Script
`video/script.md`: scene, start-end, on-screen lines (max 3 per scene, max ~33
chars per line at 1080 width), the real UI string it refers to, and the real
interaction being recorded. Read it out loud mentally at 2.2 words/second: if a
line cannot be read before the scene ends, cut it.

### G3 — Captures (real app, mobile)
One browser context per scene, isolated, `recordVideo {size: 780x1688}`.
- Navigate with `waitUntil: 'networkidle'` and then wait for the MapLibre canvas
  to actually have tiles: poll screenshots until pixel variance appears (retry up
  to 3 times with a fresh context). A capture with an empty grey map is a FAILED
  capture — redo it.
- Grant `geolocation` and set a real coordinate taken from the repo's data
  (AMBA/Formosa, whichever the app serves) so "modo viaje" and any
  "cerca de mí" state are real, not empty.
- **Make the finger visible**: before every tap, inject a 40px circle
  (rgba(255,255,255,0.35) fill, 2px accent ring) at the tap point, pulse it for
  ~350ms, then `page.touchscreen.tap(x, y)` and keep the circle 250ms more. The
  viewer must always see WHERE the tap happens. Same for swipes: animate a small
  drag trail.
- Scrolling: smooth, stepped, never an instant jump.
- Save `video/capture/scene-01.webm` ... plus `video/capture/manifest.json`
  (scene, file, frames, real duration, what it shows).
- Convert each clip to H.264 mp4 before composing.
- Add `video/capture/` and `video/out/` to `.gitignore`.

### G4 — Composition (Remotion, frame-accurate)
- `npm i remotion @remotion/cli react react-dom` inside `video/` (Remotion 4.x).
- Composition id `DemobondisExplicativo`, 1080x1920, fps 30, duration computed
  from the scene table.
- Phone mock component + text panel component + chapter/kicker + progress bar +
  grain + transitions, all per section 3.
- Embed the captured clips with `<OffthreadVideo>` (trim with `startFrom`),
  never `Video` for rendering.
- Render ONE test scene first (`--frames=0-120`) and look at the PNG output
  before rendering all 8. Fix layout there, not after a full render.
- Full render:
  `npx remotion render DemobondisExplicativo out/demobondis-explicativo-vertical.mp4 --codec h264 --crf 21 --pixel-format yuv420p --concurrency 4`
- If Remotion cannot be installed or rendered after a real attempt, fall back to
  an HTML/CSS/JS timeline page recorded in real time with Playwright at
  1080x1920 and converted with ffmpeg. Say so in the report.

### G5 — Automatic QA (mandatory, minimum TWO rounds)
1. `ffprobe` and assert: 1080x1920, 30 fps, duration 160-230s, size < 40 MB,
   codec h264, pixel format yuv420p, **no audio stream**.
2. Extract 14 frames spread across the video (`-vf fps=1/12` plus each scene
   boundary) at full resolution into `video/qa/frames/`.
3. **Look at every frame** (open the PNGs). Check these defect classes and fix
   any that appear, then re-render:
   - phone screen blank, grey or showing a loading state
   - map without tiles, or map pan/zoom caught mid-animation
   - text clipped at edges, overflowing the safe zone, or overlapping the phone
   - tap indicator missing at the exact moment of a tap
   - distorted aspect ratio or letterboxing inside the phone
   - a frame caught mid-transition with unreadable double text
   - contrast below 4.5:1 on any text
4. Round 2 (and 3 if needed): re-render, re-extract, re-check. The video is done
   when a full pass shows zero defects. Report how many rounds it took.

### G6 — Delivery
- `video/entrega/demobondis-explicativo-vertical.mp4` (the final file)
- `video/entrega/poster.jpg` (a representative frame, real, not a title card)
- `video/script.md`, `video/inventory/screens-inventory.md`
- `video/README.md` with the exact regeneration commands
- `video/entrega/REPORTE.md`: scene table with real durations, the list of real
  UI strings quoted in the video (traceability), QA rounds and defects fixed,
  and anything you could not verify or had to drop.

---

## 6. Final report (this is what I read; make it exact)

- Absolute path + size of the final MP4.
- The real `ffprobe` output line (width/height/fps/duration/codec/size/audio).
- Scene table: scene → real duration.
- How many QA rounds, and which defects were found and fixed.
- The exact commands to re-render.
- What you could NOT verify and therefore left out of the video.

Claim nothing you did not check with a command or a looked-at frame.
