// 3D dice (CSS transforms). Each die is a cube of six faces; the .orient wrapper
// rotates the cube so the chosen value faces the viewer, which lets Phase 2's roll
// animation simply transition .orient to the final value.
(function () {
  // Pip positions on a 3x3 grid (1..9, row-major) for each face value.
  const PIPS = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9]
  };

  function buildFace(value) {
    const face = document.createElement('div');
    face.className = 'face face-' + value;
    PIPS[value].forEach((cell) => {
      const pip = document.createElement('span');
      pip.className = 'pip';
      pip.style.gridArea = Math.ceil(cell / 3) + ' / ' + (((cell - 1) % 3) + 1);
      face.appendChild(pip);
    });
    return face;
  }

  // Opposite faces sum to 7: front 1 / back 6, right 2 / left 5, top 3 / bottom 4.
  function createDie(value) {
    const die = document.createElement('div');
    die.className = 'die3d';

    const cube = document.createElement('div');
    cube.className = 'cube';
    const orient = document.createElement('div');
    orient.className = 'orient';
    orient.dataset.value = value;
    [1, 6, 2, 5, 3, 4].forEach((v) => orient.appendChild(buildFace(v)));
    cube.appendChild(orient);

    const shadow = document.createElement('div');
    shadow.className = 'die-shadow';

    die.append(shadow, cube);
    return die;
  }

  function setValue(die, value) {
    die.querySelector('.orient').dataset.value = value;
  }

  // Orientation that brings each value to the front; mirrors the .orient[data-value] rules in style.css.
  const FINAL_ANGLES = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
  const rand = (n) => Math.floor(Math.random() * n);

  // Spins and bounces one die, landing exactly on `value`.
  function rollOne(die, value, index) {
    const orient = die.querySelector('.orient');
    const [fx, fy] = FINAL_ANGLES[value];
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = (reduced ? 200 : 950 + index * 200) / window.SiamUtil.speed;

    die.classList.add('rolling');                       // tilted view while it tumbles ...
    setTimeout(() => die.classList.remove('rolling'), duration * 0.62);   // ... then it settles flat, number facing you
    orient.style.transition = 'none';
    orient.dataset.value = value; // the CSS final orientation sits under the animation
    if (!orient.animate) { orient.style.transition = ''; return Promise.resolve(); }

    // Start a few whole turns away on each axis so it visibly tumbles, ending exactly on the face.
    const ax = (2 + rand(2)) * 360 * (rand(2) ? 1 : -1);
    const ay = (2 + rand(2)) * 360 * (rand(2) ? 1 : -1);
    const spin = orient.animate([
      { transform: 'rotateX(' + (fx + ax) + 'deg) rotateY(' + (fy + ay) + 'deg)' },
      { transform: 'rotateX(' + fx + 'deg) rotateY(' + fy + 'deg)' }
    ], { duration, easing: 'cubic-bezier(.2,.7,.25,1)' });

    const hop = die.animate([
      { transform: 'translateY(0)' },
      { transform: 'translateY(calc(var(--u) * -7))', offset: 0.3 },
      { transform: 'translateY(0)', offset: 0.55 },
      { transform: 'translateY(calc(var(--u) * -2.2))', offset: 0.75 },
      { transform: 'translateY(0)' }
    ], { duration, easing: 'ease-out' });

    return Promise.all([spin.finished, hop.finished]).then(() => { orient.style.transition = ''; }, () => { orient.style.transition = ''; });
  }

  // Rolls both dice to `values` ([d1, d2]); resolves when they have settled.
  function roll(values) {
    const dice = Array.from(document.querySelectorAll('#dice .die3d'));
    return Promise.all(dice.map((d, i) => rollOne(d, values[i], i)));
  }

  window.SiamDice = { createDie, setValue, roll };
})();
