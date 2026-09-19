// A context-menu click grants access only to the image the user selected.
// We keep each capture separate so two save windows cannot overwrite each other.
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: 'save-image',
    title: 'Save image to ImageShare',
    contexts: ['image'],
    targetUrlPatterns: ['http://*/*', 'https://*/*'],
  });
});

export async function captureImage(info, tab) {
  if (info.menuItemId !== 'save-image' || !info.srcUrl) return;
  const id = crypto.randomUUID();
  const key = `capture_${id}`;
  const captures = await chrome.storage.session.get(null);
  const expired = Object.entries(captures)
    .filter(([name]) => name.startsWith('capture_'))
    .sort((a, b) => b[1].createdAt - a[1].createdAt)
    .slice(19).map(([name]) => name);
  await chrome.storage.session.remove(expired);
  await chrome.storage.session.set({
    [key]: { url: info.srcUrl, title: (tab?.title || 'Saved image').slice(0, 150), createdAt: Date.now() },
  });
  await chrome.windows.create({
    url: chrome.runtime.getURL(`popup.html?capture=${id}`),
    type: 'popup', width: 410, height: 740,
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  captureImage(info, tab).catch(error => console.error('Could not open ImageShare:', error));
});
