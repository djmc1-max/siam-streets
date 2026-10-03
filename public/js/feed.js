// Live activity feed (GAME_DESIGN.md section 25): newest entry at the bottom, auto-scrolling.
(function () {
  const MAX_ENTRIES = 300;
  const el = () => document.getElementById('feed');

  function add(icon, text) {
    const list = el();
    const li = document.createElement('li');
    const i = document.createElement('span');
    i.className = 'feed-icon';
    if (window.SiamIcons.isToken(icon)) i.appendChild(window.SiamIcons.fromToken(icon)); // '#chest', '#jail'
    else i.textContent = icon;
    const t = document.createElement('span');
    t.textContent = text; // textContent: player names are user input
    li.append(i, t);
    list.appendChild(li);
    while (list.children.length > MAX_ENTRIES) list.removeChild(list.firstChild);
    list.scrollTop = list.scrollHeight;
  }

  function clear() { el().replaceChildren(); }

  window.SiamFeed = { add, clear };
})();
