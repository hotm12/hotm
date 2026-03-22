"use client";

import type { CSSProperties, FormEvent } from "react";
import { useEffect, useState } from "react";

type ReviewQueueItem = {
  leadId: number;
  displayName: string;
  handle: string;
  platform: string;
  leadStatus: string;
  totalScore: number;
  scoreGrade: string;
  riskFlags: string[];
  checklistProgress: string;
};

type ReviewChecklistAnswer = {
  id: number;
  label: string;
  passed: boolean | null;
  note?: string;
};

type ReviewDetail = {
  id: number;
  displayName: string;
  handle: string;
  platform: string;
  leadStatus: string;
  totalScore: number;
  scoreGrade: string;
  riskFlags: string[];
  reviewNotes?: string;
  reviewChecklistAnswers: ReviewChecklistAnswer[];
  score: {
    totalScore: number;
    scoreGrade: string;
    scoreBreakdown: Array<{
      label: string;
      scoreDelta: number;
      reason: string;
    }>;
  };
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

const fallbackQueue: ReviewQueueItem[] = [
  {
    leadId: 2,
    displayName: "Daily Beauty Pick",
    handle: "@daily_beauty_pick",
    platform: "INSTAGRAM",
    leadStatus: "REVIEW_READY",
    totalScore: 31,
    scoreGrade: "B",
    riskFlags: ["이메일 미확인"],
    checklistProgress: "1/3"
  }
];

const fallbackDetail: ReviewDetail = {
  id: 2,
  displayName: "Daily Beauty Pick",
  handle: "@daily_beauty_pick",
  platform: "INSTAGRAM",
  leadStatus: "REVIEW_READY",
  totalScore: 31,
  scoreGrade: "B",
  riskFlags: ["이메일 미확인"],
  reviewNotes: "추가 연락 수단 확인이 필요합니다.",
  reviewChecklistAnswers: [
    {
      id: 1,
      label: "실제 판매 계정 여부",
      passed: true,
      note: "판매 게시물과 후기 콘텐츠를 확인했습니다."
    },
    {
      id: 2,
      label: "공개 연락 채널 존재 여부",
      passed: false,
      note: "DM 외 직접 연락 수단이 보이지 않습니다."
    },
    {
      id: 3,
      label: "브랜드 안전성 검토",
      passed: null,
      note: ""
    }
  ],
  score: {
    totalScore: 31,
    scoreGrade: "B",
    scoreBreakdown: [
      {
        label: "팔로워 규모",
        scoreDelta: 15,
        reason: "기본 탐색 기준을 넘었습니다."
      },
      {
        label: "콘텐츠 일관성",
        scoreDelta: 10,
        reason: "뷰티 카테고리에 집중된 계정입니다."
      },
      {
        label: "직접 연락 가능성",
        scoreDelta: 6,
        reason: "공개 이메일 부재로 가점이 제한됩니다."
      }
    ]
  }
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

export function ReviewClient() {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [draftNotes, setDraftNotes] = useState("");
  const [draftAnswers, setDraftAnswers] = useState<ReviewChecklistAnswer[]>([]);
  const [statusMessage, setStatusMessage] = useState("검수 대기열을 불러오는 중입니다.");

  useEffect(() => {
    void loadQueue();
  }, []);

  async function loadQueue(preferredLeadId?: number | null) {
    try {
      const nextItems = await request<ReviewQueueItem[]>("/review-queue");
      setItems(nextItems);

      const nextLeadId =
        nextItems.find((item) => item.leadId === preferredLeadId)?.leadId ?? nextItems[0]?.leadId ?? null;

      setSelectedLeadId(nextLeadId);

      if (nextLeadId) {
        await loadDetail(nextLeadId);
      } else {
        setDetail(null);
      }

      setStatusMessage("API에서 최신 검수 대기열을 불러왔습니다.");
    } catch {
      setItems(fallbackQueue);
      setSelectedLeadId(fallbackDetail.id);
      setDetail(fallbackDetail);
      setDraftNotes(fallbackDetail.reviewNotes ?? "");
      setDraftAnswers(fallbackDetail.reviewChecklistAnswers);
      setStatusMessage("API 연결이 없어 예시 검수 데이터를 표시 중입니다.");
    }
  }

  async function loadDetail(leadId: number) {
    try {
      const nextDetail = await request<ReviewDetail>(`/review-queue/${leadId}`);
      setDetail(nextDetail);
      setDraftNotes(nextDetail.reviewNotes ?? "");
      setDraftAnswers(nextDetail.reviewChecklistAnswers);
    } catch {
      setDetail(fallbackDetail);
      setDraftNotes(fallbackDetail.reviewNotes ?? "");
      setDraftAnswers(fallbackDetail.reviewChecklistAnswers);
    }
  }

  async function submitReview(decisionStatus: string) {
    if (!selectedLeadId) {
      return;
    }

    try {
      await request(`/review-queue/${selectedLeadId}/submit`, {
        method: "POST",
        body: JSON.stringify({
          decisionStatus,
          reviewNotes: draftNotes,
          checklistAnswers: draftAnswers.map((answer) => ({
            label: answer.label,
            passed: answer.passed,
            note: answer.note
          }))
        })
      });

      setStatusMessage(`검수 결과를 ${decisionStatus} 상태로 저장했습니다.`);
      await loadQueue(selectedLeadId);
    } catch {
      setStatusMessage("검수 결과 저장에 실패했습니다.");
    }
  }

  function handleChecklistNote(answerId: number, value: string) {
    setDraftAnswers((current) =>
      current.map((item) => (item.id === answerId ? { ...item, note: value } : item))
    );
  }

  function handleChecklistResult(answerId: number, passed: boolean | null) {
    setDraftAnswers((current) =>
      current.map((item) => (item.id === answerId ? { ...item, passed } : item))
    );
  }

  function handleSelectLead(leadId: number) {
    setSelectedLeadId(leadId);
    void loadDetail(leadId);
  }

  function preventSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>Review Queue</div>
          <h1 style={titleStyle}>리드 검수 워크스페이스</h1>
          <p style={descriptionStyle}>
            점수, 리스크, 체크리스트 응답을 함께 보고 승인, 보류, 연락 금지 여부를 결정할 수 있습니다.
          </p>
        </div>
        <div style={statusStyle}>{statusMessage}</div>
      </section>

      <section style={layoutStyle}>
        <article style={panelStyle}>
          <div style={headerRowStyle}>
            <h2 style={sectionTitleStyle}>검수 대기열</h2>
            <span style={badgeStyle}>{items.length}건</span>
          </div>
          <div style={listStyle}>
            {items.map((item) => (
              <button
                key={item.leadId}
                type="button"
                onClick={() => handleSelectLead(item.leadId)}
                style={{
                  ...itemButtonStyle,
                  borderColor: item.leadId === selectedLeadId ? "#38bdf8" : "#1e293b"
                }}
              >
                <div style={rowStyle}>
                  <strong>{item.displayName}</strong>
                  <span style={tagStyle}>{item.scoreGrade}</span>
                </div>
                <div style={mutedTextStyle}>
                  {item.handle} · {item.platform}
                </div>
                <div style={itemMetaStyle}>
                  <span>{item.leadStatus}</span>
                  <span>{item.checklistProgress}</span>
                </div>
              </button>
            ))}
          </div>
        </article>

        <article style={panelStyle}>
          {detail ? (
            <form style={detailGridStyle} onSubmit={preventSubmit}>
              <div style={headerRowStyle}>
                <div>
                  <h2 style={sectionTitleStyle}>{detail.displayName}</h2>
                  <div style={mutedTextStyle}>
                    {detail.handle} · {detail.platform}
                  </div>
                </div>
                <span style={tagStyle}>{detail.leadStatus}</span>
              </div>

              <div style={statsGridStyle}>
                <div style={statCardStyle}>
                  <span style={mutedTextStyle}>총점</span>
                  <strong style={statValueStyle}>{detail.totalScore}</strong>
                </div>
                <div style={statCardStyle}>
                  <span style={mutedTextStyle}>등급</span>
                  <strong style={statValueStyle}>{detail.scoreGrade}</strong>
                </div>
                <div style={statCardStyle}>
                  <span style={mutedTextStyle}>리스크</span>
                  <strong style={statValueStyle}>{detail.riskFlags.length}</strong>
                </div>
              </div>

              <section style={sectionBlockStyle}>
                <h3 style={subTitleStyle}>점수 근거</h3>
                <div style={listStyle}>
                  {detail.score.scoreBreakdown.map((item) => (
                    <div key={`${item.label}-${item.reason}`} style={subCardStyle}>
                      <div style={rowStyle}>
                        <strong>{item.label}</strong>
                        <span style={tagStyle}>
                          {item.scoreDelta > 0 ? `+${item.scoreDelta}` : item.scoreDelta}
                        </span>
                      </div>
                      <div style={mutedTextStyle}>{item.reason}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section style={sectionBlockStyle}>
                <h3 style={subTitleStyle}>체크리스트</h3>
                <div style={listStyle}>
                  {draftAnswers.map((answer) => (
                    <div key={answer.id} style={subCardStyle}>
                      <div style={rowStyle}>
                        <strong>{answer.label}</strong>
                        <div style={inlineButtonRowStyle}>
                          <button
                            type="button"
                            style={answerButtonStyle(answer.passed === true)}
                            onClick={() => handleChecklistResult(answer.id, true)}
                          >
                            통과
                          </button>
                          <button
                            type="button"
                            style={answerButtonStyle(answer.passed === false)}
                            onClick={() => handleChecklistResult(answer.id, false)}
                          >
                            주의
                          </button>
                          <button
                            type="button"
                            style={answerButtonStyle(answer.passed === null)}
                            onClick={() => handleChecklistResult(answer.id, null)}
                          >
                            미정
                          </button>
                        </div>
                      </div>
                      <textarea
                        style={textareaStyle}
                        value={answer.note ?? ""}
                        onChange={(event) => handleChecklistNote(answer.id, event.target.value)}
                        placeholder="검수 메모를 입력하세요."
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section style={sectionBlockStyle}>
                <h3 style={subTitleStyle}>종합 메모</h3>
                <textarea
                  style={largeTextareaStyle}
                  value={draftNotes}
                  onChange={(event) => setDraftNotes(event.target.value)}
                  placeholder="최종 검수 판단 메모를 남겨주세요."
                />
              </section>

              <section style={sectionBlockStyle}>
                <h3 style={subTitleStyle}>리스크 플래그</h3>
                {detail.riskFlags.length ? (
                  <div style={chipRowStyle}>
                    {detail.riskFlags.map((flag) => (
                      <span key={flag} style={riskChipStyle}>
                        {flag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={emptyStyle}>현재 리스크 플래그가 없습니다.</div>
                )}
              </section>

              <div style={actionRowStyle}>
                <button type="button" style={primaryButtonStyle} onClick={() => void submitReview("APPROVED")}>
                  승인
                </button>
                <button type="button" style={ghostButtonStyle} onClick={() => void submitReview("ON_HOLD")}>
                  보류
                </button>
                <button type="button" style={dangerButtonStyle} onClick={() => void submitReview("DO_NOT_CONTACT")}>
                  연락 금지
                </button>
              </div>
            </form>
          ) : (
            <div style={emptyStyle}>왼쪽 목록에서 검수할 리드를 선택해주세요.</div>
          )}
        </article>
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: 32,
  background:
    "radial-gradient(circle at top right, rgba(34, 197, 94, 0.14), transparent 24%), #020617",
  color: "#e2e8f0",
  display: "grid",
  gap: 20
};

const heroStyle: CSSProperties = {
  background: "rgba(15, 23, 42, 0.92)",
  border: "1px solid #1e293b",
  borderRadius: 24,
  padding: 28,
  display: "flex",
  justifyContent: "space-between",
  gap: 24,
  alignItems: "flex-end"
};

const eyebrowStyle: CSSProperties = {
  color: "#4ade80",
  fontSize: 13,
  letterSpacing: 1.2,
  textTransform: "uppercase"
};

const titleStyle: CSSProperties = {
  margin: "12px 0 10px",
  fontSize: 36
};

const descriptionStyle: CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  maxWidth: 760,
  lineHeight: 1.7
};

const statusStyle: CSSProperties = {
  color: "#86efac",
  fontSize: 14,
  maxWidth: 320,
  textAlign: "right"
};

const layoutStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)",
  gap: 20
};

const panelStyle: CSSProperties = {
  background: "rgba(15, 23, 42, 0.92)",
  border: "1px solid #1e293b",
  borderRadius: 22,
  padding: 24,
  display: "grid",
  gap: 16
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 22
};

const subTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center"
};

const badgeStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "#052e16",
  color: "#86efac",
  fontSize: 13
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: 12
};

const itemButtonStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 16,
  borderRadius: 16,
  border: "1px solid #1e293b",
  background: "#020617",
  color: "#e2e8f0",
  textAlign: "left",
  cursor: "pointer"
};

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center"
};

const itemMetaStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  fontSize: 13,
  color: "#cbd5e1"
};

const mutedTextStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 14
};

const tagStyle: CSSProperties = {
  padding: "5px 9px",
  borderRadius: 999,
  background: "#052e16",
  color: "#86efac",
  fontSize: 12
};

const detailGridStyle: CSSProperties = {
  display: "grid",
  gap: 18
};

const statsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 12
};

const statCardStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  background: "#020617",
  border: "1px solid #1e293b",
  borderRadius: 16,
  padding: 16
};

const statValueStyle: CSSProperties = {
  fontSize: 24
};

const sectionBlockStyle: CSSProperties = {
  display: "grid",
  gap: 12
};

const subCardStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  background: "#020617",
  border: "1px solid #1e293b",
  borderRadius: 16,
  padding: 14
};

const inlineButtonRowStyle: CSSProperties = {
  display: "flex",
  gap: 8
};

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 84,
  borderRadius: 12,
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#e2e8f0",
  padding: 12,
  resize: "vertical"
};

const largeTextareaStyle: CSSProperties = {
  ...textareaStyle,
  minHeight: 120
};

const chipRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8
};

const riskChipStyle: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "rgba(239, 68, 68, 0.16)",
  color: "#fca5a5",
  fontSize: 13
};

const emptyStyle: CSSProperties = {
  borderRadius: 16,
  border: "1px dashed #334155",
  padding: 18,
  color: "#94a3b8",
  textAlign: "center"
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10
};

const primaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 12,
  padding: "12px 16px",
  background: "#22c55e",
  color: "#052e16",
  fontWeight: 700,
  cursor: "pointer"
};

const ghostButtonStyle: CSSProperties = {
  borderRadius: 12,
  padding: "12px 16px",
  border: "1px solid #334155",
  background: "transparent",
  color: "#e2e8f0",
  cursor: "pointer"
};

const dangerButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 12,
  padding: "12px 16px",
  background: "#ef4444",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer"
};

function answerButtonStyle(isActive: boolean): CSSProperties {
  return {
    borderRadius: 10,
    border: `1px solid ${isActive ? "#22c55e" : "#334155"}`,
    background: isActive ? "rgba(34, 197, 94, 0.16)" : "transparent",
    color: "#e2e8f0",
    padding: "8px 10px",
    cursor: "pointer"
  };
}
