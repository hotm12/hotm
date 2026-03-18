export interface ReviewQueueItemDto {
  leadId: number;
  displayName: string;
  handle: string;
  platform: string;
  leadStatus: string;
  totalScore: number;
  scoreGrade: string;
  riskFlags: string[];
  checklistProgress: string;
}

export interface SubmitReviewDto {
  decisionStatus: string;
  reviewNotes?: string;
  checklistAnswers: Array<{
    label: string;
    passed: boolean | null;
    note?: string;
  }>;
}
