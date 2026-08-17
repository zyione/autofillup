# AutoFillUp – MyWorkday

**AutoFillUp – MyWorkday** is a privacy-first, local-only Chrome extension designed to streamline repetitive Workday job application forms. Built with Manifest V3 and TypeScript, it keeps you completely in control: **it operates 100% locally on your machine and will never automatically submit an application.**

---

## ✨ Features

- **🔒 100% Privacy & Local Storage**: All profile data, application answers, and custom mappings are saved exclusively in `chrome.storage.local`. No analytics, no cloud sync, zero external telemetry.
- **🛡️ Conservative & Safe Filling**:
  - Automatically respects existing input values to prevent accidental overwrites.
  - Never clicks "Submit", "Next", or signs legal agreements on your behalf.
  - Flagged review status for low-confidence or ambiguous fields.
- **📋 Comprehensive Profile Management (Options Page)**:
  - **Personal & Contact Details**: Names, addresses, email, phone number, and social/portfolio links (LinkedIn, GitHub, Portfolio).
  - **Education History**: Multiple academic records with degree, institution, field of study, GPA, and dates.
  - **Employment History**: Chronological job history with titles, employers, locations, bulleted descriptions, and current role toggles.
  - **Categorized Skills**: Programming languages, frameworks, databases, cloud/devops, tools, and certifications.
  - **Custom Profile Fields**: Add bespoke keys/values (e.g. Clearance Level, Desired Salary, Notice Period).
  - **Application Answers**: Predefined responses for screening questions (e.g. Sponsorship, Work Authorization, Relocation, Notice Period).
  - **Mapping Library**: Inspect, search, edit, or delete custom field mappings learned from past sessions.
  - **Safety Settings**: Configurable confidence thresholds and overwrite preferences.
  - **Backup & Restore**: Export your complete profile and learned mappings to a JSON backup file and restore anytime.
- **🧠 Interactive Teaching UI & In-Page Overlay**:
  - Floating assistant overlay on Workday pages displaying filled, review, and unknown field counts.
  - One-click **"Teach Field"** interface allowing you to map unknown or custom Workday inputs directly to your profile attributes or fixed values.
- **🌐 Broad Workday Tenant Coverage**: Works out-of-the-box on all Workday application domains (`https://*.myworkdayjobs.com/*`).

---

## 🔒 Permissions & Security

| Permission | Reason |
| :--- | :--- |
| `storage` | Stores your profile records, preferences, and learned mappings securely in `chrome.storage.local`. |
| `activeTab` | Allows the toolbar popup to query and communicate with the active Workday application tab. |

**Host Scope:** Content scripts run exclusively on `https://*.myworkdayjobs.com/*`. The extension cannot read or access pages outside Workday job boards.

---

## 🛠️ Prerequisites

- **Google Chrome** (or any Chromium-based browser such as Brave, Edge, Arc).
- **Node.js**: v20 or v22+ LTS recommended.
- **Package Manager**: `npm` (or `pnpm`).

---

## 🚀 Setup & Installation

### 1. Clone the repository and install dependencies

```bash
# Using npm
npm install

# Or using pnpm
pnpm install
```

### 2. Build the extension

```bash
# Production build
npm run build

# Or development watch mode (auto-rebuilds on file change)
npm run dev
```

The compiled Chrome extension will be output to the `dist/` directory.

### 3. Verify types and tests (Optional)

```bash
# Run TypeScript typecheck
npm run typecheck

# Run Vitest unit tests
npm test
```

---

## 🧩 Loading into Chrome

1. Open Google Chrome and navigate to `chrome://extensions`.
2. Turn **ON** the **Developer mode** toggle in the top-right corner.
3. Click the **Load unpacked** button in the top-left toolbar.
4. Select the **`dist`** directory inside this project folder (`.../autofillup/dist`).
5. (Recommended) Click the Chrome **Extensions puzzle icon** in your browser toolbar and **Pin** `AutoFillUp – MyWorkday` for quick access.

---

## 📖 How to Use

### Step 1: Configure Your Profile
1. Right-click the **AutoFillUp** toolbar icon and choose **Options** (or click the gear icon in the popup).
2. Fill in your details across the tabs:
   - **Personal & Contact**: First/last name, phone, address, LinkedIn, GitHub, etc.
   - **Education & Employment**: Add your degrees and past work experiences.
   - **Skills & Answers**: Add screening answers (e.g., citizenship status, visa sponsorship requirements).
   - **Safety & Settings**: Adjust autofill confidence thresholds and overlay display.
3. Click **Save All Changes** at the top right.

> 💡 **Tip:** You can download a backup of your profile anytime under the **Backup & Restore** tab.

### Step 2: Navigate to a Workday Application
1. Go to any job application page hosted on `*.myworkdayjobs.com`.
2. The extension automatically detects the Workday portal and tenant name.

### Step 3: Autofill and Review
1. Click the **AutoFillUp extension icon** in your toolbar.
2. Click **Autofill Page** (or let the floating assistant overlay assist you).
3. The extension scans inputs and fills corresponding fields matching your profile data.
4. Review all filled inputs:
   - **Filled**: Form controls populated with high confidence.
   - **Review / Unknown**: Any inputs flagged for manual confirmation.
5. If an unmapped field appears, click **Teach Field** in the overlay to associate it with a profile attribute or standard answer for future applications.
6. Verify and manually proceed with the application steps.

---

## 📁 Project Structure

```text
autofillup/
├── public/
│   └── manifest.json            # Manifest V3 extension configuration
├── src/
│   ├── adapters/                # ATS adapter contracts
│   ├── background/              # MV3 background service worker
│   ├── content/                 # Workday content scripts
│   │   ├── autofill/            # DOM filling mechanisms (inputs, selects, custom dropdowns)
│   │   ├── detection/           # Workday tenant & page fingerprint detection
│   │   ├── fields/              # Field scanning and normalization
│   │   ├── learning/            # Teaching controller for unknown fields
│   │   ├── mapping/             # Semantic heuristic & candidate mapping engine
│   │   ├── observation/         # Mutation observer for dynamic page changes
│   │   └── ui/                  # Floating assistant overlay & review panel
│   ├── options/                 # Options dashboard (HTML/CSS/TS)
│   ├── popup/                   # Browser action popup (HTML/CSS/TS)
│   ├── shared/                  # Shared types, logging, and message interfaces
│   └── storage/                 # Typed chrome.storage.local abstraction layer
├── tests/                       # Vitest unit tests & DOM fixtures
├── package.json
├── tsconfig.json
└── vite.config.ts               # Multi-entry Vite bundler configuration
```

---

## 📜 Development Scripts

| Command | Description |
| :--- | :--- |
| `npm run build` | Builds production-ready unpacked extension in `dist/` |
| `npm run dev` | Watches source files and continuously rebuilds `dist/` |
| `npm run typecheck` | Validates TypeScript types across the project |
| `npm test` | Runs the test suite using Vitest |
