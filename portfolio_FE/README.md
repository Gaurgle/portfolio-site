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
- Terminal/pixel-art aesthetic with Catppuccin color scheme
- Interactive components: mini terminal, rough-notation sketches, tech marquee, pinned card decks
- Homepage clouds are real WebGL2 volumes with internal shadowing, scroll-driven approach, rotation and evolving density. Cloud sizes and entry paths vary, with long gaps between passes and a soft blur near the camera. A large opening cloud sits behind the logo at rest, rushes the camera during the ROOS exit, engulfs the screen, and disperses to expose the page. A closing cloud forms over the last screens and settles along the top edge of the contact panel. Desktop uses two ambient volumes with independent drift and evolving density. Mobile runs the hero, one ambient cloud, and the contact cloud sequentially at lower resolution, updating only while the page moves. Reduced motion keeps the atmosphere still. About story cards are flat, bordered panels so prose stays legible over clouds; the desktop sidebar blur fades out past the column instead of ending in a line. No cloud assets or additional packages are required. Unsupported graphics leaves the starfield visible.
- On mobile, Journey and featured projects stay in pinned card decks. Their stable viewport-safe geometry avoids resize work during scrolling; very short screens can scroll inside a card so no content is lost.
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
