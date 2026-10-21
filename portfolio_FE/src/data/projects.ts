export const projects = [
  /* ============================ featured ============================ */
  {
    projectTitle: "Bluetooth Test App",
    description:
      "An Android workbench for inspecting Bluetooth LE devices and testing how they behave. Engineers can explore services, read LE Audio capabilities, and write repeatable tests in Lua without changing the app.",
    tags: ["Kotlin", "Jetpack Compose", "BLE", "Lua", "MVVM"],
    image: ["/pictures/ble-app-1.webp", "/pictures/ble-app-2.webp"],
    link: "#",
    featured: true,
    featuredOrder: 1,
    details: {
      long:
        "Built at Sigma Connectivity for engineers testing Bluetooth devices. The app brings device discovery, GATT inspection, live data, and scripted tests into one place. I designed the Lua API so testers could define their own sequences, and implemented LE Audio capability parsing to make the device's advertised audio support readable.",
      highlights: [
        "Write new tests without a new app release",
        "Inspect services and read live device data",
        "Decode LE Audio capabilities",
        "Run repeatable Lua test sequences"
      ],
    },
  },
  {
    projectTitle: "Bluetooth Test Platform",
    description:
      "A shared view of devices, test scripts, and results from the Bluetooth Test App. Follow a running test in the browser and return to its results afterwards.",
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
        "Testing doesn't end on the phone. The platform keeps sessions and results together, associates scripts with devices, and lets engineers follow progress from a web dashboard. I worked on the Ktor backend and Svelte interface, with PostgreSQL for test history and server-sent events for live updates.",
      highlights: [
        "Follow test activity from the browser",
        "Keep results linked to devices and sessions",
        "Manage and assign test scripts",
        "Revisit results after a run"
      ],
    },
  },
  {
    projectTitle: "Studio Tools",
    description:
      "Internal software for IMRSV Music, helping colleagues find information and reducing repetitive production work. Part of my wider responsibility for the studio's tools, services, and IT.",
    tags: ["Kotlin", "API integrations", "Automation", "Internal tools"],
    image: "/pictures/release-pipeline.webp",
    link: "#",
    wip: true,
    // The screenshot is a mockup, not the live tool.
    mockup: true,
    featured: true,
    featuredOrder: 3,
    details: {
      long:
        "At IMRSV, I can see where software would help because I work with the same systems as the people using it. I build tools and integrations to make information easier to reach and reduce manual work. Some services are running today; the production-automation tooling is still being developed.",
      highlights: [
        "Easier access to information across systems",
        "Automation of repetitive production work",
        "Integrations with existing tools",
        "Internal services and ongoing development"
      ],
    },
  },
  {
    projectTitle: "Audio Watermarking",
    description:
      "Experimental watermarking for tracing copies of unreleased music. The aim is to identify which copy a recording came from, even after processing, without changing what a listener hears.",
    tags: ["DSP", "Psychoacoustics", "JUCE / C++"],
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
        "Once an audio file has been shared, a filename or metadata tag can disappear. This project explores putting an identifier in the sound itself, with a different mark for each recipient. I defined the threat model, signal design, and psychoacoustic requirements; coding agents implement the C++/JUCE application. Recovery after trimming and compression remains part of the research.",
      highlights: [
        "Recipient-specific identifiers carried in the audio",
        "Embedding strength guided by the sound",
        "Listening and recovery tests",
        "Experimental leak-tracing application"
      ],
    },
  },

  /* =========================== more projects =========================== */
  {
    projectTitle: "airwavez",
    description:
      "Designing tools for putting Auracast into practice: checking broadcasts, mapping their coverage, and managing shared audio in a venue. An early LE Audio project connecting my interests in sound, devices, and systems.",
    tags: ["LE Audio", "Auracast", "System design"],
    image: null,
    link: "#",
    wip: true,
  },
  {
    projectTitle: "noiz-kmp",
    description:
      "Exploring a touch-controlled soundscape: move a single control to change the character of the sound. An Android prototype with a Rust audio engine, bringing noiz's noise and binaural tones to a different kind of interface.",
    tags: ["Kotlin Multiplatform", "Compose", "Rust", "UniFFI", "Android", "DSP"],
    image: null,
    link: "#",
    wip: true,
  },
  {
    projectTitle: "fleetz",
    description:
      "Keep track of work spread across repositories and machines. A live terminal dashboard for uncommitted changes, incoming commits, pull requests, and CI, with branches and worktrees close at hand.",
    tags: ["Rust", "ratatui", "GitHub API", "TUI", "Git"],
    image: "/pictures/fleetz.webp",
    link: "#",
  },
  {
    projectTitle: "repoz",
    description:
      "Pick up where you left off, even on another machine. One command shows which repositories need pulling, which have unpushed commits, and where you've left unfinished changes.",
    tags: ["Bash", "GitHub CLI", "jq", "Git"],
    image: "/pictures/repoz.webp",
    link: "https://github.com/Gaurgle/repoz",
  },
  {
    projectTitle: "noiz",
    description:
      "Noise in your terminal. White, pink, or brown noise synthesised live, with optional binaural tones and rain on top. Set a timer and leave it playing while you work.",
    tags: ["Rust", "cpal", "ratatui", "DSP", "Audio"],
    image: "/pictures/noiz.webp",
    link: "https://github.com/Gaurgle/noiz",
    details: {
      long:
        "A small noise generator that stays in the terminal. White, pink, and brown noise are synthesised live, with binaural tones and rain recordings as optional layers, each adjusted on its own. A timer fades it out when you're done.",
      highlights: [
        "White, pink, and brown noise, synthesised live",
        "Independently adjustable layers",
        "Optional binaural tones and rain recordings",
        "Timed playback with a fade-out"
      ],
    },
  },
  {
    projectTitle: "notez",
    description:
      "Keep notes close to a project without making every note part of its repository. Private notes, shared notes, scratch work, and todos, searchable from the terminal and portable across machines.",
    tags: ["Rust", "CLI", "TUI", "Local-first"],
    image: [
      "/pictures/notez-local.webp",
      "/pictures/notez-global.webp",
      "/pictures/todoz-local.webp",
      "/pictures/todoz-global.webp",
    ],
    link: "https://github.com/Gaurgle/notez",
    details: {
      long:
        "I wanted project notes without having to choose between scattering them everywhere and committing everything to the repo. notez separates private, shared, scratch, and global notes, then brings them into one searchable view. It also includes a todo manager. The same core supports epoz, its companion desktop app.",
      highlights: [
        "Private notes stay outside shared project repos",
        "Search across projects and note locations",
        "Todos with tags and subtasks",
        "Portable between machines"
      ],
    },
  },
  {
    projectTitle: "stdz",
    description:
      "Look up a Kotlin function or Android concept without breaking out of the terminal. Searchable signatures, examples, and common mistakes, with quick command-line answers or an interactive reference to browse.",
    tags: ["Rust", "ratatui", "Kotlin", "CLI", "TUI"],
    image: "/pictures/stdz.webp",
    link: "#",
  },
  {
    projectTitle: "pinz",
    description:
      "A corkboard for the terminal. Move ideas and todos around, zoom out to see the groups, or zoom in to edit a note. Boards live in your own Git repository and can travel between machines.",
    tags: ["Rust", "ratatui", "TUI"],
    image: "/pictures/pinz.webp",
    link: "#",
  },
  {
    projectTitle: "zalary",
    description:
      "Work backwards from a salary, take-home amount, or invoice to see how the numbers relate. A terminal calculator for comparing Swedish employment and consulting scenarios, including taxes, company costs, and working hours.",
    tags: ["Rust", "ratatui", "TUI"],
    image: "/pictures/zalary.webp",
    link: "#",
    wip: true,
  },
  {
    projectTitle: "spaze",
    description:
      "A self-hosted chat experiment for people who work in the terminal. The prototype supports live conversations; the broader idea is to keep project discussion, notes, and todos together.",
    tags: ["Rust", "ratatui", "SQLite", "TUI"],
    image: null,
    wip: true,
    link: "https://github.com/Gaurgle/spaze",
  },
  {
    projectTitle: "glanze",
    description:
      "See which coding agents are working and which need your attention, without checking each terminal. A macOS menu-bar app, starting with Claude Code. Early development.",
    tags: ["Swift", "macOS"],
    image: null,
    wip: true,
    link: "#",
  },
  {
    projectTitle: "Support Tools",
    description:
      "An early business exploration of Swedish-language customer support for online shops, using existing chatbot services. Demo-stage work on the offer and setup.",
    tags: ["AI", "SaaS", "Business"],
    image: null,
    link: "#",
    wip: true,
  },
  {
    projectTitle: "This Site",
    description:
      "An experiment in making a page feel like a place. A WebGL sky, light, and scroll-driven motion built around the work you're reading. Astro and React underneath; a small terminal hidden inside.",
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
