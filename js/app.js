let allWords = [];
let filteredWords = [];
let currentPage = 1;
let showFavoritesOnly = false;
let isRandomMode = false;
let randomHistory = [];
let randomHistoryIndex = -1;

const wordsPerPage = 100;
const favoritesKey = "vocabularyFavorites";

const wordList = document.getElementById("wordList");
const pageInfo = document.getElementById("pageInfo");

function getFavorites() {
  return JSON.parse(localStorage.getItem(favoritesKey)) || [];
}

function saveFavorites(favorites) {
  localStorage.setItem(favoritesKey, JSON.stringify(favorites));
}

function isFavorite(wordId) {
  return getFavorites().includes(wordId);
}

function toggleFavorite(wordId) {
  let favorites = getFavorites();

  if (favorites.includes(wordId)) {
    favorites = favorites.filter(id => id !== wordId);
  } else {
    favorites.push(wordId);
  }

  saveFavorites(favorites);
  updateFavoritesButton();
  renderCurrentView();
}

function updateFavoritesButton() {
  const count = getFavorites().length;
  const btn = document.getElementById("favoritesBtn");

  btn.textContent = showFavoritesOnly
    ? `★ Favorites Only (${count})`
    : `⭐ Favorites (${count})`;
}

async function loadData() {
  wordList.innerHTML = "<p>Loading vocabulary data...</p>";

  try {
    const manifestResponse = await fetch("data/manifest.json");

    if (!manifestResponse.ok) {
      throw new Error("Cannot load data/manifest.json");
    }

    const manifest = await manifestResponse.json();

    const wordFiles = await Promise.all(
      manifest.map(async item => {
        const response = await fetch(item.file);

        if (!response.ok) {
          throw new Error("Cannot load file: " + item.file);
        }

        return response.json();
      })
    );

    allWords = wordFiles.flat();

    populateFilters(manifest);
    updateFavoritesButton();

    filteredWords = [...allWords];

    renderWords();
  } catch (error) {
    console.error("Load Error:", error);

    wordList.innerHTML = `
      <div class="word-card">
        <strong>資料載入失敗</strong>
        <p>${error.message}</p>
      </div>
    `;
  }
}

function populateFilters(manifest) {
  const bookFilter = document.getElementById("bookFilter");
  const unitFilter = document.getElementById("unitFilter");

  bookFilter.innerHTML = `<option value="">All Books</option>`;
  unitFilter.innerHTML = `<option value="">All Units</option>`;

  const books = [...new Set(manifest.map(item => item.book))];
  const units = [...new Set(manifest.map(item => item.unit))];

  books.forEach(book => {
    const option = document.createElement("option");
    option.value = book;
    option.textContent = book;
    bookFilter.appendChild(option);
  });

  units.forEach(unit => {
    const option = document.createElement("option");
    option.value = unit;
    option.textContent = `Unit ${unit}`;
    unitFilter.appendChild(option);
  });
}

function createWordCard(word) {
  const card = document.createElement("div");
  card.className = "word-card";

  const star = isFavorite(word.id)
    ? '<span style="color:#f4c542">★</span>'
    : '<span style="color:#999">☆</span>';

  const safeWord = escapeForSpeech(word.word || "");
  const safeExample = escapeForSpeech(word.example || "");

  card.innerHTML = `
    <div class="word-header">
      <div>
        <div class="word-title">${word.word || ""}</div>
        <div class="ipa">${word.ipa || ""}</div>
      </div>

      <button class="favorite-star" onclick="toggleFavorite('${word.id}')">
        ${star}
      </button>
    </div>

    <div class="part-of-speech">${word.partOfSpeech || ""}</div>
    <div class="definition">${word.definition || ""}</div>
    <div class="example">${word.example || ""}</div>

    <div class="card-buttons">
      <button onclick="speakText('${safeWord}')">🔊 Word</button>
      <button onclick="speakText('${safeExample}')">🔊 Example</button>
    </div>
  `;

  return card;
}

function renderWords() {
  isRandomMode = false;
  wordList.innerHTML = "";

  if (filteredWords.length === 0) {
    wordList.innerHTML = `
      <div class="word-card">
        <strong>No words found.</strong>
      </div>
    `;
    pageInfo.textContent = "Page 1 / 1";
    return;
  }

  const start = (currentPage - 1) * wordsPerPage;
  const end = start + wordsPerPage;
  const pageWords = filteredWords.slice(start, end);

  pageWords.forEach(word => {
    wordList.appendChild(createWordCard(word));
  });

  const totalPages = Math.max(1, Math.ceil(filteredWords.length / wordsPerPage));
  pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;
}

function applyFilters() {
  const searchText = document
    .getElementById("searchInput")
    .value
    .toLowerCase()
    .trim();

  const selectedBook = document.getElementById("bookFilter").value;
  const selectedUnit = document.getElementById("unitFilter").value;
  const favorites = getFavorites();

  filteredWords = allWords.filter(word => {
    const matchSearch =
      !searchText ||
      (word.word || "").toLowerCase().includes(searchText);

    const matchBook =
      !selectedBook ||
      word.book === selectedBook;

    const matchUnit =
      !selectedUnit ||
      String(word.unit) === selectedUnit;

    const matchFavorite =
      !showFavoritesOnly ||
      favorites.includes(word.id);

    return matchSearch && matchBook && matchUnit && matchFavorite;
  });

  currentPage = 1;
  randomHistory = [];
  randomHistoryIndex = -1;

  renderWords();
}

function showRandomWord() {
  applyRandomFilterOnly();

  if (filteredWords.length === 0) {
    wordList.innerHTML = `
      <div class="word-card">
        <strong>No words available for random practice.</strong>
      </div>
    `;
    pageInfo.textContent = "🎲 Random Mode";
    return;
  }

  isRandomMode = true;

  const randomIndex = Math.floor(Math.random() * filteredWords.length);
  const randomWord = filteredWords[randomIndex];

  randomHistory = randomHistory.slice(0, randomHistoryIndex + 1);
  randomHistory.push(randomWord);
  randomHistoryIndex++;

  renderRandomWord(randomWord);
}

function renderRandomWord(word) {
  wordList.innerHTML = "";
  wordList.appendChild(createWordCard(word));

  const selectedUnit = document.getElementById("unitFilter").value;
  const unitText = selectedUnit ? `Unit ${selectedUnit}` : "All Units";

  pageInfo.textContent =
    `🎲 Random Mode | ${unitText} | ${filteredWords.length} word(s) available`;
}

function applyRandomFilterOnly() {
  const searchText = document
    .getElementById("searchInput")
    .value
    .toLowerCase()
    .trim();

  const selectedBook = document.getElementById("bookFilter").value;
  const selectedUnit = document.getElementById("unitFilter").value;
  const favorites = getFavorites();

  filteredWords = allWords.filter(word => {
    const matchSearch =
      !searchText ||
      (word.word || "").toLowerCase().includes(searchText);

    const matchBook =
      !selectedBook ||
      word.book === selectedBook;

    const matchUnit =
      !selectedUnit ||
      String(word.unit) === selectedUnit;

    const matchFavorite =
      !showFavoritesOnly ||
      favorites.includes(word.id);

    return matchSearch && matchBook && matchUnit && matchFavorite;
  });
}

function renderCurrentView() {
  if (isRandomMode && randomHistory[randomHistoryIndex]) {
    renderRandomWord(randomHistory[randomHistoryIndex]);
  } else {
    renderWords();
  }
}

function escapeForSpeech(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, " ");
}

function speakText(text) {
  const speed = Number(document.getElementById("speedSelect").value);

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = speed;

  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

document.getElementById("searchInput").addEventListener("input", applyFilters);
document.getElementById("bookFilter").addEventListener("change", applyFilters);
document.getElementById("unitFilter").addEventListener("change", applyFilters);

document.getElementById("favoritesBtn").addEventListener("click", () => {
  showFavoritesOnly = !showFavoritesOnly;
  updateFavoritesButton();
  applyFilters();
});

document.getElementById("randomBtn").addEventListener("click", showRandomWord);

document.getElementById("clearBtn").addEventListener("click", () => {
  document.getElementById("searchInput").value = "";
  document.getElementById("bookFilter").value = "";
  document.getElementById("unitFilter").value = "";

  showFavoritesOnly = false;
  isRandomMode = false;
  randomHistory = [];
  randomHistoryIndex = -1;

  updateFavoritesButton();

  filteredWords = [...allWords];
  currentPage = 1;
  renderWords();
});

document.getElementById("prevPage").addEventListener("click", () => {
  if (isRandomMode) {
    if (randomHistoryIndex > 0) {
      randomHistoryIndex--;
      renderRandomWord(randomHistory[randomHistoryIndex]);
    }
    return;
  }

  if (currentPage > 1) {
    currentPage--;
    renderWords();
  }
});

document.getElementById("nextPage").addEventListener("click", () => {
  if (isRandomMode) {
    showRandomWord();
    return;
  }

  const totalPages = Math.ceil(filteredWords.length / wordsPerPage);

  if (currentPage < totalPages) {
    currentPage++;
    renderWords();
  }
});

loadData();