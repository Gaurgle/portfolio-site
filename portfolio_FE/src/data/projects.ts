export const projects = [
  /* ============================ featured ============================ */
  {
    projectTitle: "Wireless Testing App",
    description:
      "Android app for testing Bluetooth LE and LE Audio devices. Lua scripting for custom test sequences, live GATT discovery, and real-time device communication.",
    tags: ["Kotlin", "Jetpack Compose", "BLE", "Lua", "MVVM"],
    image: ["/pictures/ble-app-1.webp", "/pictures/ble-app-2.webp"],
    link: "#",
    featured: true,
    featuredOrder: 1,
    details: {
      long:
        "Android app developed during my internship at Sigma Connectivity. It scans for Bluetooth devices, inspects GATT services and characteristics, and runs test sequences through Lua scripts.",
      highlights: [
        "Lua scripts for repeatable test sequences",
        "GATT discovery, reads, writes, and notifications",
        "A queue to sequence device operations",
        "Kotlin and Jetpack Compose"
      ],
    },
  },
  {
    projectTitle: "Wireless Test Platform",
    description:
      "Ktor backend for wireless test sessions, with PostgreSQL result storage and a Svelte dashboard for live progress.",
    tags: ["Kotlin", "Ktor", "PostgreSQL", "Docker", "Svelte", "TypeScript"],
    image: [
      "/pictures/wtp-1.webp",
      "/pictures/wtp-2.webp",
      "/pictures/wtp-3.webp",
    ],
    link: "#",
    featured: true,
    featuredOrder: 2,
    details: {
      long:
        "A Ktor API for managing wireless test sessions and storing results in PostgreSQL. A Svelte dashboard receives progress updates through server-sent events.",
      highlights: [
        "Test-session API in Kotlin",
        "Progress updates through server-sent events",
        "PostgreSQL result storage",
        "Docker setup and Svelte dashboard"
      ],
    },
  },
  {
    projectTitle: "Internal Release Pipeline",
    description:
      "Kotlin tool for preparing music releases. It locates masters, Atmos mixes, and artwork, checks a batch, and stages the files for upload. In development.",
    tags: ["Kotlin", "Gradle", "SQLite", "Compose Multiplatform", "TDD"],
    image: "/pictures/release-pipeline.webp",
    link: "#",
    wip: true,
    featured: true,
    featuredOrder: 3,
    details: {
      long:
        "I'm building this to reduce manual copying and renaming during release preparation. It reads a batch from the studio database, locates the required files, and validates the plan before copying them.",
      highlights: [
        "Validate the batch before copying files",
        "Locate masters, Atmos mixes, and artwork",
        "Tests for planning and file handling",
        "Desktop review interface in development"
      ],
    },
  },
  {
    projectTitle: "Audio Watermarking",
    description:
      "Experimental C++ audio watermarking engine. I'm exploring how to embed keyed data in audio while balancing audibility, capacity, and recovery after processing.",
    tags: ["C++20", "JUCE", "DSP", "CMake", "ATDD"],
    image: [
      "/pictures/wm-1.webp",
      "/pictures/wm-2.webp",
    ],
    link: "#",
    wip: true,
    featured: true,
    featuredOrder: 4,
    details: {
      long:
        "A C++ project exploring audio watermarking. It uses a psychoacoustic model to guide embedding strength, with tests for payload recovery after audio processing. Audibility and robustness are things to measure as the work develops.",
      highlights: [
        "Audio-dependent embedding strength",
        "Keyed payload embedding and recovery",
        "Tests for recovery after processing",
        "Comparing capacity and robustness"
      ],
    },
  },

  /* =========================== more projects =========================== */
  {
    projectTitle: "airwavez",
    description:
      "Auracast tooling in development. I'm exploring broadcast testing, coverage measurement, and transmitter tools using Zephyr, Kotlin, and Android.",
    tags: ["Zephyr", "C", "Kotlin", "Android", "LE Audio", "Auracast"],
    image: null,
    link: "#",
    wip: true,
  },
  {
    projectTitle: "noiz-kmp",
    description:
      "A mobile version of noiz in development. A draggable control adjusts the sound, with a Rust DSP core shared through UniFFI and a Compose Multiplatform interface.",
    tags: ["Kotlin Multiplatform", "Compose", "Rust", "UniFFI", "Android", "DSP"],
    image: null,
    link: "#",
    wip: true,
  },
  {
    projectTitle: "fleetz",
    description:
      "A terminal dashboard for checking several Git repositories at once: local changes, commits ahead or behind, pull requests, CI, worktrees, and stashes.",
    tags: ["Rust", "ratatui", "GitHub API", "TUI", "Git"],
    image: "/pictures/fleetz.webp",
    link: "#",
  },
  {
    projectTitle: "repoz",
    description:
      "A Bash tool for checking recently updated GitHub repositories. It fetches them in parallel and reports incoming commits, local commits, and uncommitted files.",
    tags: ["Bash", "GitHub CLI", "jq", "Git"],
    image: "/pictures/repoz.webp",
    link: "https://github.com/Gaurgle/repoz",
  },
  {
    projectTitle: "noiz",
    description:
      "A terminal sound generator with white, pink, and brown noise, binaural beats, and procedural rain. Written in Rust with live audio controls.",
    tags: ["Rust", "cpal", "ratatui", "DSP", "Audio"],
    image: "/pictures/noiz.webp",
    link: "https://github.com/Gaurgle/noiz",
    details: {
      long:
        "A Rust application that generates noise and rain sounds in real time. A terminal interface controls the sound layers and binaural beat settings.",
      highlights: [
        "Real-time stereo audio through cpal",
        "Adjustable binaural beat settings",
        "Procedurally generated rain",
        "Terminal controls built with ratatui"
      ],
    },
  },
  {
    projectTitle: "notez",
    description:
      "Notes and todos stored alongside project work, with a shared global location. I use v1 daily; notez2 adds cross-machine support and a desktop interface.",
    tags: ["Rust", "ratatui", "CLI", "Tauri", "SvelteKit"],
    image: [
      "/pictures/notez-local.webp",
      "/pictures/notez-global.webp",
      "/pictures/todoz-local.webp",
      "/pictures/todoz-global.webp",
    ],
    link: "https://github.com/Gaurgle/notez2",
    details: {
      long:
        "Project-local notes with a global copy, plus a terminal todo list with subtasks, priorities, and Vim-style navigation. The notez2 rewrite adds a desktop interface and cross-machine support.",
      highlights: [
        "Rust CLI and terminal interface",
        "Project-local notes with a global copy",
        "Subtasks and priority flags",
        "Desktop interface in the notez2 rewrite"
      ],
    },
  },
  {
    projectTitle: "stdz",
    description:
      "A terminal reference for Kotlin's standard library and Android fundamentals, with signatures, examples, and common pitfalls. Search directly or browse the entries interactively.",
    tags: ["Rust", "ratatui", "Kotlin", "CLI", "TUI"],
    image: "/pictures/stdz.webp",
    link: "#",
  },
  {
    projectTitle: "pinz",
    description:
      "A terminal board for arranging ideas and todos as notes. Supports panning, zooming, and separate boards, with the data model kept separate from the interface.",
    tags: ["Rust", "ratatui", "TUI"],
    image: "/pictures/pinz.webp",
    link: "#",
  },
  {
    projectTitle: "zalary",
    description:
      "A Swedish salary calculator in development for comparing employment and consulting income, including estimated take-home pay, employer costs, VAT, and hourly rates.",
    tags: ["Rust", "ratatui", "TUI"],
    image: "/pictures/zalary.webp",
    link: "#",
    wip: true,
  },
  {
    projectTitle: "spaze",
    description:
      "Self-hosted team chat in development, built in Rust. Includes a terminal interface, GitHub sign-in, message search, and commands for capturing notes and todos.",
    tags: ["Rust", "ratatui", "SQLite", "TUI"],
    image: null,
    wip: true,
    link: "https://github.com/Gaurgle/spaze",
  },
  {
    projectTitle: "glanze",
    description:
      "A macOS menu-bar app for checking the status of AI coding sessions. The first version supports Claude Code, with adapters planned for other tools.",
    tags: ["Swift", "macOS"],
    image: null,
    wip: true,
    link: "#",
  },
  {
    projectTitle: "AI Support Venture",
    description:
      "A business project exploring Swedish-language customer support tools for e-commerce, alongside my software work.",
    tags: ["AI", "SaaS", "Business"],
    image: null,
    link: "#",
    wip: true,
  },
  {
    projectTitle: "Portfolio",
    description:
      "This site, built with Astro, React, and Tailwind and hosted on Vercel. The repository also includes a Spring Boot and PostgreSQL backend from my DevOps coursework.",
    tags: ["Astro", "React", "Tailwind", "Kotlin", "Spring Boot", "Docker"],
    image: [
      "/pictures/portfolio-1.webp",
      "/pictures/portfolio-2.webp",
      "/pictures/portfolio-3.webp",
    ],
    link: "https://github.com/Gaurgle/portfolio-site",
    demoUrl: "https://andreasroos.vercel.app",
  },
];
