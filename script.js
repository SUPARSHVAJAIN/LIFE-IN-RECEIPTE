/**
 * Your Life, In Receipts — Application Logic
 * Architecture:
 *   1. Data layer   → loadData()
 *   2. Render layer → pure render* functions
 *   3. Interaction  → event listeners + state
 */

const AppState = {
  data: null,
  currentFilter: "all",
  currentSearch: "",
  storyIndex: 0
};

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function loadData() {
  try {
    const response = await fetch("life_data.json");
    if (!response.ok) throw new Error("HTTP " + response.status);
    AppState.data = await response.json();
    initApp();
  } catch (err) {
    console.error("Failed to load life_data.json - script.js:33", err);
    document.body.innerHTML =
      '<main style="padding:2rem;font-family:system-ui;color:#c4a574;max-width:40rem;margin:4rem auto;">' +
      "<h1>Unable to load data</h1>" +
      "<p>Please ensure <code>life_data.json</code> is in the same folder and serve over HTTP.</p></main>";
  }
}

function initApp() {
  const data = AppState.data;
  document.getElementById("stat-receipts").textContent =
    (data.receipts.length + data.music.length).toLocaleString();
  document.getElementById("stat-artists").textContent =
    data.top_artists.length + "+";

  renderChapters();
  renderTopArtists();
  renderMusicListens();
  renderAllReceipts();
  bindNavigation();
  bindFilters();
  bindSearch();
  bindStoryMode();
  renderStory();
}

function renderChapters() {
  const grid = document.getElementById("chapters-grid");
  grid.innerHTML = AppState.data.chapters
    .map(function (ch, i) {
      return (
        '<button type="button" class="chapter-card" role="listitem" data-idx="' +
        i +
        '" aria-expanded="false" aria-controls="chapter-detail">' +
        '<div class="chapter-period">' +
        escapeHtml(ch.period || "") +
        "</div>" +
        "<h3>" +
        escapeHtml(ch.title) +
        "</h3>" +
        "<p>" +
        escapeHtml(ch.description) +
        "</p>" +
        '<div class="chapter-insight">' +
        escapeHtml(ch.insight || "") +
        "</div></button>"
      );
    })
    .join("");

  grid.querySelectorAll(".chapter-card").forEach(function (btn) {
    btn.addEventListener("click", function () {
      showChapter(Number(btn.dataset.idx));
    });
  });
}

function showChapter(idx) {
  const ch = AppState.data.chapters[idx];
  const cards = document.querySelectorAll("#chapters-grid .chapter-card");
  cards.forEach(function (c, i) {
    c.setAttribute("aria-expanded", i === idx ? "true" : "false");
  });

  const panel = document.getElementById("chapter-detail");
  panel.hidden = false;
  panel.classList.add("is-visible");

  var htmlCards = "";
  if (ch.receipt_ids) {
    var recs = AppState.data.receipts.filter(function (r) {
      return ch.receipt_ids.indexOf(r.id) !== -1;
    });
    htmlCards = recs.slice(0, 12).map(receiptHTML).join("");
  } else if (ch.artists) {
    htmlCards = ch.artists
      .map(function (a) {
        return (
          '<div class="receipt-card receipt-card--music" role="listitem">' +
          '<div class="receipt-type">Artist</div>' +
          '<div class="receipt-title">' +
          escapeHtml(a) +
          "</div>" +
          '<div class="receipt-meta">Featured in this chapter</div></div>'
        );
      })
      .join("");
  }

  panel.innerHTML =
    '<p class="period">' +
    escapeHtml(ch.period || "") +
    "</p>" +
    "<h2>" +
    escapeHtml(ch.title) +
    "</h2>" +
    '<p class="desc">' +
    escapeHtml(ch.description) +
    "</p>" +
    '<p style="color:var(--accent-soft);font-size:0.85rem;margin-bottom:1.2rem;">' +
    escapeHtml(ch.insight || "") +
    '</p><div class="receipt-grid" role="list">' +
    (htmlCards || '<p style="color:var(--muted)">No individual receipts linked.</p>') +
    "</div>";

  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function receiptHTML(r) {
  var isMusic = r.type === "music";
  var title = isMusic
    ? r.track
    : r.note || r.subcategory || r.category || "Untitled";
  var meta = isMusic
    ? r.artist + (r.album ? " · " + r.album : "") + " · " + r.minutes + " min"
    : (r.category || "") +
      (r.subcategory ? " · " + r.subcategory : "") +
      " · " +
      (r.date || "");
  var amount =
    !isMusic && r.amount
      ? '<div class="receipt-amount">₹' +
        Number(r.amount).toLocaleString() +
        "</div>"
      : "";
  var typeClass = isMusic
    ? "receipt-card--music"
    : r.type === "income"
    ? "receipt-card--income"
    : r.type === "transfer"
    ? "receipt-card--transfer"
    : "receipt-card--purchase";
  var typeLabel = isMusic ? "Music" : r.type || "Purchase";

  return (
    '<article class="receipt-card ' +
    typeClass +
    '" role="listitem">' +
    '<div class="receipt-type">' +
    typeLabel +
    "</div>" +
    '<div class="receipt-title">' +
    escapeHtml(title) +
    "</div>" +
    '<div class="receipt-meta">' +
    escapeHtml(meta) +
    "</div>" +
    amount +
    "</article>"
  );
}

function renderTopArtists() {
  var el = document.getElementById("top-artists");
  el.innerHTML = AppState.data.top_artists
    .map(function (a) {
      return (
        '<div class="artist-pill" role="listitem">' +
        escapeHtml(a.artist) +
        "<span>" +
        a.minutes.toLocaleString() +
        " min</span></div>"
      );
    })
    .join("");
}

function renderMusicListens() {
  var listens = AppState.data.music.slice(0, 24);
  document.getElementById("music-listens").innerHTML = listens
    .map(receiptHTML)
    .join("");
}

function renderAllReceipts() {
  var all = AppState.data.music
    .map(function (m) {
      return Object.assign({}, m, {
        _search: (m.track + " " + m.artist + " " + (m.album || "")).toLowerCase()
      });
    })
    .concat(
      AppState.data.receipts.map(function (r) {
        return Object.assign({}, r, {
          _search: (
            (r.note || "") +
            " " +
            (r.category || "") +
            " " +
            (r.subcategory || "")
          ).toLowerCase()
        });
      })
    );

  var filtered = all;
  var f = AppState.currentFilter;

  if (f === "music") filtered = all.filter(function (r) { return r.type === "music"; });
  else if (f === "purchase")
    filtered = all.filter(function (r) {
      return r.type === "purchase" || r.type === "transfer";
    });
  else if (f === "income")
    filtered = all.filter(function (r) { return r.type === "income"; });
  else if (["Food", "Health", "Transportation"].indexOf(f) !== -1)
    filtered = all.filter(function (r) { return r.category === f; });

  if (AppState.currentSearch) {
    var q = AppState.currentSearch.toLowerCase();
    filtered = filtered.filter(function (r) {
      return r._search.indexOf(q) !== -1;
    });
  }

  filtered.sort(function (a, b) {
    return (b.date || "").localeCompare(a.date || "");
  });

  var show = filtered.slice(0, 60);
  var container = document.getElementById("all-receipts");
  container.innerHTML =
    show.map(receiptHTML).join("") ||
    '<p style="color:var(--muted)">No matching receipts.</p>';

  document.getElementById("results-count").textContent =
    "Showing " + show.length + " of " + filtered.length + " matching receipts";
}

function bindFilters() {
  document.querySelectorAll(".filter-chip").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".filter-chip").forEach(function (b) {
        b.setAttribute("aria-pressed", "false");
      });
      btn.setAttribute("aria-pressed", "true");
      AppState.currentFilter = btn.dataset.filter;
      renderAllReceipts();
    });
  });
}

function bindSearch() {
  var input = document.getElementById("search");
  var timer;
  input.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      AppState.currentSearch = input.value.trim();
      renderAllReceipts();
    }, 220);
  });
}

function bindNavigation() {
  document.querySelectorAll(".nav-list button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".nav-list button").forEach(function (b) {
        b.removeAttribute("aria-current");
      });
      btn.setAttribute("aria-current", "true");
      var target = document.getElementById(btn.dataset.section);
      if (target) target.scrollIntoView({ behavior: "smooth" });
    });
  });
}

function bindStoryMode() {
  document.getElementById("story-prev").addEventListener("click", function () {
    AppState.storyIndex = Math.max(0, AppState.storyIndex - 1);
    renderStory();
  });
  document.getElementById("story-next").addEventListener("click", function () {
    AppState.storyIndex = Math.min(
      AppState.data.chapters.length - 1,
      AppState.storyIndex + 1
    );
    renderStory();
  });
}

function renderStory() {
  var ch = AppState.data.chapters[AppState.storyIndex];
  var total = AppState.data.chapters.length;

  document.getElementById("story-period").textContent =
    "Chapter " + (AppState.storyIndex + 1) + " of " + total + " · " + (ch.period || "");
  document.getElementById("story-title").textContent = ch.title;
  document.getElementById("story-desc").textContent =
    ch.description + (ch.insight ? " — " + ch.insight : "");

  var cards = "";
  if (ch.receipt_ids) {
    var recs = AppState.data.receipts
      .filter(function (r) {
        return ch.receipt_ids.indexOf(r.id) !== -1;
      })
      .slice(0, 8);
    cards = recs.map(receiptHTML).join("");
  } else if (ch.artists) {
    cards = ch.artists
      .map(function (a) {
        return (
          '<div class="receipt-card receipt-card--music" role="listitem">' +
          '<div class="receipt-type">Featured Artist</div>' +
          '<div class="receipt-title">' +
          escapeHtml(a) +
          "</div></div>"
        );
      })
      .join("");
  }
  document.getElementById("story-receipts").innerHTML = cards;
}

loadData();