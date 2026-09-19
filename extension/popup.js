import { api, validImageUrl } from './api.js';

const $ = id => document.getElementById(id);
const captureId = new URLSearchParams(location.search).get('capture');
let connected = false;
let saving = false;
let selectedSaved = false;
let targetTab;

function showError(message) {
  $('error').textContent = message;
  $('error').hidden = !message;
}

function updateSaveButton() {
  $('save').disabled = !connected || saving || selectedSaved || !$('board').value;
}

function preview() {
  const url = $('url').value.trim();
  $('preview-box').hidden = !validImageUrl(url);
  $('preview-error').hidden = true;
  $('preview').hidden = false;
  if (validImageUrl(url)) $('preview').src = url;
  else $('preview').removeAttribute('src');
}
$('preview').addEventListener('error', () => {
  $('preview').hidden = true;
  $('preview-error').hidden = false;
});
$('url').addEventListener('change', preview);
$('board').addEventListener('change', updateSaveButton);

function selectImage(image) {
  $('url').value = image.url;
  $('title').value = (image.title || 'Saved image').slice(0, 150);
  $('page-images').hidden = true;
  $('page-message').hidden = true;
  showError('');
  preview();
}

async function loadBoards(preferred) {
  $('connection').textContent = 'Connecting to ImageShare…';
  try {
    const boards = await api('/boards');
    const stored = await chrome.storage.local.get('lastBoardId');
    const desired = preferred || $('board').value || stored.lastBoardId;
    // Page titles and board names are untrusted text, never HTML.
    $('board').replaceChildren();
    for (const board of boards) {
      $('board').add(new Option(board.title, String(board.id)));
    }
    if (boards.some(board => String(board.id) === String(desired))) $('board').value = String(desired);
    connected = true;
    $('board').disabled = !boards.length;
    $('connection').textContent = `Connected · ${boards.length} ${boards.length === 1 ? 'board' : 'boards'}`;
    $('retry').hidden = true;
    if (!boards.length) {
      $('board').add(new Option('Create a board first', ''));
      $('new-board-fields').hidden = false;
    }
    showError('');
  } catch (error) {
    connected = false;
    $('connection').textContent = 'ImageShare is offline';
    $('retry').hidden = false;
    showError(error.message);
  }
  updateSaveButton();
}
$('retry').addEventListener('click', () => void loadBoards());
$('toggle-new-board').addEventListener('click', () => {
  $('new-board-fields').hidden = !$('new-board-fields').hidden;
  if (!$('new-board-fields').hidden) $('board-name').focus();
});
$('create-board').addEventListener('click', async () => {
  const title = $('board-name').value.trim();
  if (!title) { showError('Enter a name for your new board.'); return; }
  $('create-board').disabled = true;
  try {
    const board = await api('/boards', { title });
    await loadBoards(board.id);
    $('board-name').value = '';
    $('new-board-fields').hidden = true;
  } catch (error) { showError(error.message); }
  finally { $('create-board').disabled = false; }
});

$('save-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (saving || selectedSaved) return;
  const url = $('url').value.trim();
  const title = $('title').value.trim();
  const boardId = $('board').value;
  if (!validImageUrl(url)) { showError('Use a direct http or https image URL (up to 2048 characters).'); return; }
  if (!title || !/^\d+$/.test(boardId)) { showError('Enter a title and choose a board.'); return; }
  saving = true; updateSaveButton(); showError(''); $('save').textContent = 'Saving…';
  try {
    await api(`/boards/${boardId}/images`, { url, title, notes: $('notes').value.trim() });
    // Once the server accepts the image, never offer a retry because local storage
    // failed: that would save a duplicate. Preferences are best-effort only.
    selectedSaved = true;
    $('save-form').hidden = true;
    $('success').hidden = false;
    await chrome.storage.local.set({ lastBoardId: boardId }).catch(() => {});
    if (captureId) await chrome.storage.session.remove(`capture_${captureId}`).catch(() => {});
  } catch (error) {
    showError(error.message);
    $('retry').hidden = false;
  } finally {
    saving = false; $('save').textContent = 'Save to board'; updateSaveButton();
  }
});
$('save-another').addEventListener('click', () => {
  selectedSaved = false;
  $('save-form').hidden = false; $('success').hidden = true;
  $('url').value = ''; $('title').value = ''; $('notes').value = '';
  preview(); updateSaveButton(); $('url').focus();
});

// This script runs only after a toolbar click grants activeTab access and the
// user asks to choose an image. There is no persistent page script or history scan.
$('find-images').addEventListener('click', async () => {
  $('find-images').disabled = true;
  $('page-message').hidden = false;
  $('page-message').textContent = 'Finding images…';
  try {
    if (!targetTab?.id || !/^https?:/.test(targetTab.url || '')) throw new Error('Open a normal webpage, then click the ImageShare toolbar icon. You can also paste an image URL.');
    const results = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id },
      func: () => {
        const seen = new Set();
        return Array.from(document.images).flatMap(image => {
          const url = image.currentSrc || image.src;
          if (!/^https?:/.test(url) || seen.has(url) || image.naturalWidth < 80 || image.naturalHeight < 80) return [];
          seen.add(url);
          return [{ url, title: (image.alt || document.title || 'Saved image').slice(0, 150) }];
        }).slice(0, 60);
      },
    });
    const images = results[0]?.result || [];
    $('page-images').replaceChildren();
    for (const image of images) {
      const button = document.createElement('button');
      button.type = 'button'; button.setAttribute('aria-label', `Select ${image.title}`);
      const thumbnail = document.createElement('img');
      thumbnail.src = image.url; thumbnail.alt = image.title; thumbnail.referrerPolicy = 'no-referrer';
      button.append(thumbnail); button.addEventListener('click', () => selectImage(image));
      $('page-images').append(button);
    }
    $('page-images').hidden = !images.length;
    $('page-message').textContent = images.length ? 'Choose an image below.' : 'No loaded images found. Scroll the page to load images, or right-click an image and save it.';
  } catch (error) {
    $('page-message').textContent = error.message.includes('Cannot access') ? 'Chrome does not allow image access on this page. Try another website or paste an image URL.' : error.message;
  } finally { $('find-images').disabled = false; }
});

async function init() {
  if (captureId) {
    $('find-images').hidden = true;
    const data = await chrome.storage.session.get(`capture_${captureId}`);
    if (data[`capture_${captureId}`]) selectImage(data[`capture_${captureId}`]);
  } else {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    targetTab = tabs[0];
  }
  await loadBoards();
}
init().catch(error => showError(error.message));
