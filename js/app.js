let allWords = [];
let filteredWords = [];
let manifestData = [];

let currentPage = 1;
let showFavoritesOnly = false;
let isRandomMode = false;
let isQuizMode = false;
let randomHistory = [];
let randomHistoryIndex = -1;
let currentQuizAnswer = null;

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

function getFavoriteId(word) {
  if (word.favoriteId) return word.favoriteId;
  return `${word.book || "Book"}__${word.unit || "Unit"}__${word.id || word.word || "word"}`;
}

function isFavorite(word) {
  return getFavorites().includes(getFavoriteId(word));
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

    manifestData = await manifestResponse.json();

    const wordFiles = await Promise.all(
      manifestData.map(async item => {
        const response = await fetch(item.file);

        if (!response.ok) {
          throw new Error("Cannot load file: " + item.file);
        }

        const words = await response.json();

        return words.map(word => ({
          ...word,
          book: item.book,
          level: item.level,
          unit: item.unit,
          unitTitle: item.unitTitle || item.unit,
          category: word.category || item.unitTitle || item.unit,
          favoriteId: `${item.book}__${item.unit}__${word.id || word.word || word.past || word.pp}`
        }));
      })
    );

    allWords = wordFiles.flat();
    filteredWords = [...allWords];

    populateBookFilter();
    populateUnitFilter();
    updateFavoritesButton();
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

function populateBookFilter() {
  const bookFilter = document.getElementById("bookFilter");

  bookFilter.innerHTML = `<option value="">All Books</option>`;

  const books = [...new Set(manifestData.map(item => item.book))];

  books.forEach(book => {
    const option = document.createElement("option");
    option.value = book;
    option.textContent = book;
    bookFilter.appendChild(option);
  });
}

function populateUnitFilter() {
  const unitFilter = document.getElementById("unitFilter");
  const selectedBook = document.getElementById("bookFilter").value;

  unitFilter.innerHTML = `<option value="">All Categories</option>`;

  if (selectedBook === "Verb Forms") {
    ["All Verbs", "Regular Verbs", "Irregular Verbs"].forEach((label, index) => {
      if (index === 0) return;
      const option = document.createElement("option");
      option.value = label;
      option.textContent = label;
      unitFilter.appendChild(option);
    });
    return;
  }

  const units = manifestData.filter(item => {
    return !selectedBook || item.book === selectedBook;
  });

  units.forEach(item => {
    const option = document.createElement("option");
    option.value = String(item.unit);

    if (item.book === "Daily English") {
      option.textContent = item.unitTitle || item.unit;
    } else {
      option.textContent =
        item.unitTitle && item.unitTitle !== `Unit ${item.unit}`
          ? `Unit ${item.unit} - ${item.unitTitle}`
          : `Unit ${item.unit}`;
    }

    unitFilter.appendChild(option);
  });
}

function createWordCard(word) {
  if (word.book === "Verb Forms") {
    return createVerbFormCard(word);
  }

  const card = document.createElement("div");
  card.className = "word-card";

  const favoriteId = getFavoriteId(word);
  const star = isFavorite(word)
    ? '<span style="color:#f4c542">★</span>'
    : '<span style="color:#999">☆</span>';

  const safeWord = escapeForSpeech(word.word || "");
  const safeExample1 = escapeForSpeech(word.example || "");
  const safeExample2 = escapeForSpeech(word.example2 || "");
  const safeExample3 = escapeForSpeech(word.example3 || "");

  card.innerHTML = `
    <div class="word-header">
      <div>
        <div class="word-title">${word.word || ""}</div>
        <div class="ipa">${word.ipa || ""}</div>
      </div>

      <button class="favorite-star" onclick="toggleFavorite('${favoriteId}')">
        ${star}
      </button>
    </div>

    <div class="part-of-speech">${word.partOfSpeech || ""}</div>
    <div class="definition">${word.definition || ""}</div>

    ${word.example ? `<div class="example">${word.example}</div>` : ""}
    ${word.example2 ? `<div class="example">${word.example2}</div>` : ""}
    ${word.example3 ? `<div class="example">${word.example3}</div>` : ""}

    <div class="card-buttons">
      <button onclick="speakText('${safeWord}')">🔊 Word</button>
      ${word.example ? `<button onclick="speakText('${safeExample1}')">🔊 Ex 1</button>` : ""}
      ${word.example2 ? `<button onclick="speakText('${safeExample2}')">🔊 Ex 2</button>` : ""}
      ${word.example3 ? `<button onclick="speakText('${safeExample3}')">🔊 Ex 3</button>` : ""}
    </div>
  `;

  return card;
}

function createVerbFormCard(word) {
  const card = document.createElement("div");
  card.className = "word-card verb-card";

  const favoriteId = getFavoriteId(word);
  const star = isFavorite(word)
    ? '<span style="color:#f4c542">★</span>'
    : '<span style="color:#999">☆</span>';

  const safeSpeak1 = escapeForSpeech(word.speak1 || word.word || "");
  const safeSpeak2 = escapeForSpeech(word.speak2 || word.past || "");
  const safeSpeak3 = escapeForSpeech(word.speak3 || word.pp || "");

  card.innerHTML = `
    <div class="verb-row">
      <div class="verb-sound-cell">
        <button class="verb-sound-btn" onclick="speakVerbForms('${safeSpeak1}', '${safeSpeak2}', '${safeSpeak3}')">🔊</button>
      </div>

      <div class="verb-cell">
        <div class="verb-label">Base Form</div>
        <div class="verb-word">${word.word || ""}</div>
        <div class="ipa">${word.ipa1 || ""}</div>
      </div>

      <div class="verb-cell">
        <div class="verb-label">Past Simple</div>
        <div class="verb-word">${word.past || ""}</div>
        <div class="ipa">${word.ipa2 || ""}</div>
      </div>

      <div class="verb-cell">
        <div class="verb-label">Past Participle</div>
        <div class="verb-word">${word.pp || ""}</div>
        <div class="ipa">${word.ipa3 || ""}</div>
      </div>

      <div class="verb-favorite-cell">
        <button class="favorite-star" onclick="toggleFavorite('${favoriteId}')">${star}</button>
      </div>
    </div>
  `;

  return card;
}

function renderWords() {
  isRandomMode = false;
  isQuizMode = false;
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

function getSearchText(word) {
  return [
    word.word,
    word.past,
    word.pp,
    word.ipa,
    word.ipa1,
    word.ipa2,
    word.ipa3,
    word.partOfSpeech,
    word.definition,
    word.example,
    word.example2,
    word.example3
  ].filter(Boolean).join(" ").toLowerCase();
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
      getSearchText(word).includes(searchText);

    const matchBook =
      !selectedBook ||
      word.book === selectedBook;

    const matchUnit =
      !selectedUnit ||
      (word.book === "Verb Forms"
        ? word.category === selectedUnit
        : String(word.unit) === String(selectedUnit));

    const matchFavorite =
      !showFavoritesOnly ||
      favorites.includes(getFavoriteId(word));

    return matchSearch && matchBook && matchUnit && matchFavorite;
  });

  filteredWords.sort((a, b) => {
    return String(a.word || "").localeCompare(String(b.word || ""));
  });

  currentPage = 1;
  randomHistory = [];
  randomHistoryIndex = -1;
  isQuizMode = false;

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
  isQuizMode = false;

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
  const unitText = selectedUnit ? selectedUnit : "All Categories";

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
      getSearchText(word).includes(searchText);

    const matchBook =
      !selectedBook ||
      word.book === selectedBook;

    const matchUnit =
      !selectedUnit ||
      (word.book === "Verb Forms"
        ? word.category === selectedUnit
        : String(word.unit) === String(selectedUnit));

    const matchFavorite =
      !showFavoritesOnly ||
      favorites.includes(getFavoriteId(word));

    return matchSearch && matchBook && matchUnit && matchFavorite;
  });

  filteredWords.sort((a, b) => {
    return String(a.word || "").localeCompare(String(b.word || ""));
  });
}

function renderCurrentView() {
  if (isQuizMode) {
    showQuizQuestion();
  } else if (isRandomMode && randomHistory[randomHistoryIndex]) {
    renderRandomWord(randomHistory[randomHistoryIndex]);
  } else {
    renderWords();
  }
}

function escapeForSpeech(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
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

function speakWithPause(texts, index = 0) {
  if (index >= texts.length) return;

  const speed = Number(document.getElementById("speedSelect").value);
  const utterance = new SpeechSynthesisUtterance(texts[index]);
  utterance.lang = "en-US";
  utterance.rate = speed;

  utterance.onend = () => {
    setTimeout(() => speakWithPause(texts, index + 1), 100);
  };

  speechSynthesis.speak(utterance);
}

function speakVerbForms(base, past, pp) {
  speechSynthesis.cancel();
  speakWithPause([base, past, pp]);
}

function startQuizMode() {
  document.getElementById("bookFilter").value = "Verb Forms";
  populateUnitFilter();
  applyRandomFilterOnly();

  isQuizMode = true;
  isRandomMode = false;
  showQuizQuestion();
}

function showQuizQuestion() {
  applyRandomFilterOnly();

  const quizWords = filteredWords.filter(word => word.book === "Verb Forms");

  if (quizWords.length === 0) {
    wordList.innerHTML = `
      <div class="word-card">
        <strong>No verb forms available for quiz.</strong>
      </div>
    `;
    pageInfo.textContent = "📝 Quiz Mode";
    return;
  }

  const word = quizWords[Math.floor(Math.random() * quizWords.length)];
  const quizTypes = ["base", "past", "pp"];
  const quizType = quizTypes[Math.floor(Math.random() * quizTypes.length)];

  let questionHtml = "";
  let answer = {};

  if (quizType === "base") {
    questionHtml = `
      <div class="quiz-given">${word.word} <span>${word.ipa1 || ""}</span></div>
      <label>Past Simple</label>
      <input id="quizAnswer1" type="text" autocomplete="off" />
      <label>Past Participle</label>
      <input id="quizAnswer2" type="text" autocomplete="off" />
    `;
    answer = { first: word.past, second: word.pp };
  }

  if (quizType === "past") {
    questionHtml = `
      <div class="quiz-given">${word.past} <span>${word.ipa2 || ""}</span></div>
      <label>Base Form</label>
      <input id="quizAnswer1" type="text" autocomplete="off" />
      <label>Past Participle</label>
      <input id="quizAnswer2" type="text" autocomplete="off" />
    `;
    answer = { first: word.word, second: word.pp };
  }

  if (quizType === "pp") {
    questionHtml = `
      <div class="quiz-given">${word.pp} <span>${word.ipa3 || ""}</span></div>
      <label>Base Form</label>
      <input id="quizAnswer1" type="text" autocomplete="off" />
      <label>Past Simple</label>
      <input id="quizAnswer2" type="text" autocomplete="off" />
    `;
    answer = { first: word.word, second: word.past };
  }

  currentQuizAnswer = { ...answer, word };

  wordList.innerHTML = `
    <div class="word-card quiz-card">
      <h2>Verb Forms Quiz</h2>
      ${questionHtml}
      <div class="card-buttons quiz-buttons">
        <button onclick="checkQuizAnswer()">Check</button>
        <button onclick="showQuizQuestion()">Next Question</button>
        <button onclick="speakVerbForms('${escapeForSpeech(word.speak1 || word.word)}', '${escapeForSpeech(word.speak2 || word.past)}', '${escapeForSpeech(word.speak3 || word.pp)}')">🔊 Pronounce</button>
      </div>
      <div id="quizResult" class="quiz-result"></div>
    </div>
  `;

  pageInfo.textContent = `📝 Quiz Mode | ${quizWords.length} verb(s) available`;
}

function normalizeAnswer(text) {
  return String(text || "").toLowerCase().trim();
}

function checkQuizAnswer() {
  if (!currentQuizAnswer) return;

  const userAnswer1 = normalizeAnswer(document.getElementById("quizAnswer1").value);
  const userAnswer2 = normalizeAnswer(document.getElementById("quizAnswer2").value);

  const correct1 = normalizeAnswer(currentQuizAnswer.first);
  const correct2 = normalizeAnswer(currentQuizAnswer.second);

  const isCorrect1 = userAnswer1 === correct1;
  const isCorrect2 = userAnswer2 === correct2;

  const result = document.getElementById("quizResult");

  if (isCorrect1 && isCorrect2) {
    result.innerHTML = `<strong class="correct">Correct!</strong>`;
  } else {
    result.innerHTML = `
      <strong class="wrong">Try again.</strong>
      <div>Correct answer:</div>
      <div>${currentQuizAnswer.word.word} ${currentQuizAnswer.word.ipa1 || ""}</div>
      <div>${currentQuizAnswer.word.past} ${currentQuizAnswer.word.ipa2 || ""}</div>
      <div>${currentQuizAnswer.word.pp} ${currentQuizAnswer.word.ipa3 || ""}</div>
    `;
  }
}

document.getElementById("searchInput").addEventListener("input", applyFilters);

document.getElementById("bookFilter").addEventListener("change", () => {
  populateUnitFilter();
  document.getElementById("unitFilter").value = "";
  applyFilters();
});

document.getElementById("unitFilter").addEventListener("change", applyFilters);

document.getElementById("favoritesBtn").addEventListener("click", () => {
  showFavoritesOnly = !showFavoritesOnly;
  updateFavoritesButton();
  applyFilters();
});

document.getElementById("randomBtn").addEventListener("click", showRandomWord);
document.getElementById("quizBtn").addEventListener("click", startQuizMode);

document.getElementById("clearBtn").addEventListener("click", () => {
  document.getElementById("searchInput").value = "";
  document.getElementById("bookFilter").value = "";
  document.getElementById("unitFilter").value = "";

  showFavoritesOnly = false;
  isRandomMode = false;
  isQuizMode = false;
  randomHistory = [];
  randomHistoryIndex = -1;

  populateUnitFilter();
  updateFavoritesButton();

  filteredWords = [...allWords];
  currentPage = 1;
  renderWords();
});

document.getElementById("prevPage").addEventListener("click", () => {
  if (isQuizMode) {
    showQuizQuestion();
    return;
  }

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
  if (isQuizMode) {
    showQuizQuestion();
    return;
  }

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
