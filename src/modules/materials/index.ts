// Public API of the materials module. Other code imports ONLY from "@/modules/materials".
// See docs/system_architecture.md section 4 for the tables and features this module owns.
// Built so far: the owner's price log and supplier quotes (design S24; FR-MAT-08; slice 2 of 3.7, 19 Nov 2026).

// Domain (pure): quote states, for the continue-or-pause comparison (3.7, FR-DEC-03)
export { quoteStatus, QUOTE_WARNING_DAYS, STALE_PRICE_DAYS, type PriceRecord, type PriceWarnings, type QuoteStatus } from './domain/price';

// Price log screens (S24.1, S24.2, S24.3), their reads and routes
export { PriceLog } from './ui/PriceLog';
export { PriceHistory } from './ui/PriceHistory';
export { PriceForm } from './ui/PriceForm';
export { getProjectPriceHistory, getProjectPriceLog, getProjectPriceWarnings } from './ui/queries';
export { PRICE_NEW_PATH, PRICES_PATH, priceHistoryPath } from './ui/routes';
export { priceTextAr } from './ui/messages.ar';
