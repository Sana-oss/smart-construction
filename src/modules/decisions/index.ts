// Public API of the decisions module. Other code imports ONLY from "@/modules/decisions".
// See docs/system_architecture.md section 4 for the tables and features this module owns.
// Built: the continue-or-pause comparison (3.7; design S18.1, S18.2; slice 3 of 3.7, 20 Nov 2026).

export { DecisionOverview } from './ui/DecisionOverview';
export { ComparisonForm } from './ui/ComparisonForm';
export { ReviewForm } from './ui/ReviewForm';
export { getComparison, getStoredComparison } from './ui/queries';
export { DECISION_INPUTS_PATH, DECISION_PATH, DECISION_REVIEW_PATH } from './ui/routes';
export { decisionTextAr } from './ui/messages.ar';
