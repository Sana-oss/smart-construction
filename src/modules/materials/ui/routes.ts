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
