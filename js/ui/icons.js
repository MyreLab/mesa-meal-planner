// Original line icons (24x24, drawn for this project). Colour comes from currentColor.
const svg = (inner, label) => `<svg class="ic" viewBox="0 0 24 24" role="img" aria-label="${label}">${inner}</svg>`;

const WHEAT_PATHS = `<path d="M12 21V5"/><path d="M12 8c-2.2-.6-3.4-2.2-3.6-4.2 2.2.5 3.4 2 3.6 4.2z"/><path d="M12 8c2.2-.6 3.4-2.2 3.6-4.2-2.2.5-3.4 2-3.6 4.2z"/><path d="M12 12.5c-2.2-.6-3.4-2.2-3.6-4.2 2.2.5 3.4 2 3.6 4.2z"/><path d="M12 12.5c2.2-.6 3.4-2.2 3.6-4.2-2.2.5-3.4 2-3.6 4.2z"/><path d="M12 17c-2.2-.6-3.4-2.2-3.6-4.2 2.2.5 3.4 2 3.6 4.2z"/><path d="M12 17c2.2-.6 3.4-2.2 3.6-4.2-2.2.5-3.4 2-3.6 4.2z"/>`;

export const ICON = {
  chicken: (l) => svg(`<ellipse cx="15" cy="9" rx="5.6" ry="4.4" transform="rotate(-45 15 9)"/><path d="M11.2 12.8 7.6 16.4"/><circle cx="5.9" cy="16.6" r="1.5"/><circle cx="7.4" cy="18.1" r="1.5"/>`, l),
  fish: (l) => svg(`<path d="M2.8 12c3-4.6 9.2-6 13.3-2.4L20.5 6v12l-4.4-3.6C12 18 5.8 16.6 2.8 12z"/><circle class="fill" cx="7.4" cy="11.2" r="1"/>`, l),
  beef: (l) => svg(`<path d="M5 9.2C5 6 8.6 4 13 4s7.2 2.6 7.2 6.2c0 3-1.8 4.6-3.8 6.1S13 20 9.5 20C6.8 20 5 18.3 5 16c0-2 1.9-2.6 1.9-4.2S5 11.2 5 9.2z"/><circle cx="10.4" cy="14.8" r="1.7"/>`, l),
  turkey: (l) => svg(`<path d="M4.5 14a8.5 8.5 0 0 1 13-8"/><path d="M7.4 13.6a5.8 5.8 0 0 1 8.4-4.6"/><circle cx="14.5" cy="14" r="4.6"/><path d="M17.8 10.8l1.6-2.6"/><circle cx="20" cy="7.2" r="1.4"/><path d="M13.2 18.6V21M15.8 18.6V21"/>`, l),
  tofu: (l) => svg(`<path d="M4 9l8-4 8 4v7l-8 4-8-4z"/><path d="M4 9l8 4 8-4M12 13v7"/>`, l),
  egg: (l) => svg(`<path d="M12 3c3.6 0 6.5 5.2 6.5 9.6A6.5 6.5 0 0 1 12 19.5a6.5 6.5 0 0 1-6.5-6.9C5.5 8.2 8.4 3 12 3z"/>`, l),
  beans: (l) => svg(`<path d="M8.4 4.6c3.2-1.5 8 .1 9 3.6 1.1 3.6-1.2 6.6-4.2 7.8-3.2 1.3-7.2.9-8.3-2.5-.8-2.5-.2-6.2 3.5-8.9z"/><path d="M9.6 9.2c1.3.2 2.5 1.2 3 2.6"/><path d="M16.5 17.6c1.8.3 3.2-.6 3.6-2"/>`, l),
  heart: (l) => svg(`<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>`, l),
  wheatFree: (l) => svg(WHEAT_PATHS + `<path d="M4 4l16 16"/>`, l),
  wheat: (l) => svg(WHEAT_PATHS, l),
};

export const PROTEIN = { chicken: "Chicken", fish: "Fish", beef: "Beef", turkey: "Turkey", egg: "Eggs", tofu: "Tofu", beans: "Beans" };

export const WHEAT = {
  free: { cls: "wf-free", icon: "wheatFree", label: "Wheat-free" },
  check: { cls: "wf-check", icon: "wheat", label: "Wheat-free if labels check" },
  contains: { cls: "wf-contains", icon: "wheat", label: "Contains wheat" },
};

export const CHECK_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M3 8.5l3.2 3L13 4.5"/></svg>`;
