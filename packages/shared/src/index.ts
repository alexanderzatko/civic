export {
  DEFAULT_SETTINGS,
  loadSettings,
  type CivicSettings,
  type WageBasis,
} from "./settings.js";

export {
  computeMerits,
  displayMerits,
  floor2,
  round2,
  splitMerits,
  type MeritInput,
} from "./merits.js";

export {
  isValidReceiptUid,
  normalizeUid,
  parseReceiptUid,
} from "./receipt-uid.js";

export type {
  CharityProject,
  ClaimShareInput,
  ContributionCategoryBreakdown,
  ContributionsSummary,
  GeoLocation,
  RankBucket,
  RankDistribution,
  VerifiedReceiptPreview,
  VerifyReceiptError,
  VerifyReceiptResponse,
} from "./types.js";
