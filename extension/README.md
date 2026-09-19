# ImageShare Chrome extension

A small Manifest V3 extension for the local ImageShare website. No build step.

## Install in Chrome

1. Start ImageShare from the project directory in two terminals:
   - `./scripts/backend.sh`
   - `./scripts/frontend.sh dev`
2. Open `chrome://extensions` in Chrome and enable **Developer mode**.
3. Click **Load unpacked** and choose this `extension` folder (the folder with
   `manifest.json`, not the project root).
4. Pin ImageShare using Chrome's extensions menu.

## Save images

- **Right-click an image → Save image to ImageShare.** A small window opens
  with the selected image. Choose a board, adjust its title/notes, and save.
- **Toolbar icon → Choose an image from this page.** Pick from loaded images
  in the current page, or paste a direct image URL.
- Create a board directly in the extension with **New board**.
- The extension remembers your last board. After saving, the backend indexes
  the image for semantic search. Check the main app for success/failure status.

The extension saves a remote image link. Some websites block downloads or use
private/authenticated images; those may save but fail indexing. Download those
images yourself and drag them into a board in the app. Blob/data URLs and CSS
background images are not supported. The page picker lists up to 60 loaded
images at least 80×80 pixels from the main page (not cross-origin iframes).

## Permissions and privacy

- `contextMenus`: the right-click save action.
- `storage`: last-selected board and short-lived image captures.
- `activeTab` + `scripting`: read image URLs and alt text from the page only
  after the user opens the toolbar extension and requests the picker.
- `http://127.0.0.1/*`: communicate with the local ImageShare backend. Chrome
  host patterns cannot restrict the port; extension CSP limits API connections
  to port 5001.

No persistent content script, background page scanning, browsing-history
permission, remote code, analytics, or external API service. Image previews
contact their source websites. Selected image URLs, titles, and notes are sent
to the local Flask API only when Save is clicked.

## Files

- `manifest.json`: permissions, toolbar popup, background worker, and CSP.
- `background.js`: right-click handler; each save window gets its own capture ID.
- `popup.html`, `popup.css`, `popup.js`: board picker, image selection, and save UI.
- `api.js`: local API client and URL validation.

The local API has no accounts yet. This extension is intended for the same
single-user local setup as the website. It is not published to the Chrome Web
Store. After editing extension files, click **Reload** in `chrome://extensions`.
