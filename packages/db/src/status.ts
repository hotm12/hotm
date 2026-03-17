export const leadStatuses = [
  "NEW",
  "REVIEW_READY",
  "APPROVED",
  "ON_HOLD",
  "REJECTED",
  "DO_NOT_CONTACT"
] as const;

export const crmStages = [
  "CONTACTED",
  "REPLIED",
  "INTERESTED",
  "MEETING_BOOKED",
  "ONBOARDING",
  "LISTING_IN_PROGRESS",
  "CLOSED_WON",
  "CLOSED_LOST"
] as const;

export const outreachDeliveryStatuses = [
  "DRAFT",
  "APPROVED",
  "QUEUED",
  "SENT",
  "FAILED",
  "CANCELED"
] as const;

export type LeadStatus = (typeof leadStatuses)[number];
export type CrmStage = (typeof crmStages)[number];
export type OutreachDeliveryStatus = (typeof outreachDeliveryStatuses)[number];
