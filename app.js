(function () {
  'use strict';

  var DATA = 'data/';
  var PAGE_SIZE = 50;
  var SHARD_SIZE = 300;
  var LOKALISE_BASE = 'https://app.lokalise.com/project/34481794639b9fc4252103.22443160/?k=';

  var searchIndex = [];
  var shardCache = {};
  var currentResults = [];
  var shownCount = 0;
  var stats = null;
  var decidedData = [];
  var proposedData = [];
  var keymap = {};

  var el = {
    searchInput: document.getElementById('searchInput'),
    inconsistentOnly: document.getElementById('inconsistentOnly'),
    resultCount: document.getElementById('resultCount'),
    resultsList: document.getElementById('resultsList'),
    loadMoreWrap: document.getElementById('loadMoreWrap'),
    loadMoreBtn: document.getElementById('loadMoreBtn'),
    findingsSummary: document.getElementById('findingsSummary'),
    placeholderTable: document.getElementById('placeholderTable'),
    longTailList: document.getElementById('longTailList'),
    loadLongTailBtn: document.getElementById('loadLongTailBtn'),
    aboutStats: document.getElementById('aboutStats'),
    overlay: document.getElementById('detailOverlay'),
    detailContent: document.getElementById('detailContent'),
    detailClose: document.getElementById('detailClose'),
    glossaryFilter: document.getElementById('glossaryFilter'),
    decidedList: document.getElementById('decidedList'),
    proposedList: document.getElementById('proposedList'),
    decidedCount: document.getElementById('decidedCount'),
    goToGlossaryBtn: document.getElementById('goToGlossaryBtn'),
  };

  function debounce(fn, ms) {
    var t;
    return function () {
      clearTimeout(t);
      var args = arguments;
      t = setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function statCard(num, label) {
    return '<div class="stat-card"><div class="stat-num">' + num + '</div><div class="stat-label">' + label + '</div></div>';
  }
  function keyTag(path) {
    var id = keymap[path];
    if (id) {
      return '<a class="key-tag key-tag-link" href="' + LOKALISE_BASE + id + '" target="_blank" rel="noopener" title="Open in Lokalise">' +
        escapeHtml(path) + '</a>';
    }
    return '<span class="key-tag">' + escapeHtml(path) + '</span>';
  }
  function keyTags(paths) { return (paths || []).map(keyTag).join(''); }

  // ---------- tabs ----------
  document.getElementById('tabs').addEventListener('click', function (e) {
    var btn = e.target.closest('.tab-btn');
    if (!btn) return;
    activateTab(btn.dataset.tab);
  });
  el.goToGlossaryBtn.addEventListener('click', function () { activateTab('glossary'); });

  function activateTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
    document.querySelectorAll('.tab-panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'tab-' + tab);
    });
    if (tab === 'findings' && !el.placeholderTable.dataset.loaded) loadFindings();
  }

  // ---------- initial data load ----------
  fetch(DATA + 'search_index.json').then(function (r) { return r.json(); }).then(function (data) {
    searchIndex = data;
    runSearch();
  });

  fetch(DATA + 'stats.json').then(function (r) { return r.json(); }).then(function (data) {
    stats = data;
    renderAboutStats();
  });

  fetch(DATA + 'keymap.json').then(function (r) { return r.json(); }).then(function (data) {
    keymap = data;
  });

  Promise.all([
    fetch(DATA + 'glossary_decided.json').then(function (r) { return r.json(); }),
    fetch(DATA + 'glossary_proposed.json').then(function (r) { return r.json(); }),
  ]).then(function (results) {
    decidedData = results[0];
    proposedData = results[1];
    el.decidedCount.textContent = decidedData.length + ' terms';
    drawGlossary();
  });

  // ---------- glossary tab ----------
  function drawGlossary() {
    var q = el.glossaryFilter.value.trim().toLowerCase();
    var decided = !q ? decidedData : decidedData.filter(function (r) { return r.term.toLowerCase().indexOf(q) !== -1; });
    var proposed = !q ? proposedData : proposedData.filter(function (r) { return r.en.toLowerCase().indexOf(q) !== -1; });

    el.decidedList.innerHTML = decided.map(function (row, i) {
      var locales = Object.keys(row.locales).sort();
      var localeRows = locales.map(function (loc) {
        return '<div class="locale-row"><span class="locale-code">' + loc + '</span><span class="variant-text">' +
          escapeHtml(row.locales[loc]) + '</span></div>';
      }).join('');
      return '<div class="term-card" data-idx="' + i + '">' +
        '<div class="term-head"><span class="term-en"></span><span class="term-affected">' + locales.length + ' locales</span></div>' +
        (row.notes ? '<p class="term-notes"></p>' : '') +
        '<div class="term-locales">' + localeRows + '</div>' +
        '</div>';
    }).join('') || '<p class="finding-note">No decided terms match that filter.</p>';
    wireTermCards(el.decidedList, decided, function (row) { return row.term; }, function (row) { return row.notes; });

    el.proposedList.innerHTML = proposed.map(function (row, i) {
      var locales = Object.keys(row.variantsByLocale).sort();
      var localeRows = locales.map(function (loc) {
        var variants = row.variantsByLocale[loc];
        var rec = row.recommended[loc];
        return '<div class="locale-row"><span class="locale-code">' + loc + '</span><span>' +
          variants.map(function (v) {
            var isRec = v.text === rec;
            return '<span class="variant-text' + (isRec ? ' variant-recommended' : '') + '">' +
              (isRec ? '★ ' : '') + escapeHtml(v.text) +
              ' <span class="key-tag-wrap">' + keyTags(v.keys) + '</span></span>';
          }).join('') +
          '</span></div>';
      }).join('');
      return '<div class="term-card" data-idx="' + i + '">' +
        '<div class="term-head"><span class="term-en"></span><span class="term-affected">' + row.localesAffected + ' locales</span></div>' +
        '<div class="term-locales">' + localeRows + '</div>' +
        '</div>';
    }).join('') || '<p class="finding-note">No proposed terms match that filter.</p>';
    wireTermCards(el.proposedList, proposed, function (row) { return row.en; }, function () { return ''; });
  }

  function wireTermCards(container, data, getEn, getNotes) {
    var cards = container.querySelectorAll('.term-card');
    cards.forEach(function (card, i) {
      card.querySelector('.term-en').textContent = getEn(data[i]);
      var notesEl = card.querySelector('.term-notes');
      if (notesEl) notesEl.textContent = getNotes(data[i]);
      card.querySelector('.term-head').addEventListener('click', function () {
        card.classList.toggle('open');
      });
    });
  }

  el.glossaryFilter.addEventListener('input', debounce(drawGlossary, 120));

  // ---------- search index + results ----------
  el.searchInput.addEventListener('input', debounce(runSearch, 120));
  el.inconsistentOnly.addEventListener('change', runSearch);
  el.loadMoreBtn.addEventListener('click', function () { renderResultsPage(); });

  function runSearch() {
    var q = el.searchInput.value.trim().toLowerCase();
    var onlyInc = el.inconsistentOnly.checked;
    currentResults = searchIndex.filter(function (item) {
      if (onlyInc && item.inc === 0) return false;
      if (!q) return true;
      return item.en.toLowerCase().indexOf(q) !== -1;
    });
    currentResults.sort(function (a, b) {
      if (a.inc !== b.inc) return b.inc - a.inc;
      if (a.count !== b.count) return b.count - a.count;
      return a.en.localeCompare(b.en);
    });
    shownCount = 0;
    el.resultsList.innerHTML = '';
    renderResultsPage();
  }

  function renderResultsPage() {
    var slice = currentResults.slice(shownCount, shownCount + PAGE_SIZE);
    slice.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'result-item';
      li.innerHTML =
        '<span class="result-en"></span>' +
        '<span class="result-meta">' +
        (item.count > 1 ? '<span class="count-chip">' + item.count + ' keys</span>' : '') +
        (item.inc > 0 ? '<span class="inc-chip">' + item.inc + ' locale' + (item.inc > 1 ? 's' : '') + ' inconsistent</span>' : '') +
        '</span>';
      li.querySelector('.result-en').textContent = item.en;
      li.addEventListener('click', function () { openDetail(item.id); });
      el.resultsList.appendChild(li);
    });
    shownCount += slice.length;
    el.resultCount.textContent = currentResults.length.toLocaleString() + ' result' + (currentResults.length === 1 ? '' : 's') +
      (currentResults.length ? ' (showing ' + Math.min(shownCount, currentResults.length) + ')' : '');
    el.loadMoreWrap.hidden = shownCount >= currentResults.length;
  }

  // ---------- detail overlay (loads a shard on demand) ----------
  function openDetail(id) {
    var shardNum = Math.floor(id / SHARD_SIZE);
    getShard(shardNum).then(function (shard) {
      var localIdx = id - shardNum * SHARD_SIZE;
      var entry = shard[localIdx];
      renderDetail(entry);
    });
  }

  function getShard(n) {
    if (shardCache[n]) return Promise.resolve(shardCache[n]);
    return fetch(DATA + 'shards/shard_' + n + '.json').then(function (r) { return r.json(); }).then(function (data) {
      shardCache[n] = data;
      return data;
    });
  }

  function renderDetail(entry) {
    var incSet = {};
    (entry.inconsistentLocales || []).forEach(function (l) { incSet[l] = true; });

    var locOrder = Object.keys(entry.translations).sort();
    var rows = locOrder.map(function (loc) {
      var variants = entry.translations[loc];
      var isInc = !!incSet[loc];
      var body;
      if (!variants || variants.length === 0) {
        body = '<span class="detail-locale-empty">not translated / empty</span>';
      } else {
        body = variants.map(function (v) {
          return '<span class="variant-text">' + escapeHtml(v.text) +
            (variants.length > 1 ? ' <span class="key-tag-wrap">' + keyTags(v.keys) + '</span>' : '') +
            '</span>';
        }).join('');
      }
      return '<div class="detail-locale' + (isInc ? ' inconsistent' : '') + '">' +
        '<span class="detail-locale-code">' + loc + '</span>' +
        '<span>' + body + '</span></div>';
    }).join('');

    el.detailContent.innerHTML =
      '<p class="detail-en"></p>' +
      '<p class="detail-meta">Used at ' + entry.count + ' key' + (entry.count > 1 ? 's' : '') +
      (entry.inconsistentLocales.length ? ', inconsistent in ' + entry.inconsistentLocales.length + ' locale' + (entry.inconsistentLocales.length > 1 ? 's' : '') : ', consistent across all locales') +
      '</p>' +
      (entry.count > 1 ? '<p class="detail-keys key-tag-wrap">' + keyTags(entry.keys) + '</p>' : '') +
      '<div class="detail-locales">' + rows + '</div>';
    el.detailContent.querySelector('.detail-en').textContent = entry.en;

    el.overlay.hidden = false;
  }

  el.detailClose.addEventListener('click', closeDetail);
  el.overlay.addEventListener('click', function (e) { if (e.target === el.overlay) closeDetail(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetail(); });
  function closeDetail() { el.overlay.hidden = true; }

  // ---------- findings tab ----------
  function loadFindings() {
    el.placeholderTable.dataset.loaded = '1';
    fetch(DATA + 'inconsistencies_placeholder.json').then(function (r) { return r.json(); }).then(function (data) {
      renderPlaceholderFindings(data);
      renderFindingsSummary(data);
    });
  }

  function renderFindingsSummary(placeholderData) {
    var placeholderRoots = {};
    placeholderData.forEach(function (f) { placeholderRoots[f.en] = true; });
    el.findingsSummary.innerHTML =
      statCard(Object.keys(placeholderRoots).length, 'placeholder mismatches (root causes)') +
      statCard(proposedData.length, 'proposed glossary terms') +
      statCard(stats ? stats.stringsWithInconsistency : '-', 'strings inconsistent somewhere') +
      statCard(stats ? stats.totalDistinctEnglishStrings.toLocaleString() : '-', 'distinct English strings');
  }

  function renderPlaceholderFindings(data) {
    var groups = {};
    data.forEach(function (f) {
      if (!groups[f.en]) groups[f.en] = { en: f.en, locales: [], sample: f.variants };
      groups[f.en].locales.push(f.locale);
    });
    var rows = Object.keys(groups).map(function (en) { return groups[en]; });
    rows.sort(function (a, b) { return b.locales.length - a.locales.length; });

    var html = '<table><thead><tr><th>English source</th><th>Locales affected</th><th>Key using <code>[%1$s:var]</code></th><th>Key using <code>{var}</code></th></tr></thead><tbody>';
    rows.forEach(function (row) {
      var bracket = row.sample.find(function (v) { return /\[%\d+\$/.test(v.text); });
      var curly = row.sample.find(function (v) { return v !== bracket; });
      html += '<tr>' +
        '<td>' + escapeHtml(row.en) + '</td>' +
        '<td>' + row.locales.length + '</td>' +
        '<td>' + (bracket ? keyTags(bracket.keys) : '') + '</td>' +
        '<td>' + (curly ? keyTags(curly.keys) : '') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    el.placeholderTable.innerHTML = html;
  }

  el.loadLongTailBtn.addEventListener('click', function () {
    el.loadLongTailBtn.disabled = true;
    el.loadLongTailBtn.textContent = 'Loading...';
    fetch(DATA + 'inconsistencies_substantive.json').then(function (r) { return r.json(); }).then(function (data) {
      var groups = {};
      data.forEach(function (f) {
        if (!groups[f.en]) groups[f.en] = { en: f.en, locales: [] };
        groups[f.en].locales.push(f.locale);
      });
      var rows = Object.keys(groups).map(function (en) { return groups[en]; });
      rows.sort(function (a, b) { return a.locales.length - b.locales.length || a.en.localeCompare(b.en); });
      el.longTailList.innerHTML = rows.map(function (r) {
        return '<div class="long-tail-row"><strong></strong> - inconsistent in ' + r.locales.length + ' locale' + (r.locales.length > 1 ? 's' : '') + ' (' + r.locales.join(', ') + ')</div>';
      }).join('');
      var strongs = el.longTailList.querySelectorAll('strong');
      strongs.forEach(function (s, i) { s.textContent = rows[i].en; });
      el.loadLongTailBtn.remove();
    });
  });

  function renderAboutStats() {
    if (!stats) return;
    el.aboutStats.textContent = stats.totalKeys.toLocaleString() + ' total keys, ' +
      stats.totalDistinctEnglishStrings.toLocaleString() + ' distinct English strings, ' +
      stats.stringsUsedMoreThanOnce.toLocaleString() + ' strings reused at more than one key, ' +
      stats.stringsWithInconsistency.toLocaleString() + ' strings inconsistent in at least one locale.';
  }
})();
