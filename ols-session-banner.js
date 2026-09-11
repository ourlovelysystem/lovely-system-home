(function () {
  // Governance-reviewable setting: how long a shared session stays valid.
  // Refreshed on every page load (rolling window), so an active visitor's
  // session naturally extends; an inactive one expires after this many minutes.
  // Reduced from 30 days to 30 minutes for testing (2026-09-11) - matches the
  // account-global /ourlovelysystem/session/lifetime-minutes SSM parameter
  // used server-side for DynamoDB session TTL; not auto-synced, keep in step manually.
  var SESSION_EXPIRY_MINUTES = 30;

  var COOKIE_NAME = 'ols_session';
  var COOKIE_DOMAIN = '.ourlovelysystem.org';

  function readCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function writeSession(session, maxAgeSeconds) {
    var value = encodeURIComponent(JSON.stringify(session));
    var attrs = [
      COOKIE_NAME + '=' + value,
      'Domain=' + COOKIE_DOMAIN,
      'Path=/',
      'Max-Age=' + maxAgeSeconds,
      'Secure',
      'SameSite=Lax'
    ];
    document.cookie = attrs.join('; ');
  }

  function deleteSession() {
    writeSession({}, 0);
  }

  function readSession() {
    var raw = readCookie(COOKIE_NAME);
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed.session_id === 'string') return parsed;
    } catch (e) {}
    return null;
  }

  function getOrCreateSession() {
    var session = readSession();
    if (!session) {
      session = { session_id: crypto.randomUUID(), display_name: '' };
    }
    writeSession(session, SESSION_EXPIRY_MINUTES * 60);
    return session;
  }

  function renderBanner(session) {
    var style = document.createElement('style');
    style.textContent = [
      '.ols-session-banner { position: fixed; top: 0; left: 0; right: 0; width: 100%;',
      '  margin: 0; box-sizing: border-box; z-index: 9999; display: flex;',
      '  align-items: center; gap: 10px; padding: 6px 12px; background: #f0f0f0;',
      '  border-bottom: 1px solid #ddd; font-family: ui-monospace, monospace;',
      '  font-size: 0.75rem; color: #444; flex-wrap: wrap; }',
      '.ols-session-banner .ols-sep { color: #bbb; }',
      '.ols-session-banner input { font: inherit; padding: 2px 6px; border: 1px solid #ccc;',
      '  border-radius: 4px; width: 160px; }',
      '.ols-session-banner button { font: inherit; padding: 2px 8px; border: 1px solid #ccc;',
      '  border-radius: 4px; background: #fff; cursor: pointer; }',
      '.ols-session-banner button:hover { background: #e8e8e8; }'
    ].join('\n');
    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.className = 'ols-session-banner';

    var idLabel = document.createElement('span');
    idLabel.textContent = 'session: ' + session.session_id;
    bar.appendChild(idLabel);

    var sep1 = document.createElement('span');
    sep1.className = 'ols-sep';
    sep1.textContent = '|';
    bar.appendChild(sep1);

    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'name (optional)';
    nameInput.maxLength = 200;
    nameInput.value = session.display_name || '';
    bar.appendChild(nameInput);

    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.textContent = 'Update name';
    function saveName() {
      session.display_name = nameInput.value.trim();
      writeSession(session, SESSION_EXPIRY_MINUTES * 60);
      var original = saveBtn.textContent;
      saveBtn.textContent = 'Saved';
      setTimeout(function () { saveBtn.textContent = original; }, 1000);
    }
    saveBtn.addEventListener('click', saveName);
    nameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') saveName();
    });
    bar.appendChild(saveBtn);

    var sep2 = document.createElement('span');
    sep2.className = 'ols-sep';
    sep2.textContent = '|';
    bar.appendChild(sep2);

    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear session';
    clearBtn.addEventListener('click', function () {
      deleteSession();
      window.location.reload();
    });
    bar.appendChild(clearBtn);

    document.body.insertBefore(bar, document.body.firstChild);

    // Banner is fixed (removed from normal flow) so it doesn't inherit each
    // page's own body margin/max-width - push page content down by its
    // rendered height instead, on top of whatever spacing the page already had.
    function reserveSpace() {
      var basePadding = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
      if (!document.body.dataset.olsBasePadding) {
        document.body.dataset.olsBasePadding = String(basePadding);
      }
      var base = parseFloat(document.body.dataset.olsBasePadding);
      document.body.style.paddingTop = (base + bar.offsetHeight) + 'px';
    }
    reserveSpace();
    window.addEventListener('resize', reserveSpace);
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderBanner(getOrCreateSession());
  });
})();
