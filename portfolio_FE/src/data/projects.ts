export const projects = [
  /* ============================ featured ============================ */
  {
    projectTitle: "Wireless Testing App",
    description:
      "Android app for testing Bluetooth LE and LE Audio devices. Lua scripting for custom test sequences, live GATT discovery, and real-time device communication.",
    tags: ["Kotlin", "Jetpack Compose", "BLE", "Lua", "MVVM"],
    image: ["/pictures/BLE app 1.png", "/pictures/BLE app 2.png"],
    link: "#",
    featured: true,
    featuredOrder: 1,
    details: {
      long:
        "An Android app for the test bench. It connects to BLE and LE Audio devices, " +
        "walks their GATT services and characteristics live, and runs whole test " +
        "sequences from Lua scripts. Radios are unpredictable. The job of the tool is " +
        "getting repeatable results out of them anyway.",
      highlights: [
        "Lua engine drives entire test sequences",
        "Live GATT discovery with read, write and notify",
        "Serialized operation queue keeps hardware I/O deterministic",
        "Jetpack Compose on an MVVM core",
      ],
    },
  },
  {
    projectTitle: "Wireless Test Platform",
    description:
      "REST API for BLE and LE Audio test sessions and result storage. Real-time SSE events, a Svelte and TypeScript dashboard, containerized with Docker.",
    tags: ["Kotlin", "Ktor", "PostgreSQL", "Docker", "Svelte", "TypeScript"],
    image: [
      "/pictures/WTP 1 Screenshot 2026-03-31 at 23.16.18.png",
      "/pictures/WTP 2 Screenshot 2026-03-31 at 23.16.58.png",
      "/pictures/WTP 3 Screenshot 2026-03-31 at 23.18.22.png",
    ],
    link: "#",
    featured: true,
    featuredOrder: 2,
    details: {
      long:
        "The backend behind the bench. A Ktor REST API manages test sessions and stores " +
        "results in PostgreSQL, while run progress streams to a Svelte dashboard over " +
        "server-sent events. It covers the whole path from a device on the desk to a " +
        "row in the database.",
      highlights: [
        "Ktor REST API with full test-session lifecycle",
        "Live run progress over server-sent events",
        "PostgreSQL persistence, containerized with Docker",
        "Svelte and TypeScript dashboard",
      ],
    },
  },
  {
    projectTitle: "Internal Release Pipeline",
    description:
      "Kotlin engine that automates release prep for a music studio. It reads the batch from the studio's database, finds every master, Atmos and artwork file on the working volume, and stages a validated upload set.",
    tags: ["Kotlin", "Gradle", "SQLite", "Compose Multiplatform", "TDD"],
    image: "/pictures/release-pipeline.png",
    link: "#",
    wip: true,
    featured: true,
    featuredOrder: 3,
    details: {
      long:
        "Paid work for a music studio. Getting a release out meant copying and renaming " +
        "files by hand, which is slow and easy to get wrong. This engine knows where " +
        "every file lives and does it in one pass. It borrows the staging model from " +
        "Git. Build the whole plan first, validate it, and move bytes only once " +
        "everything comes back green.",
      highlights: [
        "Stage then push, so nothing copies until the batch validates",
        "Built test-first, one task at a time",
        "Resolves masters, Atmos and artwork across a studio volume",
        "Desktop review UI and a remote companion app designed on top",
      ],
    },
  },
  {
    projectTitle: "Audio Watermarking",
    description:
      "C++20 engine that hides cryptographically keyed data inside audio. Inaudible, key-dependent, and built to survive what real files go through on their way around the world.",
    tags: ["C++20", "JUCE", "DSP", "CMake", "ATDD"],
    image: [
      "/pictures/WM 1 Screenshot 2026-03-31 at 23.27.01.png",
      "/pictures/WM 2 Screenshot 2026-03-31 at 23.27.58.png",
    ],
    link: "#",
    wip: true,
    featured: true,
    featuredOrder: 4,
    details: {
      long:
        "Signal processing written from scratch. The payload goes into the audio itself, " +
        "shaped by a psychoacoustic model so the ear never finds it, and locked to a key " +
        "so nobody else can read it. Useful for proving ownership, tracing leaks, and " +
        "carrying metadata that stays with the sound instead of in a sidecar file.",
      highlights: [
        "Embedding strength adapts to the audio, so it stays inaudible",
        "Key-dependent, and undetectable without the key",
        "Acceptance-test driven against a measured listening pipeline",
        "Several encoding strategies trading capacity for robustness",
      ],
    },
  },

  /* =========================== more projects =========================== */
  {
    projectTitle: "airwavez",
    description:
      "An ecosystem of Auracast tooling on one technical spine. Auracast broadcasts audio over Bluetooth LE Audio into a space, and anyone nearby tunes in with their own earbuds, no pairing needed. Three angles that share almost all their plumbing. Validate a broadcast and map its coverage. Be the broadcast, as a venue transmitter. Run live translated comms over it. Firmware up through backend.",
    tags: ["Zephyr", "C", "Kotlin", "Android", "LE Audio", "Auracast"],
    image: null,
    link: "#",
    wip: true,
  },
  {
    projectTitle: "noiz-kmp",
    description:
      "noiz as a mobile app. One full-screen blob you drag through a tuned pink-noise and binaural soundscape, where every position sounds right and none of them sound wrong. The DSP core is a Rust crate shared across platforms through UniFFI. The UI is Compose Multiplatform.",
    tags: ["Kotlin Multiplatform", "Compose", "Rust", "UniFFI", "Android", "DSP"],
    image: null,
    link: "#",
    wip: true,
  },
  {
    projectTitle: "fleetz",
    description:
      "Multi-repo dashboard TUI, the interactive sibling of repoz. It shows commits ahead and behind, uncommitted work, open PRs, CI results, worktrees and stashes across every repo you touch. Pulls and branch cleanup are one keystroke away.",
    tags: ["Rust", "ratatui", "GitHub API", "TUI", "Git"],
    image: "/pictures/fleetz.png",
    link: "#",
  },
  {
    projectTitle: "repoz",
    description:
      "See what changed across your repos since you last sat down. It asks GitHub which repos were pushed to recently, fetches them in parallel, and prints behind, ahead, uncommitted and untracked in one shot. No config, no daemon, just bash.",
    tags: ["Bash", "GitHub CLI", "jq", "Git"],
    image: "/pictures/repoz.png",
    link: "https://github.com/Gaurgle/repoz",
  },
  {
    projectTitle: "noiz",
    description:
      "Terminal noise generator for focus. White, pink and brown noise synthesized in real time, with binaural brainwave presets and a rain layer on top. Nothing is sampled. It all comes out of the DSP.",
    tags: ["Rust", "cpal", "ratatui", "DSP", "Audio"],
    image: "/pictures/noiz.png",
    link: "https://github.com/Gaurgle/noiz",
    details: {
      long:
        "A focus tool that synthesizes its sound instead of playing it back. White, pink " +
        "and brown noise generated in real time, with binaural brainwave presets and a " +
        "rain layer, all driven from a small terminal UI.",
      highlights: [
        "Real-time stereo DSP straight to the audio device via cpal",
        "Binaural beat presets for focus, calm and deep work",
        "Procedural rain, no audio files anywhere",
        "Live parameter control from a ratatui interface",
      ],
    },
  },
  {
    projectTitle: "notez",
    description:
      "Local-first notes and todos in one Rust binary. Notes live where the work lives and mirror to a global home so nothing gets lost, and the todo TUI handles subtasks, priorities and vim-style navigation. v1 is finished and in daily use. notez2 is the cross-machine rewrite, adding a desktop app on the same core.",
    tags: ["Rust", "ratatui", "CLI", "Tauri", "SvelteKit"],
    image: [
      "/pictures/notez-local.png",
      "/pictures/notez-global.png",
      "/pictures/todoz-local.png",
      "/pictures/todoz-global.png",
    ],
    link: "https://github.com/Gaurgle/notez2",
    details: {
      long:
        "Notes that live where the work lives, in the project directory, mirrored to a " +
        "global home so nothing is ever lost. The todoz TUI handles todos with subtasks, " +
        "priorities and vim-style navigation.",
      highlights: [
        "Single static Rust binary, no runtime dependencies",
        "Personal by default, so private notes never touch the project repo",
        "Tree navigation, subtasks and colored priority flags",
        "One core, two surfaces: CLI/TUI and a Tauri desktop app",
      ],
    },
  },
  {
    projectTitle: "stdz",
    description:
      "Interactive terminal dictionary of the Kotlin standard library. Signatures, gotchas and a one-line example per entry, plus a second library of tiered Kotlin and Android fundamentals. Give it a query and it prints the answer and exits. Give it none and it opens the browser.",
    tags: ["Rust", "ratatui", "Kotlin", "CLI", "TUI"],
    image: "/pictures/stdz.png",
    link: "#",
  },
  {
    projectTitle: "pinz",
    description:
      "A spatial bulletin board in the terminal. Ideas and todos as post-it notes on a big pannable, zoomable board, with a four-level detail ladder and switchable worlds. The model and the projection math sit in a UI-agnostic crate, so one brain drives both the TUI and a desktop app.",
    tags: ["Rust", "ratatui", "TUI"],
    image: "/pictures/pinz.png",
    link: "#",
    wip: true,
  },
  {
    projectTitle: "zalary",
    description:
      "Swedish salary calculator for consulting and employment. Tell it what a number represents and it back-solves the rest of the chain, from brutto and netto through arbetsgivaravgift, moms and effektiv timlön, then rates the result against the market. Income tax is computed the way Skatteverket does it, per kommun.",
    tags: ["Rust", "ratatui", "TUI"],
    image: "/pictures/zalary.png",
    link: "#",
    wip: true,
  },
  {
    projectTitle: "spaze",
    description:
      "Terminal-first, self-hostable team chat in one static Rust binary. Inline #note and #todo capture through a slash-command parser, GitHub OAuth identity, server-side full-text search, and a TUI where mouse, vim keys and buttons are all first-class.",
    tags: ["Rust", "ratatui", "SQLite", "TUI"],
    image: null,
    wip: true,
    link: "https://github.com/Gaurgle/spaze",
  },
  {
    projectTitle: "glanze",
    description:
      "macOS menu-bar app for ambient awareness of running AI coding-agent sessions. Agent-agnostic by design. v1 supports Claude Code, and adapters for other agent CLIs drop in without touching the menu-bar app.",
    tags: ["Swift", "macOS"],
    image: null,
    wip: true,
    link: "#",
  },
  {
    projectTitle: "AI Support Venture",
    description:
      "A one-person agency selling AI customer support to Swedish e-commerce stores, run through my own AB. GDPR-safe, hosted in the EU, answering customers in Swedish around the clock. The business track running next to the engineering ones.",
    tags: ["AI", "SaaS", "Business"],
    image: null,
    link: "#",
    wip: true,
  },
  {
    projectTitle: "Portfolio",
    description:
      "This site. Astro, React and Tailwind on the front, deployed on Vercel. The containerized Spring Boot and PostgreSQL backend stays alongside as a DevOps showcase, with Flyway migrations, Docker and GitHub Actions CI.",
    tags: ["Astro", "React", "Tailwind", "Kotlin", "Spring Boot", "Docker"],
    image: [
      "/pictures/Portfolio 1 Screenshot 2026-03-31 at 20.15.34.png",
      "/pictures/Portfolio 2 Screenshot 2026-03-31 at 23.19.40.png",
      "/pictures/Portfolio 3 Screenshot 2026-03-31 at 23.18.59.png",
    ],
    link: "https://github.com/gaurgle/DevOps_Portfolio/",
    demoUrl: "https://andreasroos.vercel.app",
  },
];
