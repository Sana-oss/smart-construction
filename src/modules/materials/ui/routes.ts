// Routes of the materials screens.
/** Price log (design S24.1). */
export const PRICES_PATH = '/prices';
/** Add a price or a quote (design S24.3). Optional ?m=&u= start the form on one material. */
export const PRICE_NEW_PATH = '/prices/new';

const withMaterial = (path: string, material: string, unit: string) =>
  `${path}?${new URLSearchParams({ m: material, u: unit }).toString()}`;

/** One material's price history (design S24.2). The material and unit travel in the address. */
export const priceHistoryPath = (material: string, unit: string) => withMaterial('/prices/history', material, unit);
export const priceNewForPath = (material: string, unit: string) => withMaterial(PRICE_NEW_PATH, material, unit);

/** Materials home (design S20.1; slice 1 of 3.3: the calculators and the price log, no quantity table yet). */
export const MATERIALS_PATH = '/materials';
/** Rebar calculator (design S22.1 form, S22.2 result). The inputs travel in the address: nothing is saved. */
export const REBAR_PATH = '/materials/rebar';
/** Other calculators (design S23.1). */
export const CALCULATORS_PATH = '/materials/calculators';
/** One geometric calculator (design S23.2 and its siblings). */
export const calculatorPath = (kind: 'concrete' | 'area' | 'tiles') => `${CALCULATORS_PATH}/${kind}`;

/** Add a line to the quantity table (FR-MAT-01). */
export const ITEM_NEW_PATH = '/materials/items/new';
/** One line (design S20.2 «تفاصيل بند»). */
export const itemPath = (id: string) => `/materials/items/${id}`;
/** Record a purchase for one line (design S21.1 «تسجيل شراء»). */
export const purchasePath = (itemId: string) => `/materials/items/${itemId}/purchase`;
