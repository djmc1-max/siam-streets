// Board artwork: SVG <symbol>s for the corner squares, the other square icons and the 3D buildings.
// Injected once at load; squares reference them with <use href="#art-...">.
(function () {
  const defs = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
  <pattern id="a-check" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#fff"/><rect width="8" height="8" fill="#111"/><rect x="8" y="8" width="8" height="8" fill="#111"/></pattern>
  <linearGradient id="a-start-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#19a357"/><stop offset="1" stop-color="#054a26"/></linearGradient>
  <linearGradient id="a-prison-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9741a"/><stop offset="1" stop-color="#7a3304"/></linearGradient>
  <linearGradient id="a-songkran-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2eb4ff"/><stop offset="1" stop-color="#0a62d6"/></linearGradient>
  <linearGradient id="a-police-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0243a"/><stop offset=".5" stop-color="#6b1d8a"/><stop offset="1" stop-color="#1c3fb8"/></linearGradient>
  <linearGradient id="a-pole" x1="0" x2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset="1" stop-color="#b87410"/></linearGradient>
  <linearGradient id="a-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6f8ff"/><stop offset="1" stop-color="#4fc3ff"/></linearGradient>
  <linearGradient id="a-skull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c9d0e0"/></linearGradient>
  <radialGradient id="a-siren-r" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#ffd0d0"/><stop offset=".35" stop-color="#ff3b4a"/><stop offset="1" stop-color="#8f0a18"/></radialGradient>
  <radialGradient id="a-siren-b" cx=".6" cy=".3" r=".8"><stop offset="0" stop-color="#d0e2ff"/><stop offset=".35" stop-color="#3b6bff"/><stop offset="1" stop-color="#0c2a8f"/></radialGradient>
  <radialGradient id="a-halo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <linearGradient id="a-coin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#f6c53a"/><stop offset="1" stop-color="#b87410"/></linearGradient>
  <linearGradient id="a-gem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8ffff"/><stop offset=".5" stop-color="#5de0ff"/><stop offset="1" stop-color="#1d7fd8"/></linearGradient>
  <linearGradient id="a-star" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7c0"/><stop offset="1" stop-color="#ffb52e"/></linearGradient>


  <!-- ===== logo emblem: purple glass ellipse, double gold ring, engraved gold lettering ===== -->
  <radialGradient id="l-purple" cx=".5" cy=".3" r=".85"><stop offset="0" stop-color="#8a4af0"/><stop offset=".5" stop-color="#4a1aa8"/><stop offset="1" stop-color="#16053f"/></radialGradient>
  <linearGradient id="l-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b8"/><stop offset=".3" stop-color="#f5c542"/><stop offset=".6" stop-color="#b9770c"/><stop offset=".8" stop-color="#ffe08a"/><stop offset="1" stop-color="#c58a14"/></linearGradient>
  <linearGradient id="l-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff8d6"/><stop offset=".38" stop-color="#f8d160"/><stop offset=".72" stop-color="#e39a1f"/><stop offset="1" stop-color="#a8620c"/></linearGradient>
  <linearGradient id="l-shine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <radialGradient id="l-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#b784ff" stop-opacity=".65"/><stop offset="1" stop-color="#b784ff" stop-opacity="0"/></radialGradient>
  <filter id="l-shadow" x="-10%" y="-20%" width="120%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="2.200" flood-color="#1a0840" flood-opacity=".9"/></filter>
  <symbol id="logo-emblem" viewBox="0 0 600 330">
    <ellipse cx="300" cy="165" rx="300" ry="165" fill="url(#l-glow)"/>
    <ellipse cx="300" cy="165" rx="284" ry="148" fill="url(#l-purple)" stroke="url(#l-ring)" stroke-width="8"/>
    <ellipse cx="300" cy="165" rx="266" ry="130" fill="none" stroke="url(#l-ring)" stroke-width="2.600"/>
    <path d="M44 150C60 60 170 36 300 36s240 24 256 114C500 104 400 84 300 84S100 104 44 150Z" fill="url(#l-shine)"/>
    <g filter="url(#l-shadow)" font-family="'Cinzel Decorative', Georgia, 'Times New Roman', serif" font-weight="900" text-anchor="middle" letter-spacing="5">
      <text x="300" y="150" font-size="92" textLength="318" lengthAdjust="spacingAndGlyphs" fill="url(#l-gold)" stroke="#4a2600" stroke-width="2.200" paint-order="stroke">SIAM</text>
      <text x="300" y="240" font-size="66" textLength="400" lengthAdjust="spacingAndGlyphs" fill="url(#l-gold)" stroke="#4a2600" stroke-width="2" paint-order="stroke">STREETS</text>
    </g>
    <use href="#logo-orn" x="222" y="153" width="156" height="20"/>
    <g fill="#fff6c8">
      <path id="l-spark" d="M62 62l5 15 15 5-15 5-5 15-5-15-15-5 15-5z"/>
      <use href="#l-spark" transform="translate(440 -22) scale(.8)"/>
      <use href="#l-spark" transform="translate(-14 170) scale(.7)"/>
      <use href="#l-spark" transform="translate(454 150) scale(.9)"/>
      <use href="#l-spark" transform="translate(250 -30) scale(.5)"/>
    </g>
  </symbol>

  <!-- ===== corners (square art, drawn to fill the whole corner) ===== -->
  <symbol id="art-start" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
    <rect width="100" height="100" fill="url(#a-start-bg)"/>
    <g fill="#fff" opacity=".13"><path d="M50 50 0 0h20zM50 50 40 0h20zM50 50 80 0H100zM50 50 100 30v20zM50 50 0 40v20z"/></g>
    <rect x="24" y="8" width="5" height="64" rx="2.500" fill="url(#a-pole)"/><circle cx="26.500" cy="8" r="4.500" fill="url(#a-coin)"/>
    <path d="M29 12C44 4 58 22 84 11V47C58 58 44 40 29 49Z" fill="url(#a-check)" stroke="#111" stroke-width="1.500" stroke-linejoin="round"/>
    <path d="M29 12C44 4 58 22 84 11V22C58 33 44 15 29 24Z" fill="#fff" opacity=".18"/>
    <path d="M16 78h68" stroke="#f6c53a" stroke-width="3" stroke-linecap="round" opacity=".9"/><path d="M76 72l10 6-10 6z" fill="#f6c53a"/>
  </symbol>
  <symbol id="art-prison" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
    <rect width="100" height="100" fill="url(#a-prison-bg)"/>
    <svg x="19" y="3" width="62" height="62" viewBox="0 0 64 64"><use href="#icon-jail"/></svg>
  </symbol>
  <symbol id="art-songkran" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
    <rect width="100" height="100" fill="url(#a-songkran-bg)"/>
    <circle cx="50" cy="36" r="30" fill="#fff" opacity=".18"/>
    <text x="50" y="52" text-anchor="middle" font-size="46" font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">💦</text>
  </symbol>
  <symbol id="art-police" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
    <rect width="100" height="100" fill="url(#a-police-bg)"/>
    <g opacity=".22" fill="#fff"><path d="M50 26 0 0H16zM50 26 100 0H84z"/></g>
    <circle cx="50" cy="24" r="24" fill="url(#a-halo)"/>
    <rect x="30" y="29" width="40" height="8" rx="2.500" fill="#1b2140" stroke="#9aa7c7" stroke-width="1.300"/>
    <path d="M33 30C33 11 67 11 67 30Z" fill="url(#a-siren-r)" stroke="#fff" stroke-width="1.300"/>
    <path d="M50 30C50 11 67 11 67 30Z" fill="url(#a-siren-b)"/>
    <path d="M50 12V30" stroke="#fff" stroke-width="1.300" opacity=".8"/>
    <g stroke="#fff" stroke-width="2.600" stroke-linecap="round"><path d="M22 18 15 12M25 8 21 2M78 18 85 12M75 8 79 2"/></g>
    <g transform="translate(50 52)">
      <circle r="13" fill="#111632" stroke="#fff" stroke-width="1.800"/>
      <path d="M-7 -1.500C-7 -9 7 -9 7 -1.500V2C7 4.500 5 5 5 5V8H-5V5S-7 4.500-7 2Z" fill="url(#a-skull)"/>
      <circle cx="-3" cy="-1" r="2.300" fill="#111632"/><circle cx="3" cy="-1" r="2.300" fill="#111632"/><path d="M0 1.500l-1.200 2.400h2.400z" fill="#111632"/>
      <path d="M-2.200 5v3M0 5v3M2.200 5v3" stroke="#111632" stroke-width=".8"/>
    </g>
  </symbol>

  <!-- ===== other square icons (48x48) ===== -->
  <symbol id="icon-plane" viewBox="0 0 48 48"><path d="M44 8c1.500-1.500-1-4-3-2L30 17 8 11 5 14l17 9-8 9-7-1-2 3 8 3 3 8 3-2-1-7 9-8 9 17 3-3-5-23z" fill="#fff" stroke="#0d3340" stroke-width="1.800" stroke-linejoin="round"/></symbol>
  <symbol id="icon-lotus" viewBox="0 0 48 48"><g stroke="#7a1f55" stroke-width="1.200"><path d="M24 6C16 14 16 28 24 38 32 28 32 14 24 6Z" fill="#fff"/><path d="M24 38C12 36 5 28 4 18 15 19 21 26 24 38Z" fill="#ffc2e0"/><path d="M24 38C36 36 43 28 44 18 33 19 27 26 24 38Z" fill="#ffc2e0"/><path d="M24 40C18 40 12 37 8 32 16 32 21 35 24 40ZM24 40C30 40 36 37 40 32 32 32 27 35 24 40Z" fill="#ff8cc6"/></g></symbol>
  <symbol id="icon-star" viewBox="0 0 48 48"><circle cx="24" cy="25" r="22" fill="url(#a-halo)"/><path d="M24 4l5.400 12.600L43 18l-10 9 3 13.500L24 33l-12 7.500L15 27 5 18l13.600-1.400z" fill="url(#a-star)" stroke="#8a520a" stroke-width="1.800" stroke-linejoin="round"/><text x="24" y="30" text-anchor="middle" font-size="16" font-weight="900" fill="#5a1b9c" font-family="system-ui,sans-serif">?</text><g fill="#fff"><path d="M40 4l1.200 3 3 1.200-3 1.200L40 12.400l-1.200-3-3-1.200 3-1.200z"/><path d="M7 34l.9 2.100 2.100.9-2.100.9L7 40l-.9-2.100L4 37l2.100-.9z"/></g></symbol>
  <symbol id="icon-coin" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="url(#a-coin)" stroke="#8a520a" stroke-width="2"/><circle cx="24" cy="24" r="15" fill="none" stroke="#8a520a" stroke-width="1.500" opacity=".7"/><text x="24" y="31" text-anchor="middle" font-size="22" font-weight="900" fill="#7a4a06" font-family="system-ui,sans-serif">฿</text></symbol>
  <symbol id="icon-gem" viewBox="0 0 48 48"><path d="M13 7h22l10 12-21 23L3 19z" fill="url(#a-gem)" stroke="#0e4a7e" stroke-width="2" stroke-linejoin="round"/><path d="M3 19h42M13 7l-3 12 14 23M35 7l3 12-14 23M19 7l-3 12 8 23M29 7l3 12-8 23" fill="none" stroke="#fff" stroke-width="1.200" opacity=".7"/></symbol>

  <!-- ===== 3D buildings ===== -->
  <symbol id="b-house" viewBox="0 0 40 40">
    <ellipse cx="20" cy="37" rx="17" ry="3.200" fill="#000" opacity=".35"/>
    <path d="M7 20 20 27v11L7 31Z" fill="#43d96f" stroke="#064e22" stroke-width="1.100" stroke-linejoin="round"/>
    <path d="M20 27 33 20v11L20 38Z" fill="#14803a" stroke="#064e22" stroke-width="1.100" stroke-linejoin="round"/>
    <path d="M2.500 19.500 20 4l0 23Z" fill="#a8f5c0" stroke="#064e22" stroke-width="1.100" stroke-linejoin="round"/>
    <path d="M20 4 37.500 19.500 20 27Z" fill="#1fb457" stroke="#064e22" stroke-width="1.100" stroke-linejoin="round"/>
    <path d="M11 26l5 2.500v7L11 33Z" fill="#fff6b0" stroke="#064e22" stroke-width=".8"/>
    <path d="M25 29l5-2.500V31L25 33.500Z" fill="#7be0ff" stroke="#064e22" stroke-width=".8"/>
  </symbol>
  <symbol id="b-hotel" viewBox="0 0 40 48">
    <ellipse cx="20" cy="45" rx="17" ry="3.200" fill="#000" opacity=".4"/>
    <path d="M6 18 20 25v20L6 38Z" fill="#f04a4a" stroke="#4d0a0a" stroke-width="1.100" stroke-linejoin="round"/>
    <path d="M20 25 34 18v20L20 45Z" fill="#a51818" stroke="#4d0a0a" stroke-width="1.100" stroke-linejoin="round"/>
    <path d="M6 18 20 11 34 18 20 25Z" fill="#ffb0b0" stroke="#4d0a0a" stroke-width="1.100" stroke-linejoin="round"/>
    <g fill="#ffe27a" stroke="#4d0a0a" stroke-width=".6"><path d="M9 24l3 1.500v4L9 28ZM14 27l3 1.500v4L14 31ZM9 33l3 1.500v4L9 37ZM14 35.500l3 1.500v4l-3-1.500Z"/></g>
    <g fill="#ffcf4a" stroke="#4d0a0a" stroke-width=".6"><path d="M23 28.500l3-1.500v4l-3 1.500ZM28 26l3-1.500v4l-3 1.500ZM23 37l3-1.500v4L23 41ZM28 34.500l3-1.500v4l-3 1.500Z"/></g>
    <path d="M13 12.500 20 9l7 3.500v4L20 20l-7-3.500Z" fill="#f04a4a" stroke="#4d0a0a" stroke-width="1" stroke-linejoin="round"/>
    <path d="M20 9V3" stroke="#f6c53a" stroke-width="1.400"/><path d="M20 3l7 2.500-7 2.500Z" fill="#f6c53a" stroke="#8a520a" stroke-width=".6"/>
  </symbol>
</defs></svg>`;
  const wrap = document.createElement('div');
  wrap.innerHTML = defs;
  document.body.insertBefore(wrap.firstElementChild, document.body.firstChild);

  const NS = 'http://www.w3.org/2000/svg';
  // <svg class="art art-NAME"><use href="#art-NAME"/></svg>
  function use(symbolId, cls) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'art ' + (cls || symbolId));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const u = document.createElementNS(NS, 'use');
    u.setAttribute('href', '#' + symbolId);
    svg.appendChild(u);
    return svg;
  }
  window.SiamArt = { use };
})();
