# Portfolio copy, second direction

Draft: 19 October 2026. Proposed copy only; the website is unchanged. This is an alternative to `portfolio-copy-refresh.md`, which remains available for comparison. Use this document as a complete copy direction, not a set of additions to the first draft.

## Direction: a personal introduction, followed by the work

The first draft was accurate but too explanatory. Too many paragraphs tried to turn each fact into a lesson about being a developer. This version gives the reader more room: shorter introductions, concrete interests, compact project descriptions, and a little dry humour where the site already invites it.

The central impression should be: Andreas writes software, has an interesting working history, and makes a lot of things because he wants to use them. Let those facts carry the personality.

### Revision after personal feedback

This version incorporates Andreas's corrections: lifelong music involvement, drums from age four, the distinction between professional work from 2009 and later credits, current mixing and mastering, and the smaller role of Code Boss. His role at IMRSV is Head of Technology, alongside mixing and mastering. The narrative follows the connection from audio systems to software study, Android/Bluetooth work, and broad studio IT responsibility. Project descriptions now lead with purpose and distinguishing behaviour. Testing practices and library names appear only where they explain something material.

### Portfolios reviewed

These observations concern their writing, not their layouts. Pages checked on 19 October 2026. No wording from these portfolios is used in the proposed copy.

| Reference | What works in the writing | Application here |
| --- | --- | --- |
| [Emil Kowalski](https://emilkowal.ski/) | A brief account of current work and specific interests; projects get compact descriptions. | State what Andreas enjoys working on, then show examples. |
| [Paco Coursey](https://paco.me/) | Short project definitions; personal interests have their own space and do not need a professional justification. | Let music and terminal tools be part of the person, without attaching a transferable-skills pitch to each. |
| [Josh W. Comeau](https://www.joshwcomeau.com/about-josh/) | Concrete biographical details and conversational sentences make the person memorable. | Use Andreas's actual history and habits. Do not invent hobbies or manufacture quirks. |
| [Brittany Chiang](https://brittanychiang.com/) | Clear role identification, distinct current-work context, and project descriptions that say what someone can do with the software. | Establish the role quickly and describe projects through use. |
| [Rauno Freiberg](https://rauno.me/) | Very little introductory copy; work and a clear creative point of view carry the page. | Trust the projects and the site's visual personality. Keep section titles simple. |

Editorial judgment: these portfolios have different voices, but each makes choices about what to leave out. Andreas needs more career context than some of these established practitioners; borrowing their brevity does not mean borrowing their seniority or their design-engineer positioning.

## Implementation instructions

All paths below are relative to `portfolio_FE/src/`. Copy blocks and table values are the proposed public text. Notes are for the implementer only.

Keep the existing layout, section order, animation hooks, project order, and link destinations. Preserve the wordmark. Reuse existing text slots. Do not add sections, paragraphs, or new components to fit editorial notes. Preserve useful simple labels where explicitly marked “keep.”

Use first person for Andreas's account of his work. Small project cards can simply describe the tool. Technology tags carry stack information, so do not repeat a stack list in every sentence.

## 1. Hero

**File:** `pages/index.astro`

Keep the ROOS wordmark and accessible name **Andreas Roos**.

Four existing tagline spans, in order:

> Developer · Kotlin · Android · Stockholm

The about section provides the fuller introduction. Do not add a slogan under the tagline.

## 2. About

**File:** `components/sections/AboutSection.astro`

Chapter label: **ABOUT**

Chapter headline: `line1="Hello,"` / `accent="I'm Andreas"`

### Passage one

Heading: **Software developer. Kotlin person.**

> I'm Andreas, a software developer in Stockholm. I work mainly in Kotlin and Java, building backend services, Android apps, and tools. I like getting into the details of how software works, and having a say in how it's put together. Audio and Bluetooth are particular interests, alongside a growing collection of projects of my own.

Suggested emphasis spans: software developer, Stockholm, Kotlin, Java, backend services, Android. Keep this an introduction; the journey and projects explain the specific work.

### Passage two

Heading: **At IMRSV, and outside it**

> I'm Head of Technology at IMRSV Music, where I also mix and master records. I design and build internal software, automate workflows, connect services, and develop the infrastructure they run on. The work takes me from writing Kotlin to deploying services and planning storage and backups. Outside work, I build CLI and TUI tools in Rust for my own workflow. One makes rain sounds.

Suggested emphasis spans: Head of Technology, IMRSV Music, internal software, infrastructure, CLI and TUI, Rust. The title and current mixing/mastering work are confirmed directly by Andreas. This is an active development role spanning software and infrastructure, not a description of general IT support. Keep internal business processes private. The project tags below identify agent-assisted implementations.

## 3. Journey

**File:** `components/sections/JourneySection.astro`

Chapter label: **JOURNEY**

Chapter headline: `line1="The story"` / `accent="so far"`

Keep five milestones and two paragraphs per milestone. Each paragraph below maps directly to one `paras` entry.

### Milestone 01

`cmd`: **music**

`title`: **It started with drums**

> I started playing drums at four. Music has been part of my life ever since, and became my work in 2009. Over the years, that included drums and musical direction for Benjamin Ingrosso, and playback and MIDI engineering for Loreen, Veronica Maggio, and Eva Dahlgren.

> I became increasingly drawn to the technical side: signal paths, synchronisation, and how a whole setup behaves when its parts depend on each other. Years in studios and live production gave me a practical way into systems thinking, and eventually a reason to study software.

Note: “over the years” separates the credits from the start of professional work in 2009. The Ingrosso work began in 2017; there is no need to add that date to the public paragraph. Studio mixing credits remain true, but another artist list would crowd out the story this milestone needs to tell. They can remain in the CV.

### Milestone 02

`cmd`: **studies**

`title`: **Learning to build the software**

> That interest took me to Nackademin's Java Developer programme in 2024. I wanted to understand and build the software behind the systems I'd spent so much time working with.

> I graduated in June 2026, with a foundation in backend development, databases, and testing. Kotlin became my preferred language, and Android gave me a way to work directly with devices as well as the services behind them.

### Milestone 03

`cmd`: **sigma**

`title`: **Where Android met audio**

> During my internship at Sigma Connectivity, I built an Android app for Bluetooth LE testing. Working with real devices took me from scanning and GATT communication into LE Audio: reading the spec and decoding the capabilities a device reports.

> I designed a Lua API for custom test sequences and worked on the platform's backend and dashboard. That combination of Android, wireless devices, audio, and backend systems gave me a technical direction I wanted to keep pursuing.

### Milestone 04

`cmd`: **imrsv**

`title`: **Both sides of the studio**

> As Head of Technology at IMRSV Music, I design and build the studio's internal software and infrastructure. I also mix and master records, so the work I'm supporting is familiar. My projects cover automation, integrations, internal services, and the systems for storing and backing up our work.

> That means following a problem beyond the application itself: how information moves between systems, where files live, what colleagues need access to, and what happens when something fails. My audio background helps me understand the work; software gives me more ways to improve it.

Note: this is the primary current-work milestone. Describe responsibilities without implying every infrastructure improvement is finished. “At IMRSV” is a work context, not an employment attribution; formal attribution remains Roos Music AB, consultant to IMRSV Music. There is no need to put that legal structure in the story paragraph.

### Milestone 05

`cmd`: **next**

`title`: **What I'd like to do next**

> I'd like to make software development my full-time focus in a permanent role. I'm particularly interested in backend and Android work, with room to go deeper into connected devices, Bluetooth, and audio.

> Alongside my main work at IMRSV, I do occasional development and support work at Code Boss. My next step is a team where I can contribute across the system and develop that technical focus further.

Note: Code Boss is supplementary hourly work, not the main current role. Do not describe it as a consultancy or introduce mentorship language. This milestone is primarily about direction, not a second “current job” card.

## 4. Project headings

**Files:** `components/sections/FeaturedShowcase.astro`, `pages/index.astro`

| Slot | Final wording |
| --- | --- |
| Chapter label | PROJECTS |
| Chapter headline, desktop and mobile | Selected work |
| ChapterMark split | `pre="Selected "`, `accent="work"` |
| Mobile subheading | A closer look |
| Grid heading | More projects |
| Animated arrow text | MORE PROJECTS (keep) |

## 5. Project copy

**File:** `data/projects.ts`

Match entries by their current title, shown in the headings below. Set fields explicitly listed here; preserve other fields, URLs, and image paths. No new `details` objects are needed where one does not already exist.

### Authorship labels

For the Rust and Swift projects below, keep the implementation languages in their project tags and append the tag **AI-assisted build**. The tag must be visible in both desktop and mobile presentations. This is a description of how those projects were implemented, not a personal language-proficiency claim. It avoids repeating the same authorship sentence across every short description.

Apply that tag to **noiz-kmp, fleetz, noiz, notez, stdz, pinz, zalary, spaze, and glanze**. The Audio Watermarking entry has its own explicit attribution below. Do not expand the personal skills list with Rust, Swift, or C++.

### Wireless Testing App

**New title:** Bluetooth Test App

**Description:**

> An Android workbench for inspecting Bluetooth LE devices and testing how they behave. Engineers can explore services, read LE Audio capabilities, and write repeatable tests in Lua without changing the app.

**Long:**

> Built at Sigma Connectivity for engineers testing Bluetooth devices. The app brings device discovery, GATT inspection, live data, and scripted tests into one place. I designed the Lua API so testers could define their own sequences, and implemented LE Audio capability parsing to make the device's advertised audio support readable.

**Highlights:**

- Write new tests without a new app release
- Inspect services and read live device data
- Decode LE Audio capabilities
- Run repeatable Lua test sequences

Note: the Android/Bluetooth crossover is the distinction here. Keep Kotlin and Compose in the tags. Capability inspection is implemented; do not describe LE Audio streaming, LC3 playback, or Auracast broadcasting as shipped features of this app.

### Wireless Test Platform

**New title:** Bluetooth Test Platform

**Description:**

> A shared view of devices, test scripts, and results from the Bluetooth Test App. Follow a running test in the browser and return to its results afterwards.

**Long:**

> Testing doesn't end on the phone. The platform keeps sessions and results together, associates scripts with devices, and lets engineers follow progress from a web dashboard. I worked on the Ktor backend and Svelte interface, with PostgreSQL for test history and server-sent events for live updates.

**Highlights:**

- Follow test activity from the browser
- Keep results linked to devices and sessions
- Manage and assign test scripts
- Revisit results after a run

Note: explain why the backend exists, rather than making database persistence the headline. This is the same system as the preceding card.

### Internal Release Pipeline

**New title:** Studio Tools

**Description:**

> Internal software for IMRSV Music, helping colleagues find information and reducing repetitive production work. Part of my wider responsibility for the studio's tools, services, and IT.

**Long:**

> At IMRSV, I can see where software would help because I work with the same systems as the people using it. I build tools and integrations to make information easier to reach and reduce manual work. Some services are running today; the production-automation tooling is still being developed.

**Highlights:**

- Easier access to information across systems
- Automation of repetitive production work
- Integrations with existing tools
- Internal services and ongoing development

**Replace tags:** Kotlin, API integrations, Automation, Internal tools

Note: this card deliberately covers the internal-tools work as a group, not a claim that the original automation engine is finished. Current project instructions call that engine a prototype; other internal services are running. The earlier draft overstated this distinction. Keep the work-in-progress flag and review the screenshot for confidential information before publication. Do not restore internal process names or workflow details. Test-first development is supporting engineering evidence, not the reason a visitor should care about this project.

### Audio Watermarking

**Title:** Audio Watermarking (keep)

**Description:**

> Experimental watermarking for tracing copies of unreleased music. The aim is to identify which copy a recording came from, even after processing, without changing what a listener hears.

**Long:**

> Once an audio file has been shared, a filename or metadata tag can disappear. This project explores putting an identifier in the sound itself, with a different mark for each recipient. I defined the threat model, signal design, and psychoacoustic requirements; coding agents implement the C++/JUCE application. Recovery after trimming and compression remains part of the research.

**Highlights:**

- Recipient-specific identifiers carried in the audio
- Embedding strength guided by the sound
- Listening and recovery tests
- Experimental leak-tracing application

**Replace tags:** DSP, Psychoacoustics, JUCE / C++, AI-assisted build

Note: the use case is more informative than “hiding data.” Keep the experimental qualifiers. Do not imply proven leak attribution, universal robustness, legal evidentiary guarantees, or AI detection. Future data-over-audio applications are interesting but would dilute this card's first explanation.

### airwavez

**Description:**

> Designing tools for putting Auracast into practice: checking broadcasts, mapping their coverage, and managing shared audio in a venue. An early LE Audio project connecting my interests in sound, devices, and systems.

**Replace tags:** LE Audio, Auracast, System design

Note: the useful angle is deployment and testing in physical spaces, not simply another broadcast app. This is design work; keep the work-in-progress flag. Do not describe the planned transmitter, coverage instrument, or translation application as implemented.

### noiz-kmp

**Description:**

> Exploring a touch-controlled soundscape: move a single control to change the character of the sound. An Android prototype with a Rust audio engine, bringing noiz's noise and binaural tones to a different kind of interface.

Note: the audio core and Android shell exist; the intended polished visual experience and iOS version are not established as finished. The interesting part is the continuous sound control. Keep the prototype wording and the AI-assisted build tag.

### fleetz

**Description:**

> Keep track of work spread across repositories and machines. A live terminal dashboard for uncommitted changes, incoming commits, pull requests, and CI, with branches and worktrees close at hand.

Note: the problem is losing track of scattered work. Live status and actionable details distinguish fleetz from repoz's one-shot report; Rust and ratatui belong in the tags.

### repoz

**Description:**

> Pick up where you left off, even on another machine. One command shows which repositories need pulling, which have unpushed commits, and where you've left unfinished changes.

Note: keep the existing Bash/GitHub CLI tags. The user's situation is more useful than leading with parallel fetching.

### noiz

**Description:**

> Rain in your terminal. Mix it with white, pink, or brown noise and optional binaural tones, then set a timer and leave it playing while you work.

**Long:**

> A small sound mixer that stays in the terminal. Adjust noise, rain, and binaural tones independently, and use a timer to fade out when you're done. Noise and tones are synthesised live; the rain comes from recordings.

**Highlights:**

- Independently adjustable sound layers
- White, pink, and brown noise
- Rain recordings and optional binaural tones
- Timed playback with a fade-out

Note: the previous “procedural rain” claim was wrong. The current audio implementation loads rain samples. Do not make scientific claims about focus, brainwaves, or therapeutic effects.

### notez

**Description:**

> Keep notes close to a project without making every note part of its repository. Private notes, shared notes, scratch work, and todos, searchable from the terminal and portable across machines.

**Long:**

> I wanted project notes without having to choose between scattering them everywhere and committing everything to the repo. notez separates private, shared, scratch, and global notes, then brings them into one searchable view. It also includes a todo manager. The same core supports epoz, its companion desktop app.

**Highlights:**

- Private notes stay outside shared project repos
- Search across projects and note locations
- Todos with tags and subtasks
- Portable between machines

**Replace tags:** Rust, CLI, TUI, Local-first, AI-assisted build

Note: cross-machine support is current, not just a proposed rewrite. epoz now has its own repository; don't present it as a future notez2 interface. Keep existing links for this text-only handoff, but flag the old notez2 repository URL for verification before implementation. Do not retain the old “global copy” description as the model for all notes.

### stdz

**Description:**

> Look up a Kotlin function or Android concept without breaking out of the terminal. Searchable signatures, examples, and common mistakes, with quick command-line answers or an interactive reference to browse.

Note: fast reference and study are the point. The implementation language adds little to the description; leave it in the tags.

### pinz

**Description:**

> A corkboard for the terminal. Move ideas and todos around, zoom out to see the groups, or zoom in to edit a note. Boards live in your own Git repository and can travel between machines.

Note: spatial organisation, discrete zoom levels, and ownership of the notes distinguish this from another todo list. The shared core is an implementation detail, not the opening pitch. Current README describes a working beta.

### zalary

**Description:**

> Work backwards from a salary, take-home amount, or invoice to see how the numbers relate. A terminal calculator for comparing Swedish employment and consulting scenarios, including taxes, company costs, and working hours.

Note: back-solving from different inputs is the useful distinction, not the list of tax components. Keep estimated results implicit as calculations, never financial guarantees; this pass reviews product behaviour, not tax accuracy. Keep the existing work-in-progress flag until release status is checked separately.

### spaze

**Description:**

> A self-hosted chat experiment for people who work in the terminal. The prototype supports live conversations; the broader idea is to keep project discussion, notes, and todos together.

Note: the implemented server/client prototype is narrower than the README's highlights. GitHub authentication, full-text search, and inline note capture should not be advertised as working based on this review. Keep the work-in-progress flag.

### glanze

**Description:**

> See which coding agents are working and which need your attention, without checking each terminal. A macOS menu-bar app, starting with Claude Code. Early development.

Note: attention and waiting states are the useful detail. Other agent names in the shared model do not establish working integrations with those agents.

### AI Support Venture

**New title:** Support Tools

**Description, if retained:**

> An early business exploration of Swedish-language customer support for online shops, using existing chatbot services. Demo-stage work on the offer and setup.

**Editorial recommendation:** leave this out of the eventual portfolio selection. Its repo describes a pre-launch service/reseller concept, not a distinctive software build. The other projects provide stronger evidence for the developer direction. This is a proposed content-selection change only; nothing has been removed from the site. If the implementation stays strictly copy-only, use the honest description above and keep the work-in-progress flag.

### Portfolio

**New title:** This Site

**Description:**

> An experiment in making a page feel like a place. A WebGL sky, light, and scroll-driven motion built around the work you're reading. Astro and React underneath; a small terminal hidden inside.

Note: the visual behaviour is what distinguishes this site. The separate coursework backend is not important enough for this card's description and is not the live contact service.

## 6. Contact

**File:** `components/sections/ContactPanel.astro`

Chapter label: **CONTACT**

Headline: **Let's talk** (`pre="Let's "`, `accent="talk"`).

Keep the visible email address. Social labels: **GitHub**, **LinkedIn**. No extra paragraph is needed in the fixed panel; the final journey milestone already states the job-search intent.

**File:** `components/ContactForm.tsx`

| Slot | Final text |
| --- | --- |
| Name label | Name |
| Name placeholder | Your name |
| Email label | Email |
| Email placeholder | Your email address |
| Message label | Message |
| Message placeholder | A role, a question, or just a hello. |
| Submit | Send |
| Submitting | Sending |
| Success heading | Thanks for the message |
| Success body | Reply address: {sentTo} |
| Reset | Send another message |
| Missing configuration | The form is unavailable. Email me at larsnilsandreas@pm.me instead. |
| Failed request / generic error | That didn't send. Please try again, or email larsnilsandreas@pm.me. |
| Notification email subject | Portfolio message from {form.name} |
| Notification sender name | Andreas Roos Portfolio |

Preserve the existing dynamic values and field validation. The readable failure text should replace raw provider errors in the user-facing display; this requires a small adjustment to the current catch branch. Keep form values after a failure. Do not promise a response time.

## 7. Navigation and interface copy

Plain labels are intentional. Personality belongs in the story and work; buttons should be immediately understandable.

| File / slot | Final text |
| --- | --- |
| `SidebarNav.tsx`, five labels | home / about / journey / projects / contact (keep) |
| `Sidebar.astro`, CV heading | CV |
| English download | English PDF |
| Swedish download | Svensk PDF |
| `SidebarToggle.tsx`, accessible name | Toggle navigation |
| `Banner.astro`, name | Andreas Roos |
| Header GitHub icon accessible name | Andreas Roos on GitHub |
| Header LinkedIn icon accessible name | Andreas Roos on LinkedIn |
| FeaturedShowcase, ProjectsGrid, CardProjects: repository link | Code |
| ProjectsGrid, CardProjects: demo link | Visit site |
| Missing image label | No preview yet |
| Work-in-progress badge and prefix | In progress |
| Mobile carousel hint | Swipe for more |
| Lightbox close control | Close screenshots |
| Previous / next controls | Previous screenshot / Next screenshot |
| Screenshot opener accessible name | Open {projectTitle} screenshots |
| Single-image alt fallback | {projectTitle} screenshot |
| Multiple-image alt fallback | {projectTitle} screenshot {index + 1} |

Paths for UI components are under `components/`, with FeaturedShowcase under `components/sections/`. Keep existing arrow glyphs. Apply shared labels to both desktop and mobile renderers. Placeholder `#` links remain hidden.

`components/TechStack.tsx`: use **Spring Boot**, **Bluetooth LE**, and **Tailwind CSS** in place of Spring, BLE, and Tailwind. Keep the other tool names and existing icon list. Do not add expertise levels.

`components/sections/ChapterMark.astro` and `ChapterCover.astro` contain presentation logic: change caller text, not shared component defaults, unless a remaining visible default genuinely needs the same replacement.

## 8. Metadata and utility pages

**Files:** `components/CommonHead.astro`, `pages/index.astro`

Home title and default title:

> Andreas Roos | Software Developer

Default description, social description, and Person schema description:

> Software developer in Stockholm. Kotlin, backend services, Android, and Bluetooth. Selected work and a little background in music.

Person `jobTitle`: **Software Developer**.

Keep name, location, social URLs, and the existing Open Graph image description. Home supplies an explicit title, so change that as well as the default.

Redirect document titles, keeping all redirect behaviour:

- `pages/about.astro`: About | Andreas Roos
- `pages/projects.astro`: Projects | Andreas Roos
- `pages/contact.astro`: Contact | Andreas Roos

**File:** `pages/404.astro`

Page title: **Page not found | Andreas Roos**

Body:

> Nothing at this address. My work is back on the home page.

Home link:

> Back to the portfolio

Keep the terminal command, error line, and ASCII 404 art.

## 9. Hidden terminal

**File:** `components/MiniTerminal.tsx`

Keep the existing playful command responses and effects except for the replacements below. This already has personality; the main issue is stale factual text.

Opening hint:

> A small terminal. Try help.

`help`:

```text
Try: whoami, ls, cat about.txt, cd projects, cv, neofetch, crt, clear
```

`whoami`: **andreas roos**, in all current time branches. A visitor's local time should not imply Andreas is awake or working.

`cat about.txt`:

```text
Andreas Roos. Developer. Stockholm.
Mostly Kotlin. Sometimes drums.
Backend, Android, Bluetooth, and a growing collection of terminal tools.
```

`ls`:

```text
projects/  about.txt  secret.txt  cv/
```

This removes the advertised but unsupported `contact.txt`. Keep `cd contact` working.

Both `ls projects` aliases:

```text
bluetooth-test-app/  bluetooth-test-platform/
 studio-tools/  audio-watermarking/
 notez/  noiz/  fleetz/  portfolio/

A few highlights. Type cd projects for the rest.
```

`uptime`:

```text
Still here. Still making things.
```

In `NEOFETCH`, preserve the ASCII art and alignment. Replace the following values to remove stale versions and project counts:

```text
Kernel  Astro
Shell   React
WM      Tailwind CSS
CPU     Vite
Memory  several unfinished ideas
Uptime  still here
```

The Memory line is deliberately a joke, not a project count. Keep the remaining entries, CV filenames, download responses, and supported commands. Do not change routing or add terminal functionality as part of the copy work.

## 10. Factual boundaries and implementation check

This version uses the career research from the first pass, especially `../career/cv/resume_en.html` and recent English CVs under `applications/hailey-hr/backend-integrations/`, `applications/hailey-hr/ai-software-developer/`, `applications/seb/`, `applications/tutus/`, and `applications/spotify/subscriptions/`. The career repository's `AGENTS.md` supplies attribution, confidentiality, and experience boundaries. Existing portfolio data supplies smaller-project features. This revision also reviews the local project READMEs and selected implementation files; the project-review notes below record what informed the changed claims. It is a copy fact-check, not an exhaustive code or runtime audit.

Keep these distinctions intact:

- Nackademin graduation is complete, June 2026.
- Code Boss is supplementary hourly employment, not the primary current role. IMRSV work is consultancy through Roos Music AB and is the main current work.
- Andreas started drums at four and professional music work in 2009. He currently mixes and masters at IMRSV, as clarified directly in this conversation. Earlier freelance music work ended in 2024; do not imply ongoing touring or a freelance music offering.
- Musical director and drummer credits apply to Benjamin Ingrosso, from 2017. Loreen, Veronica Maggio, and Eva Dahlgren credits refer to playback and MIDI engineering. Do not attach all credits to 2009.
- Internal business processes stay private. The Studio Tools screenshot needs a separate review before publication.
- airwavez remains in design. Audio Watermarking remains experimental.
- AI-assisted Rust, Swift, and C++ projects are identified as such without implying independent proficiency in those languages.
- The job-search direction is permanent software employment. Do not add a freelance-services pitch.

Before implementing, ensure the v2 text is the chosen direction. Then apply shared project data consistently, keep authorship labels visible, check the first three featured highlights, and verify wrapping on desktop and mobile, including Safari. Preserve animation hooks and scroll timing. Run the frontend build after source changes.

CV PDFs, screenshots, and site functionality are outside this writing pass. The only deliverable now is this Markdown document.


## 11. Project research behind this revision

Read-only review of sibling repos. These are implementation notes, not website copy. No internal workflow details should be copied into the public page.

| Project / source | What changed in the editorial treatment |
| --- | --- |
| `../Gaurgle/README.md` | Reviewed the GitHub profile introduction, current work, and z-tools overview. Used its emphasis on building and running software; the Head of Technology title comes from Andreas directly. |
| `../Sigma/app2/README.md`, `app/src/main/java/com/example/app2/data/parser/leAudio/PacParser.kt` | Lead with Android device inspection and custom tests. PAC parsing supports LE Audio capability claims; streaming remains outside the claim. |
| `../Sigma/wireless-test-platform/README.md`, `AGENTS.md` | Explain central test history and script/device management; distinguish the backend card from the Android app. |
| `../IMRSV/imrsv-infrastructure/README.md`, internal tools READMEs, `file-gatherer/CLAUDE.md` | Separate running services, ongoing automation, and planned infrastructure. Lead with colleagues' needs and broad responsibility, without publishing private processes. |
| `../cpp/WM/docs/product-vision.md`, `docs/ai-provenance.md`, `README.md` | Use experimental recipient-copy tracing as the concrete purpose. Retain limits; the opening README makes broader claims than its development status supports. |
| `../airwavez/README.md` | Emphasise broadcast deployment, coverage, and venue tools as design goals. |
| `../noiz/README.md`, `src/audio.rs` | Correct sampled rain versus synthesised noise; surface independent layers and a fade-out timer. |
| `../noiz-kmp/README.md` | Describe the Android prototype and sound-control idea, not a finished mobile product. |
| `../notez/README.md`, `CLAUDE.md` | Replace the stale rewrite story with privacy scopes, portability, and the separate epoz app. |
| `../fleetz/README.md`, `CLAUDE.md`; `../repoz/README.md` | Differentiate a dashboard you keep open from a report you run when returning to work. |
| `../stdz/README.md` | Reference and study use, including quick lookups and concept browsing. |
| `../pinz/README.md` | Spatial organisation, zoom, and portable user-owned boards. |
| `../zalary/README.md` | Back-solving between income figures, rather than a generic tax-feature list. No independent financial validation claimed. |
| `../Spaze/README.md`, source inventory and feature search | Separate working chat prototype from planned authentication, search, and note capture. |
| `../Glanze/README.md`, `GlanzeCore/Sources/GlanzeCore/AgentState.swift` | Surface working/waiting attention states; avoid claiming every named agent adapter works. |
| `../SaaS-Commerze/README.md` | Recommend omission: a service concept using existing platforms adds little to this software portfolio. |
| Portfolio `CLAUDE.md` and current source context | Describe the site's sky and motion instead of giving its coursework backend disproportionate emphasis. |

All 17 existing project entries have a text treatment. The support-tools omission is a recommendation for later, not an implemented deletion. The first draft is preserved; this v2 document is the current revised proposal.
