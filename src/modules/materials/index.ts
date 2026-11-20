// Public API of the materials module. Other code imports ONLY from "@/modules/materials".
// See docs/system_architecture.md section 4 for the tables and features this module owns.
// Built so far: the owner's price log and supplier quotes (design S24; FR-MAT-08; slice 2 of 3.7, 19 Nov 2026), and the
// quantity calculators (design S20.1, S22, S23; FR-MAT-04, FR-MAT-05; slice 1 of 3.3, 20 Nov 2026).

// Domain (pure): quote states, for the continue-or-pause comparison (3.7, FR-DEC-03)
export { quoteStatus, QUOTE_WARNING_DAYS, STALE_PRICE_DAYS, type PriceRecord, type PriceWarnings, type QuoteStatus } from './domain/price';

// Price log screens (S24.1, S24.2, S24.3), their reads and routes
export { PriceLog } from './ui/PriceLog';
export { PriceHistory } from './ui/PriceHistory';
export { PriceForm } from './ui/PriceForm';
export { getProjectPriceHistory, getProjectPriceLog, getProjectPriceWarnings } from './ui/queries';
export { PRICE_NEW_PATH, PRICES_PATH, priceHistoryPath } from './ui/routes';
export { priceTextAr } from './ui/messages.ar';

// Quantity calculators (S20.1 home, S22 rebar, S23 others): nothing is saved; the inputs travel in the address
export { isGeometricKind, runGeometricCalculator, GEOMETRIC_FIELDS, type GeometricKind } from './application/calculators';
export { MaterialsHome } from './ui/MaterialsHome';
export { RebarCalculator, REBAR_PARAMS } from './ui/RebarCalculator';
export { OtherCalculators } from './ui/OtherCalculators';
export { GeometricCalculator } from './ui/GeometricCalculator';
export { getRebarCalculatorView } from './ui/queries';
export { calcTextAr } from './ui/messages.ar';
export { CALCULATORS_PATH, calculatorPath, MATERIALS_PATH, REBAR_PATH } from './ui/routes';

// Quantity table and purchases (S20.1 «بنود المواد», S20.2 «تفاصيل بند», S21.1 «تسجيل شراء»; FR-MAT-01..03, 3.3 slice 2)
export { getItemDetailView, getQuantityTableView } from './ui/queries';
export { ItemForm } from './ui/ItemForm';
export { ItemDetailScreen, type ItemNotice } from './ui/ItemDetailScreen';
export { PurchaseForm, type PurchaseFormState } from './ui/PurchaseForm';
export { getPendingPurchaseEvent, linkPurchaseExpense, recordProjectPurchase } from './ui/purchase-service';
export { qtyErrorsAr, qtyFailedAr, qtyTextAr } from './ui/messages.ar';
export { ITEM_NEW_PATH, itemPath, purchasePath } from './ui/routes';
