// Custom SVG icons (defined once as <symbol>s in index.html). In data and feed text an icon written
// as '#name' (e.g. '#chest', '#jail') means "use the custom SVG"; anything else is plain emoji text.
(function () {
  const NS = 'http://www.w3.org/2000/svg';

  function el(name) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'icon-svg icon-' + name);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const use = document.createElementNS(NS, 'use');
    use.setAttribute('href', '#icon-' + name);
    svg.appendChild(use);
    return svg;
  }

  window.SiamIcons = {
    el,
    isToken: (s) => typeof s === 'string' && s.charAt(0) === '#',
    fromToken: (s) => el(s.slice(1))
  };
})();
