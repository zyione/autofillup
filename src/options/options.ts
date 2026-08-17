import "./options.css";

const status = document.querySelector<HTMLParagraphElement>("#storage-status");

void chrome.storage.local.getBytesInUse().then((bytes) => {
  if (status) status.textContent = `Local extension storage ready (${bytes} bytes currently used).`;
});
