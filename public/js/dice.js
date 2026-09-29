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

  window.SiamDice = { createDie, setValue };
})();
