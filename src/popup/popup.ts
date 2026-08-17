import "./popup.css";

const status = document.querySelector<HTMLParagraphElement>("#status");
const summary = document.querySelector<HTMLParagraphElement>("#summary");
const button = document.querySelector<HTMLButtonElement>("#fill")!;

button.addEventListener("click", () => {
  void chrome.tabs.query({ active: true, currentWindow: true })
    .then(([tab]) => tab.id ? chrome.tabs.sendMessage(tab.id, { type: "RUN_AUTOFILL" }) : Promise.reject(new Error("No active tab")))
    .then((result: { supported: boolean; outcomes: Array<{ outcome: string }> }) => {
      if (!result.supported) { if (status) status.textContent = "This is not a supported Workday page."; return; }
      const counts = result.outcomes.reduce<Record<string, number>>((all, item) => ({ ...all, [item.outcome]: (all[item.outcome] ?? 0) + 1 }), {});
      if (status) status.textContent = "Review the page before continuing.";
      if (summary) summary.textContent = Object.entries(counts).map(([name, count]) => `${count} ${name}`).join(" · ") || "No eligible fields.";
    })
    .catch(() => { if (status) status.textContent = "Reload the extension and open a Workday application."; });
});
