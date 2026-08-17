# AutoFillUp – MyWorkday

AutoFillUp – MyWorkday is a privacy-first Chrome extension for assisting with repetitive Workday job-application entry. It is designed to keep the applicant in control: the extension will never submit an application.

> **Current status: Milestone 1 – Chrome Extension Foundation.** This release creates an installable Manifest V3 extension shell. It does **not** yet detect application fields, store an editable profile, or fill forms.

## What is included

- Chrome Extension Manifest V3 configuration.
- A background service worker with a small typed message contract.
- A content-script entry point scoped to Apex Group's Workday site.
- Popup and options-page shells.
- Typed wrappers around `chrome.storage.local` for future local-only profile data.
- Shared logging, utility, profile, session, and ATS-adapter interfaces.
- Type checking, one unit test, and a Vite production-build workflow.

## Not included yet

The following are deliberately outside this foundation milestone:

- Workday/application-page detection.
- Reading, detecting, or changing form fields.
- Autofill, page observation, mapping, or unknown-field teaching.
- Editable profile and reusable-answer screens.
- Other ATS integrations.
- AI-generated content, resume analysis, or job matching.
- Automatic application submission.

## Privacy and permissions

The extension requests only one Chrome permission:

| Permission | Why it is needed |
| --- | --- |
| `storage` | To support future local-only profile and preference storage. |

The content script runs only on `https://theapexgroup.wd3.myworkdayjobs.com/*`. It does not request broad access to all websites, network access, clipboard access, or browsing history.

No user data is collected or transmitted by this milestone. When profile storage is added, it will use `chrome.storage.local`, which remains in the user’s local Chrome profile unless the user separately enables Chrome’s own browser sync behavior.

## Prerequisites

- Google Chrome or another Chromium browser with extension developer mode.
- Node.js 20 or later (Node 22 LTS is recommended).
- npm, pnpm, or another Node package manager.

## Install dependencies

From the project directory:

```sh
npm install
```

The repository includes a `pnpm-lock.yaml`; if you use pnpm instead, run:

```sh
pnpm install
```

## Verify the project

Run all local checks before packaging:

```sh
npm run typecheck
npm test
npm run build
```

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Validates TypeScript without generating output. |
| `npm test` | Runs the unit test suite with Vitest. |
| `npm run build` | Creates an unpacked Chrome extension in `dist/`. |
| `npm run dev` | Rebuilds `dist/` whenever source files change. |

## Load the extension in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Select **Load unpacked**.
5. Choose this project’s `dist` folder.
6. Optionally pin **AutoFillUp – MyWorkday** from Chrome’s Extensions menu.

After it loads, Chrome should display the extension without manifest errors.

## Manual smoke test

This milestone is intentionally passive. A successful test confirms the extension foundation—not autofill behavior.

1. Click the pinned extension icon. The popup should say `Foundation ready` with the installed version.
2. Open the extension’s **Details** page in `chrome://extensions` and select **Extension options**. The page should confirm that local extension storage is ready.
3. Visit `https://theapexgroup.wd3.myworkdayjobs.com/`.
4. Open the page’s Developer Tools console. A debug message beginning with `[AutoFillUp] Content-script foundation loaded` confirms the scoped content script was loaded.
5. Confirm that no Workday fields change. This is expected until a later milestone implements detection and autofill.

### If Chrome reports an error

- Run `npm run build` again and reload the extension from its Details page.
- Ensure you selected `dist/`, not the project root.
- Check the **Errors** button on the extension card for the exact Chrome message.
- Confirm the content-script test is on the exact Apex Group host; the extension is not yet enabled on other Workday tenants.

## Project layout

```text
autofillup-myworkday/
├── public/manifest.json       # MV3 manifest copied into dist during build
├── src/
│   ├── adapters/              # Generic ATS contract; no implementation yet
│   ├── background/            # Service worker and message handling
│   ├── content/               # Passive content-script entry point
│   ├── options/               # Options-page shell
│   ├── popup/                 # Toolbar popup shell
│   ├── shared/                # Types, messages, logger, utilities
│   └── storage/               # Typed chrome.storage.local abstraction
├── tests/unit/                # Unit tests
├── vite.config.ts             # Multi-entry extension build setup
└── dist/                      # Generated unpacked extension; not committed
```

## Development notes

The background service worker coordinates extension lifecycle and message passing. It never manipulates a webpage DOM. Future DOM interaction belongs in the content script, which is the only extension component with direct access to the Workday page.

The `AtsAdapter` interface exists so Workday-specific behavior can later be isolated from generic profile, mapping, and filling logic. There is no Workday adapter implementation in this milestone.

## Planned next steps

The next implementation milestone should introduce the local profile schema and profile-management UI. Following milestones can then add conservative Workday detection, field detection, mapping, page observation, and user-reviewed autofill behavior.

Every future autofill feature must preserve these safety rules:

- Prefer leaving an uncertain field empty instead of guessing.
- Do not overwrite existing user-entered values by default.
- Clearly surface skipped, unknown, and review-required fields.
- Never automatically submit a job application.

## License

No license has been selected yet. Add a license before publishing or distributing the extension more broadly.
