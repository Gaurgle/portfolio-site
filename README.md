![Status](https://img.shields.io/badge/Status-Active-success)
![GitHub last commit](https://img.shields.io/github/last-commit/Gaurgle/portfolio-site)
![Frontend](https://img.shields.io/badge/Frontend-Astro-FF5A03?logo=astro)
![Backend](https://img.shields.io/badge/Backend-Spring%20Boot-6DB33F?logo=springboot)
![Database](https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql)

[![Frontend Demo](https://img.shields.io/badge/Frontend-Demo-blue?logo=vercel)](https://andreasroos.vercel.app)

# Portfolio
A full-stack developer portfolio with an **Astro** frontend (live on **Vercel**) and a containerized **Spring Boot + PostgreSQL** backend kept as an infrastructure showcase (Docker, Flyway, GitHub Actions CI). The live site's contact form is handled by **Web3Forms**, so no server or database is required to run it.

---
## 📖 Documentation

- [Frontend README →](https://github.com/Gaurgle/portfolio-site/blob/main/portfolio_FE/README.md)
- [Backend README →](https://github.com/Gaurgle/portfolio-site/blob/main/portfolio_BE/README.md)

---

## 🌍 Live Demo
- **Frontend (Portfolio site)** → [https://andreasroos.vercel.app](https://andreasroos.vercel.app)

> **Note:** The Spring Boot backend is no longer deployed. It lives in `portfolio_BE/` as a containerized showcase you can run locally (see below). The live contact form uses Web3Forms instead of the self-hosted API.

---

## 📁 Project Structure

```text
portfolio-site/
├── portfolio_FE/    → Astro frontend (deployed on Vercel)
└── portfolio_BE/    → Spring Boot backend (containerized showcase, run locally)
```

---

## ⚙️ Tech Stack
**Frontend:** Astro, Tailwind CSS, TypeScript  
**Contact:** Web3Forms (client-side form handling — no backend)  
**Backend (showcase):** Spring Boot (Kotlin), JPA, Flyway, PostgreSQL, Resend API  
**Infrastructure:** Vercel (frontend), Docker, GitHub Actions (CI)  

---

## 🧩 Features
- Responsive portfolio built in Astro
- Dynamic projects list
- Contact form powered by Web3Forms (sends email, no backend or database)
- CI/CD: Vercel auto-deploys the frontend; GitHub Actions builds and tests the backend on every push
- **Backend showcase** (`portfolio_BE/`): REST contact API, message persistence in PostgreSQL via JPA/Flyway, and email via the Resend API — containerized with Docker and runnable locally

---

## 🔄 CI/CD Overview
| Component | Platform | Trigger | Result |
|------------|-----------|----------|----------|
| **Frontend** | Vercel | Push to `main` | Auto-deploys new build |
| **Backend** | GitHub Actions | Push to `main` (`portfolio_BE/**`) | Builds JAR and runs tests against a Postgres service |

---

## 🧪 Local Development
### Frontend
```bash
cd portfolio_FE
npm install
# add your Web3Forms key (free at https://web3forms.com)
echo "PUBLIC_WEB3FORMS_KEY=your-access-key-here" > .env.local
npm run dev
```

### Backend (showcase)
```bash
cd portfolio_BE
export SPRING_PROFILES_ACTIVE=local
./gradlew bootRun
```

##### Run all backend tests:
```bash
./gradlew test
```


---
