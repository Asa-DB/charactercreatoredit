const uploadForm = document.getElementById('upload-form');
const characterFileInput = document.getElementById('character-file');
const uploadButton = document.getElementById('upload-button');
const refreshButton = document.getElementById('refresh-button');
const saveStatus = document.getElementById('save-status');
const characterList = document.getElementById('character-list');

const fieldNames = [
  'Skin Color',
  'Clothes Color',
  'Hair Color',
  'Hair Type',
  'Eye Type',
  'Mouth Type',
  'Hair Size',
  'Eye Size',
  'Mouth Size',
  'Hair X',
  'Hair Y',
  'Eye X',
  'Eye Y',
  'Mouth X',
  'Mouth Y',
  'Mouth Rotation',
  'Hair Rotation',
  'Eye Rotation'
];

function setSaveStatus(message) {
  saveStatus.textContent = message;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseCharacterText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');

  return lines.map((value, index) => ({
    label: fieldNames[index] || `Line ${index + 1}`,
    value
  }));
}

function createPreviewUrl(characterText) {
  const query = new URLSearchParams({
    preview: '1',
    avatar: characterText
  });

  return `/creator?${query.toString()}`;
}

function createDetailsSection(lines) {
  return `
    <div class="details-grid">
      ${lines.map((line) => `
        <div>
          <div class="detail-label">${escapeHtml(line.label)}</div>
          <p class="detail-value">${escapeHtml(line.value)}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function renderCharacters(characters) {
  if (characters.length === 0) {
    characterList.innerHTML = '<section class="box empty-state">No saved characters yet.</section>';
    return;
  }

  characterList.innerHTML = characters.map((character) => {
    const lines = parseCharacterText(character.content);
    const savedDate = new Date(character.updatedAt).toLocaleString();

    return `
      <article class="box character-card">
        <div class="avatar-preview">
          <iframe
            class="avatar-preview-frame"
            src="${escapeHtml(createPreviewUrl(character.content))}"
            loading="lazy"
            title="${escapeHtml(character.originalName)} preview"
          ></iframe>
        </div>
        <h2>${escapeHtml(character.originalName)}</h2>
        <p class="character-meta">Saved ${escapeHtml(savedDate)}</p>
        ${createDetailsSection(lines)}
        <div class="raw-data-title">Raw Data</div>
        <pre class="raw-data">${escapeHtml(character.content)}</pre>
      </article>
    `;
  }).join('');
}

async function loadCharacters() {
  setSaveStatus('Loading characters...');

  const response = await fetch('/api/characters');
  if (!response.ok) {
    throw new Error('Could not load characters.');
  }

  const characters = await response.json();
  renderCharacters(characters);
  setSaveStatus('');
}

async function uploadCharacter(file) {
  const content = await file.text();

  const response = await fetch('/api/characters', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filename: file.name,
      content
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Could not save character.' }));
    throw new Error(error.error || 'Could not save character.');
  }
}

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const file = characterFileInput.files[0];
  if (!file) {
    setSaveStatus('Choose a .txt file first.');
    return;
  }

  uploadButton.disabled = true;
  setSaveStatus('Saving character...');

  try {
    await uploadCharacter(file);
    characterFileInput.value = '';
    setSaveStatus('Character saved.');
    await loadCharacters();
  } catch (error) {
    setSaveStatus(error.message);
  } finally {
    uploadButton.disabled = false;
  }
});

refreshButton.addEventListener('click', async () => {
  try {
    await loadCharacters();
  } catch (error) {
    setSaveStatus(error.message);
  }
});

loadCharacters().catch((error) => {
  setSaveStatus(error.message);
});
