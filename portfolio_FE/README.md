# 🤔 **Overview**
This project is a frontend implemented using **Astro** and **React**. It employs modern web development practices to deliver a visually engaging and interactive user experience. Key components include reusable UI elements built with **React** and styled using **TailwindCSS** for utility-first styling.
The main goal of the application is to provide a responsive and interactive interface that dynamically renders content based on configuration and user interaction, ensuring accessibility across devices and platforms.

### 🏓 **Table of contents:**
- [Overview](#Overview)
- [Features](#Features)
- [Tech stack](#Tech)
- [Development notes](#Development-notes)
- [BubbaUI](#BubbaUI)
- [Astro](#Astro)
- [License](#License)


### 🐣 **Features**
##### Modern UI Design:
- Terminal/pixel-art aesthetic on black, with a light-based palette: monochrome type, and colour only where light is split (the prism's spectrum and the sky's red/blue fringe)
- Interactive components: mini terminal, rough-notation sketches, tech marquee
- Homepage opens on a loading screen: plain black for at least a second and until the shaders are compiled and the fonts have landed, then the mark's outline fills in from the ground up as the loader, and ROOS rises in white over it the same way, resolving from a dispersed haze with its reflection unfolding on a ground line, while the islands hydrate, the scroll engine lays the stages out and the featured project pictures are decoded; then the sky, stars, navigation and stages fade in around it (first arrival per tab, reloads included; about 3.3 to 5 s). The remaining pictures are warmed in the background once the world is in
- Wheel scrolling is capped at about two and a half screens per second, so a hard flick cannot skip a held moment (touch stays browser-owned)
- ROOS is a light source: a screen-space scattering pass in the clouds' WebGL context streams soft rays out of the block glyphs, leaning toward the pointer and leaving with the scroll explosion
- Homepage clouds are real WebGL2 volumes with internal shadowing, scroll-driven approach, rotation and evolving density. Cloud sizes and entry paths vary, with long gaps between passes and a soft blur near the camera. A large opening cloud sits behind the logo at rest, rushes the camera during the ROOS exit, engulfs the screen, and disperses to expose the page. A closing cloud forms over the last screens and settles along the top edge of the contact panel. Desktop uses two ambient volumes with independent drift and evolving density. Mobile runs the hero, one ambient cloud, and the contact cloud sequentially at lower resolution, updating only while the page moves. Reduced motion keeps the atmosphere still. The weather slows while the featured projects are pinned, so their storm cloud lasts through all of them. No cloud assets or additional packages are required. Unsupported graphics leaves the starfield visible.
- No card surfaces: about passages, journey stops and featured projects are loose text in the sky. Elements marked `data-lens` get a soft clearing in the cloud pass (the sky dims and bends at its rim; `data-lens="soft"` also thins the cloud a little), and the prism's gleam is exempt from it. Small text marked `data-sky-adapt` switches to dark ink while a bright cloud is behind it
- The prism's gleam runs in from the left screen edge as a white ray, disperses at the prism inside its cloud, and leaves as a lengthening ray. Cloud scatters the run-in like any other light, so the ray is concentrated in clear sky and diffused wherever cloud crosses it (`prismOptics.ts`, covered by `node --test src/lib/prismOptics.test.ts`)
- Journey is a pinned flight through depth: each stop approaches, holds in focus and passes the camera, one at a time, with a plain contents list under the chapter mark
- Featured projects are a pinned strip at screen scale: each project arrives, holds still, then leaves as the next arrives; titles disperse like a prism while moving or under the pointer. The listing below holds in place for most of a screen and opens with a project in focus
- On mobile, Journey and featured projects run the same depth flight inside a pinned, viewport-safe stage; very short screens can scroll inside a stop so no content is lost.
- Responsive layout using [TailwindCSS](https://tailwindcss.com/) across all screen sizes

##### 🧑‍✈️ **Nav bar**
- A sticky navigation bar built using Astro, React and Tailwind with:
	- Collapsible sidebar with links to `Projects`, `About` and `Contact`
	- Social media icons for GitHub and LinkedIn

### ⚙️ **Tech**
- Astro: Static site generator that inegrates seamlessly with React components.
- React: for building reusable and dynamic UI components.
- TailwindCSS: Utility-first CSS framework for consistent, responsive styling.
- PostCSS & Autoprefixer: To ensure CSS compatebility across browsers.
- Vite: For fast development server for optimal performance.

### 📂 **Folder layout**
```text
/src/
  ├── components/
  │    ├── HibubbaIO/
  │    │    ├── BorderBeam.tsx        # Moving border effect on project cards
  │    ├── sections/                  # One-pager chapters (About, Journey, FeaturedShowcase, ContactPanel, ChapterMark)
  │    ├── Banner.astro               # Fixed header with social links
  │    ├── CardProjects.tsx           # Project cards with lightbox carousel
  │    ├── CommonHead.astro           # Shared <head>: meta, OG/Twitter, JSON-LD, font preloads
  │    ├── ContactForm.tsx            # Contact form (Web3Forms, client-side, no backend)
  │    ├── EasterEggs.tsx             # Console ASCII art, CRT mode, rm -rf glitch
  │    ├── MiniTerminal.tsx           # Interactive terminal on the homepage
  │    ├── ParticleLayers.astro       # Parallax starfield canvases
  │    ├── ProjectsGrid.tsx           # "More projects" listing (desktop ls view, mobile carousel)
  │    ├── Sidebar.astro              # Fixed sidebar with nav links and CV downloads
  │    ├── SidebarNav.tsx             # Sidebar navigation with scroll spy
  │    ├── SidebarToggle.tsx          # Hamburger menu toggle (mobile)
  │    ├── TechMarquee.tsx            # Tech stack marquee band
  │
  ├── lib/
  │    ├── smoothScroll.ts            # Lenis scroll engine: pins, card decks, showcase, spy
  │    ├── sketch.ts                  # rough-notation hover sketches
  │
  ├── styles/
  │    ├── global.css                 # @font-face (self-hosted), global styles, animations, CRT mode
  │
  ├── data/
  │    ├── projects.ts                # Project data (titles, images, tags, links)
  │    ├── imageSizes.ts              # Intrinsic screenshot sizes for width/height on <img>
  │
  ├── pages/
  │    ├── index.astro                # Homepage with ASCII art and terminal
  │    ├── projects.astro             # Projects page
  │    ├── about.astro                # About page with bento grid
  │    ├── contact.astro              # Contact page
  │    ├── 404.astro                  # Custom 404 page
  │
  ├── layouts/
  │    ├── BaseLayout.astro           # Reusable layout wrapping all pages
```


### **Development notes**
- Static build (`astro build`), deployed to Vercel from `main`.
- TailwindCSS configuration is defined in `tailwind.config.js`
- Assets: screenshots are WebP in `public/pictures/`, fonts are self-hosted woff2 in `public/fonts/` (no Google Fonts at runtime). `public/og.jpg` is the share-preview image.
- The contact form posts to [Web3Forms](https://web3forms.com) and needs `PUBLIC_WEB3FORMS_KEY` in `.env.local` (free access key, public-safe). Without it the form renders but submissions fail.

### 🌈 **BubbaUI**
- Imported React/TS components from [Bubba UI](https://bubba-ui-one.vercel.app/): `BorderBeam` and `ParticleBg`.

---

## 🧞 Commands

All commands are run from `portfolio_FE/`:

| Command           | Action                                      |
| :---------------- | :------------------------------------------ |
| `npm install`     | Installs dependencies                       |
| `npm run dev`     | Starts local dev server at `localhost:4321`  |
| `npm run build`   | Build production site to `./dist/`          |
| `npm run preview` | Preview build locally before deploying      |

### License
This project is licensed under the **MIT License**. See the `LICENSE` file for more details.
