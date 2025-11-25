# `next-run`

A simple CLI tool to quickly run `npm run dev`, `npm run build`, or `npm run start` in your Next.js projects—with optional custom **PORT** support.

## ✨ Features

* Choose your mode: **dev**, **build**, or **start**.
* Optionally specify a custom **PORT** before running the command.
* Skip typing full `npm run ...` commands—just run `next-run` and go!

## 📌 Requirements

* **Node.js ≥ 14.8.0** (recommended: **Node.js 18+**)

  * This tool uses **ECMAScript Modules (ESM)** syntax internally (`import/export`).
  * CLI runs independently via Node, so your project can still use CommonJS without issues.

> 💡 Check your version with:
>
> ```bash
> node --version
> ```

## 📦 Prerequisites

Your project must already have **Next.js** installed, as `next-run` wraps the standard Next.js CLI (`next dev`, `next build`, `next start`).

To create a new Next.js project:

```bash
npx create-next-app@latest your-app
```

Ensure your `package.json` includes the standard scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

## 🚀 Installation & Usage

Install globally to use it easily anywhere:

```bash
npm install -g next-run
```

Then, from any Next.js project directory:

```bash
next-run
```

---

> ⚠️ **Note**: The CLI uses modern ESM internally and ESM-only dependencies (`chalk@5`, `inquirer@12`). You don’t need to convert your project—just ensure your **Node.js version is ≥14.8**.

---