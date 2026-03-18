"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

type AuditLogItem = {
  id: number;
  entityType: string;
  entityId: number;
  actionType: string;
  actor?: string;
  summary?: string;
  detail?: string;
  createdAt: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

const fallbackItems: AuditLogItem[] = [
  {
    id: 1,
    entityType: "LEAD",
    entityId: 3,
    actionType: "ONBOARDING_STARTED",
    actor: "system",
    summary: "온보딩 시작",
    detail: "상품 카탈로그 요청 단계로 이동했습니다.",
    createdAt: "2026-03-18T03:00:00Z"
  }
];

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

export function AuditClient() {
  const [items, setItems] = useState<AuditLogItem[]>(fallbackItems);
  const [statusMessage, setStatusMessage] = useState("감사 로그를 불러오는 중입니다.");

  useEffect(() => {
    void loadAuditLogs();
  }, []);

  async function loadAuditLogs() {
    try {
      const nextItems = await request<AuditLogItem[]>("/audit-log?limit=40");
      setItems(nextItems);
      setStatusMessage("API에서 최신 감사 로그를 불러왔습니다.");
    } catch {
      setItems(fallbackItems);
      setStatusMessage("API 연결 전이라 샘플 감사 로그를 표시 중입니다.");
    }
  }

  return (
    <main style={pageStyle}>
      <section style={headerStyle}>
        <div>
          <h1 style={{ margin: "0 0 10px" }}>감사 로그</h1>
          <p style={{ margin: 0, color: "#94a3b8" }}>
            주요 검수, 아웃리치, CRM, 온보딩 변경 이력을 시간순으로 확인합니다.
          </p>
        </div>
        <div style={{ color: "#7dd3fc", fontSize: 14 }}>{statusMessage}</div>
      </section>

      <section style={listStyle}>
        {items.map((item) => (
          <article key={item.id} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
              <div>
                <strong>{item.summary ?? item.actionType}</strong>
                <div style={{ color: "#7dd3fc", marginTop: 8 }}>
                  {item.entityType} #{item.entityId}
                </div>
              </div>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>
                {new Date(item.createdAt).toLocaleString("ko-KR")}
              </div>
            </div>
            {item.detail ? <p style={{ marginBottom: 0 }}>{item.detail}</p> : null}
            <div style={{ color: "#94a3b8", fontSize: 13 }}>
              {item.actor ? `actor: ${item.actor}` : item.actionType}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: 32,
  background: "#020617",
  color: "#e2e8f0",
  display: "grid",
  gap: 20
};

const headerStyle: CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 18,
  padding: 24,
  display: "flex",
  justifyContent: "space-between",
  gap: 24,
  alignItems: "end"
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: 14
};

const cardStyle: CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 16,
  padding: 18
};
