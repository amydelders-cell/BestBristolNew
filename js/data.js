// Celestial body data.
// Distances are AU (sun-relative) for planets/dwarfs and km for moons (relative to parent).
// Radii are km. Periods are Earth days (orbital) and hours (rotation).
// Tilts are degrees. Eccentricities are unitless.
//
// Distances are visualised on a compressed log-ish scale; real values are kept here
// for the info panel and for proportional moon positioning.

export const SUN = {
  id: 'sun',
  name: 'Sun',
  type: 'Star',
  radiusKm: 696340,
  rotationHours: 609.12, // ~25.4 days at equator
  tiltDeg: 7.25,
  color: 0xffd27a,
  emissive: 0xffaa33,
  description:
    'The Sun is a G-type main-sequence star at the heart of the Solar System, holding 99.86% of the system’s mass and powering everything with thermonuclear fusion.'
};

export const PLANETS = [
  {
    id: 'mercury',
    name: 'Mercury',
    type: 'Terrestrial planet',
    radiusKm: 2440,
    distanceAU: 0.387,
    eccentricity: 0.2056,
    orbitalDays: 87.97,
    rotationHours: 1407.6,
    tiltDeg: 0.034,
    color: 0x8c7853,
    surface: 'rocky',
    description:
      'The smallest planet and closest to the Sun. Its surface is heavily cratered, similar in appearance to Earth’s Moon.'
  },
  {
    id: 'venus',
    name: 'Venus',
    type: 'Terrestrial planet',
    radiusKm: 6052,
    distanceAU: 0.723,
    eccentricity: 0.0068,
    orbitalDays: 224.7,
    rotationHours: -5832.5, // retrograde
    tiltDeg: 177.4,
    color: 0xe6b87a,
    surface: 'venusian',
    description:
      'Wrapped in a thick atmosphere of CO₂ and sulphuric-acid clouds, Venus is the hottest planet in the system, with surface temperatures around 465 °C.'
  },
  {
    id: 'earth',
    name: 'Earth',
    type: 'Terrestrial planet',
    radiusKm: 6371,
    distanceAU: 1.0,
    eccentricity: 0.0167,
    orbitalDays: 365.25,
    rotationHours: 23.93,
    tiltDeg: 23.44,
    color: 0x2c5fa8,
    surface: 'earth',
    description:
      'Our home: the only world known to host life. About 71% of its surface is liquid water, and a thin nitrogen-oxygen atmosphere protects the biosphere.',
    moons: [
      {
        id: 'moon',
        name: 'Moon',
        radiusKm: 1737,
        distanceKm: 384400,
        orbitalDays: 27.32,
        rotationHours: 655.7,
        tiltDeg: 6.68,
        color: 0xb8b6b1,
        surface: 'moon',
        description: 'Earth’s only natural satellite and the fifth-largest moon in the Solar System.'
      }
    ]
  },
  {
    id: 'mars',
    name: 'Mars',
    type: 'Terrestrial planet',
    radiusKm: 3390,
    distanceAU: 1.524,
    eccentricity: 0.0934,
    orbitalDays: 686.97,
    rotationHours: 24.62,
    tiltDeg: 25.19,
    color: 0xc1440e,
    surface: 'mars',
    description:
      'The "Red Planet," its rusty colour comes from iron-oxide dust. Mars hosts the Solar System’s tallest mountain, Olympus Mons, and seasonal polar caps of CO₂ and water ice.'
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    type: 'Gas giant',
    radiusKm: 69911,
    distanceAU: 5.203,
    eccentricity: 0.0489,
    orbitalDays: 4332.59,
    rotationHours: 9.93,
    tiltDeg: 3.13,
    color: 0xd8b48a,
    surface: 'jupiter',
    description:
      'The largest planet, with more than twice the mass of all the others combined. Its banded clouds and Great Red Spot — a storm larger than Earth — are visible even in small telescopes.'
  },
  {
    id: 'saturn',
    name: 'Saturn',
    type: 'Gas giant',
    radiusKm: 58232,
    distanceAU: 9.537,
    eccentricity: 0.0565,
    orbitalDays: 10759.22,
    rotationHours: 10.7,
    tiltDeg: 26.73,
    color: 0xead6a8,
    surface: 'saturn',
    rings: { innerKm: 74500, outerKm: 140000, color: 0xd9c7a0, opacity: 0.85 },
    description:
      'Famed for its bright icy ring system. Saturn is the least dense planet — lighter than water — and rotates so quickly it bulges noticeably at the equator.'
  },
  {
    id: 'uranus',
    name: 'Uranus',
    type: 'Ice giant',
    radiusKm: 25362,
    distanceAU: 19.191,
    eccentricity: 0.0457,
    orbitalDays: 30688.5,
    rotationHours: -17.24, // retrograde
    tiltDeg: 97.77,
    color: 0x9fdfe5,
    surface: 'uranus',
    rings: { innerKm: 38000, outerKm: 51000, color: 0x6c7a85, opacity: 0.35 },
    description:
      'An ice giant tipped on its side: its rotation axis lies almost in its orbital plane, so each pole spends 42 years in continuous sunlight then 42 in darkness.'
  },
  {
    id: 'neptune',
    name: 'Neptune',
    type: 'Ice giant',
    radiusKm: 24622,
    distanceAU: 30.07,
    eccentricity: 0.0113,
    orbitalDays: 60182,
    rotationHours: 16.11,
    tiltDeg: 28.32,
    color: 0x3a64d8,
    surface: 'neptune',
    description:
      'The windiest planet, with supersonic jet streams. Neptune’s rich-blue colour comes from methane in its upper atmosphere absorbing red light.'
  }
];

export const DWARF_PLANETS = [
  {
    id: 'ceres',
    name: 'Ceres',
    type: 'Dwarf planet',
    radiusKm: 470,
    distanceAU: 2.77,
    eccentricity: 0.076,
    orbitalDays: 1680.5,
    rotationHours: 9.07,
    tiltDeg: 4.0,
    color: 0x8a7e6c,
    surface: 'rocky',
    description:
      'The largest object in the asteroid belt and the only dwarf planet in the inner Solar System. Ceres has bright salt deposits in Occator crater and a tenuous water-vapour exosphere.'
  },
  {
    id: 'pluto',
    name: 'Pluto',
    type: 'Dwarf planet',
    radiusKm: 1188,
    distanceAU: 39.48,
    eccentricity: 0.2488,
    orbitalDays: 90560,
    rotationHours: -153.29,
    tiltDeg: 122.53,
    color: 0xc8a886,
    surface: 'pluto',
    description:
      'A complex Kuiper-belt world with nitrogen-ice plains, water-ice mountains and a heart-shaped basin (Tombaugh Regio) revealed by New Horizons in 2015.',
    moons: [
      {
        id: 'charon', name: 'Charon', radiusKm: 606, distanceKm: 19571, orbitalDays: 6.39,
        rotationHours: 153.29, tiltDeg: 0.0, color: 0xa39788, surface: 'icy',
        description: 'The largest moon of Pluto, so massive that the pair orbit a barycentre outside Pluto itself.'
      },
      {
        id: 'styx', name: 'Styx', radiusKm: 8, distanceKm: 42656, orbitalDays: 20.16,
        rotationHours: 80, tiltDeg: 0, color: 0xb8b1a4, surface: 'icy',
        description: 'A tiny, irregular moon discovered in 2012.'
      },
      {
        id: 'nix', name: 'Nix', radiusKm: 25, distanceKm: 48694, orbitalDays: 24.85,
        rotationHours: 43.9, tiltDeg: 0, color: 0xcfc6b6, surface: 'icy',
        description: 'A bright, oblong moon that tumbles chaotically as it orbits Pluto.'
      },
      {
        id: 'kerberos', name: 'Kerberos', radiusKm: 9, distanceKm: 57783, orbitalDays: 32.17,
        rotationHours: 5.31, tiltDeg: 0, color: 0xa9a297, surface: 'icy',
        description: 'A small two-lobed moon imaged by New Horizons.'
      },
      {
        id: 'hydra', name: 'Hydra', radiusKm: 25, distanceKm: 64738, orbitalDays: 38.20,
        rotationHours: 10.3, tiltDeg: 0, color: 0xc4bdaf, surface: 'icy',
        description: 'The outermost known moon of Pluto, with a surface dominated by water ice.'
      }
    ]
  },
  {
    id: 'haumea',
    name: 'Haumea',
    type: 'Dwarf planet',
    radiusKm: 780, // mean; Haumea is markedly ellipsoidal
    distanceAU: 43.13,
    eccentricity: 0.191,
    orbitalDays: 103774,
    rotationHours: 3.91,
    tiltDeg: 28,
    color: 0xd6cfc4,
    surface: 'icy',
    rings: { innerKm: 2200, outerKm: 2300, color: 0xaaaaaa, opacity: 0.5 },
    description:
      'An egg-shaped Kuiper-belt object, spinning so fast (one rotation in under four hours) that it has stretched into an ellipsoid. The first trans-Neptunian body found to have rings.',
    moons: [
      {
        id: 'hiiaka', name: 'Hiʻiaka', radiusKm: 160, distanceKm: 49880, orbitalDays: 49.12,
        rotationHours: 9.8, tiltDeg: 0, color: 0xd0c8b8, surface: 'icy',
        description: 'The larger and outer of Haumea’s two moons, with a water-ice surface.'
      },
      {
        id: 'namaka', name: 'Namaka', radiusKm: 85, distanceKm: 25657, orbitalDays: 18.28,
        rotationHours: 18.28 * 24, tiltDeg: 0, color: 0xc8c0b0, surface: 'icy',
        description: 'The inner, smaller moon of Haumea.'
      }
    ]
  },
  {
    id: 'makemake',
    name: 'Makemake',
    type: 'Dwarf planet',
    radiusKm: 715,
    distanceAU: 45.79,
    eccentricity: 0.159,
    orbitalDays: 111400,
    rotationHours: 22.83,
    tiltDeg: 29,
    color: 0xc89a6b,
    surface: 'rocky',
    description:
      'A reddish dwarf planet of the classical Kuiper belt, slightly smaller than Pluto, named after the creator deity of the Rapa Nui.',
    moons: [
      {
        id: 'mk2', name: 'MK2', radiusKm: 87, distanceKm: 21100, orbitalDays: 12.4,
        rotationHours: 12.4 * 24, tiltDeg: 0, color: 0x4a4640, surface: 'icy',
        description: 'A very dark moon (provisional designation S/2015 (136472) 1) discovered with the Hubble Space Telescope in 2016.'
      }
    ]
  },
  {
    id: 'eris',
    name: 'Eris',
    type: 'Dwarf planet',
    radiusKm: 1163,
    distanceAU: 67.78,
    eccentricity: 0.436,
    orbitalDays: 204060,
    rotationHours: 25.9,
    tiltDeg: 78,
    color: 0xe2dccf,
    surface: 'icy',
    description:
      'One of the most massive dwarf planets, residing in the scattered disc beyond the Kuiper belt. Its discovery in 2005 prompted the formal definition of "dwarf planet."',
    moons: [
      {
        id: 'dysnomia', name: 'Dysnomia', radiusKm: 350, distanceKm: 37350, orbitalDays: 15.79,
        rotationHours: 15.79 * 24, tiltDeg: 0, color: 0x80766c, surface: 'icy',
        description: 'The only known moon of Eris, named after the Greek goddess of lawlessness.'
      }
    ]
  }
];

// Convenience flat list
export function allBodies() {
  const list = [SUN];
  for (const p of PLANETS) {
    list.push(p);
    if (p.moons) list.push(...p.moons.map(m => ({ ...m, parent: p.id, type: 'Moon' })));
  }
  for (const d of DWARF_PLANETS) {
    list.push(d);
    if (d.moons) list.push(...d.moons.map(m => ({ ...m, parent: d.id, type: 'Moon' })));
  }
  return list;
}
