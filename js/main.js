import { SolarSystem } from './scene.js';
import { allBodies, SUN } from './data.js';

const canvas = document.getElementById('scene');
const loading = document.getElementById('loading');

function showError(msg) {
  loading.innerHTML = `<div style="max-width:80%;text-align:center;padding:1rem">
    <h2 style="margin:0 0 0.5rem;color:#ffb84d">Couldn't start the scene</h2>
    <p style="font-size:0.9rem;line-height:1.4">${msg}</p>
    <p style="font-size:0.8rem;color:#8a93a8;margin-top:1rem">Try reloading. On older devices, this view needs WebGL — you may need a more recent browser.</p>
  </div>`;
}

let sys;
try {
  sys = new SolarSystem(canvas);
  sys.start();
} catch (err) {
  console.error(err);
  showError(String(err && err.message || err));
  throw err;
}

// Hide loading once the first frame ships, with a hard fallback so the
// user never gets stuck on the spinner.
let hidden = false;
const hide = () => { if (!hidden) { hidden = true; loading.classList.add('gone'); } };
requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(hide, 100)));
setTimeout(hide, 4000);
window.addEventListener('error', (e) => { showError(e.message || 'Unknown error'); });

// --- AR ---------------------------------------------------------------------
const arButton = document.getElementById('ar-button');
sys.setupAR(arButton);

// --- Controls ---------------------------------------------------------------
const speed = document.getElementById('speed');
const speedReadout = document.getElementById('speed-readout');
const speedFromSlider = (raw) => {
  // Slider value is the multiplier in simulated-days-per-real-second.
  return parseInt(raw, 10);
};
const updateSpeedReadout = () => {
  const v = speedFromSlider(parseInt(speed.value, 10));
  speedReadout.textContent = v + '×';
  sys.setTimeScale(v);
};
speed.addEventListener('input', updateSpeedReadout);
updateSpeedReadout();

document.getElementById('toggle-orbits').addEventListener('change', (e) => sys.setShowOrbits(e.target.checked));
document.getElementById('toggle-labels').addEventListener('change', (e) => sys.setShowLabels(e.target.checked));
document.getElementById('toggle-realsize').addEventListener('change', (e) => sys.setRealSize(e.target.checked));
document.getElementById('toggle-stars').addEventListener('change', (e) => sys.setStarfield(e.target.checked));
document.getElementById('reset-view').addEventListener('click', () => sys.resetView());

// --- Jump-to dropdown -------------------------------------------------------
const jump = document.getElementById('jump');
const flat = allBodies();
const groups = {
  Star: [], 'Terrestrial planet': [], 'Gas giant': [], 'Ice giant': [],
  'Dwarf planet': [], Moon: []
};
for (const b of flat) {
  const g = groups[b.type] || (groups[b.type] = []);
  g.push(b);
}
for (const [label, list] of Object.entries(groups)) {
  if (!list.length) continue;
  const og = document.createElement('optgroup');
  og.label = label;
  for (const b of list) {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.name + (b.parent ? ` (of ${b.parent})` : '');
    og.appendChild(opt);
  }
  jump.appendChild(og);
}
jump.addEventListener('change', () => {
  if (!jump.value) return;
  sys.jumpTo(jump.value);
  showInfo(jump.value);
});

// --- Info panel -------------------------------------------------------------
const info = document.getElementById('info');
const infoName = document.getElementById('info-name');
const infoType = document.getElementById('info-type');
const infoStats = document.getElementById('info-stats');
const infoDesc = document.getElementById('info-desc');
document.getElementById('info-close').addEventListener('click', () => info.classList.add('hidden'));

function showInfo(id) {
  const data = id === 'sun' ? SUN : flat.find((b) => b.id === id);
  if (!data) return;
  infoName.textContent = data.name;
  infoType.textContent = data.type;
  infoStats.innerHTML = '';
  const stats = [];
  if (data.radiusKm) stats.push(['Radius', `${data.radiusKm.toLocaleString()} km`]);
  if (data.distanceAU) stats.push(['Distance from Sun', `${data.distanceAU.toFixed(2)} AU`]);
  if (data.distanceKm && data.parent) stats.push([`Distance from ${data.parent}`, `${data.distanceKm.toLocaleString()} km`]);
  if (data.orbitalDays) {
    const d = Math.abs(data.orbitalDays);
    stats.push(['Orbital period', d > 365 ? `${(d / 365.25).toFixed(2)} years` : `${d.toFixed(2)} days`]);
  }
  if (data.rotationHours) {
    const h = Math.abs(data.rotationHours);
    const retro = data.rotationHours < 0 ? ' (retrograde)' : '';
    stats.push(['Day length', h > 48 ? `${(h / 24).toFixed(2)} days${retro}` : `${h.toFixed(2)} h${retro}`]);
  }
  if (data.tiltDeg !== undefined) stats.push(['Axial tilt', `${data.tiltDeg.toFixed(2)}°`]);
  if (data.eccentricity !== undefined && data.eccentricity > 0) stats.push(['Eccentricity', data.eccentricity.toFixed(3)]);
  for (const [k, v] of stats) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    infoStats.appendChild(dt); infoStats.appendChild(dd);
  }
  infoDesc.textContent = data.description || '';
  info.classList.remove('hidden');
}

sys.onSelect((entry) => {
  showInfo(entry.data.id);
  sys.jumpTo(entry.data.id); // fly camera in and lock on
});

// Open Sun info on first load briefly to advertise the feature
setTimeout(() => showInfo('sun'), 1200);
