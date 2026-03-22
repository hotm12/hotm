"use client";

import type { CSSProperties, FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  canWriteWithRole,
  loadOperatorProfile,
  type OperatorProfile
} from "../operator-profile";

type CampaignSummary = {
  id: number;
  name: string;
  targetPlatform: string;
  status: string;
};

type DiscoveryRun = {
  id: number;
  campaignId: number;
  campaignName?: string;
  platform: string;
  status: "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED" | "IMPORTED";
  requestedBy?: string;
  startedAt: string;
  finishedAt?: string;
  summary?: {
    dryRun: boolean;
    candidateCount: number;
    importedCount?: number;
    skippedCount?: number;
    overwriteCount?: number;
    mergeCount?: number;
    warnings: string[];
    sourceResults: Array<{
      sourceType: string;
      sourceValue: string;
      status: string;
      candidateCount: number;
      warning?: string;
      error?: string;
    }>;
  };
  error?: {
    message: string;
    details?: string[];
  };
};

type DiscoveryCandidate = {
  id: number;
  runId: number;
  externalSourceType: string;
  externalId?: string;
  handle?: string;
  decisionStatus: "PENDING" | "SKIP" | "OVERWRITE" | "MERGE" | "IMPORTED";
  createdAt: string;
  normalized: {
    campaignId: number;
    platform: "INSTAGRAM";
    handle?: string;
    displayName?: string;
    category?: string;
    followerCount?: number;
    postCount?: number;
    bio?: string;
    contactValue?: string;
    posts: Array<{
      postUrl: string;
      caption?: string;
      postedAt?: string;
    }>;
  };
  preview: {
    status: "READY" | "SKIP";
    reason?: string;
    suggestedAction: "SKIP" | "OVERWRITE" | "MERGE";
  };
};

type ImportResponse = {
  run: DiscoveryRun;
  result: {
    imported: Array<{ id: number; displayName: string }>;
    skipped: Array<{ rowNumber: number; reason: string; handle?: string }>;
  };
};

type RunForm = {
  campaignId: string;
  maxCandidatesPerSource: string;
  maxPostsPerLead: string;
  dryRun: boolean;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

const defaultRunForm: RunForm = {
  campaignId: "",
  maxCandidatesPerSource: "10",
  maxPostsPerLead: "3",
  dryRun: false
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
    let message = `Request failed: ${response.status}`;

    try {
      const errorPayload = (await response.json()) as {
        message?: string | string[];
      };
      const nextMessage = Array.isArray(errorPayload.message)
        ? errorPayload.message.join(", ")
        : errorPayload.message;

      if (nextMessage) {
        message = nextMessage;
      }
    } catch {}

    throw new Error(message);
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("ko-KR");
}

export function DiscoveryClient() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [runs, setRuns] = useState<DiscoveryRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<DiscoveryRun | null>(null);
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([]);
  const [candidateActions, setCandidateActions] = useState<Record<number, "SKIP" | "OVERWRITE" | "MERGE">>({});
  const [runForm, setRunForm] = useState<RunForm>(defaultRunForm);
  const [operatorProfile, setOperatorProfile] = useState<OperatorProfile>(loadOperatorProfile());
  const [statusMessage, setStatusMessage] = useState("Loading discovery workspace.");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canWrite = canWriteWithRole(operatorProfile.role);

  useEffect(() => {
    void initialize();
    setOperatorProfile(loadOperatorProfile());
  }, []);

  useEffect(() => {
    setCandidateActions(
      candidates.reduce<Record<number, "SKIP" | "OVERWRITE" | "MERGE">>((acc, candidate) => {
        acc[candidate.id] =
          candidate.decisionStatus === "OVERWRITE" || candidate.decisionStatus === "MERGE"
            ? candidate.decisionStatus
            : candidate.preview.suggestedAction;
        return acc;
      }, {})
    );
  }, [candidates]);

  async function initialize() {
    try {
      const nextCampaigns = await request<CampaignSummary[]>("/campaigns");
      const instagramCampaigns = nextCampaigns.filter(
        (campaign) => campaign.targetPlatform === "INSTAGRAM"
      );
      setCampaigns(instagramCampaigns);
      setRunForm((current) => ({
        ...current,
        campaignId: current.campaignId || String(instagramCampaigns[0]?.id ?? "")
      }));
      await loadRuns(instagramCampaigns[0]?.id);
      setStatusMessage("Discovery workspace is ready.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to load discovery workspace.");
    }
  }

  async function loadRuns(preferredCampaignId?: number) {
    const selectedCampaignId = Number(runForm.campaignId) || undefined;
    const campaignId = preferredCampaignId ?? selectedCampaignId;
    const query = campaignId ? `?campaignId=${campaignId}` : "";
    const nextRuns = await request<DiscoveryRun[]>(`/discovery/runs${query}`);
    setRuns(nextRuns);

    const nextSelectedRun = nextRuns[0] ?? null;
    setSelectedRun(nextSelectedRun);

    if (nextSelectedRun) {
      await loadRun(nextSelectedRun.id);
    } else {
      setCandidates([]);
    }
  }

  async function loadRun(runId: number) {
    const [run, nextCandidates] = await Promise.all([
      request<DiscoveryRun>(`/discovery/runs/${runId}`),
      request<DiscoveryCandidate[]>(`/discovery/runs/${runId}/candidates`)
    ]);

    setSelectedRun(run);
    setCandidates(nextCandidates);
  }

  async function handleRunDiscovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!runForm.campaignId) {
      setStatusMessage("Instagram campaign is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const run = await request<DiscoveryRun>(
        `/discovery/instagram/campaigns/${runForm.campaignId}/run`,
        {
          method: "POST",
          body: JSON.stringify({
            maxCandidatesPerSource: Number(runForm.maxCandidatesPerSource || 10),
            maxPostsPerLead: Number(runForm.maxPostsPerLead || 3),
            dryRun: runForm.dryRun,
            actor: operatorProfile.name
          })
        }
      );

      await loadRuns(Number(runForm.campaignId));
      setStatusMessage(
        `Discovery run #${run.id} finished with status ${run.status}.`
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Discovery run failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleImportCandidates() {
    if (!selectedRun) {
      return;
    }

    const selections = candidates.map((candidate) => ({
      candidateId: candidate.id,
      action:
        candidate.decisionStatus === "IMPORTED"
          ? "SKIP"
          : candidateActions[candidate.id] ?? "SKIP"
    }));

    if (!selections.some((selection) => selection.action !== "SKIP")) {
      setStatusMessage("Choose at least one candidate to overwrite or merge before importing.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await request<ImportResponse>(`/discovery/runs/${selectedRun.id}/import`, {
        method: "POST",
        body: JSON.stringify({
          actor: operatorProfile.name,
          selections
        })
      });

      setSelectedRun(response.run);
      await loadRun(response.run.id);
      setStatusMessage(
        `Imported ${response.result.imported.length} candidates. Skipped ${response.result.skipped.length}.`
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>Instagram Discovery</div>
          <h1 style={titleStyle}>Public Seller Discovery</h1>
          <p style={textStyle}>
            Run Instagram candidate collection by campaign, preview deduplicated candidates, and
            import selected rows into the lead pipeline.
          </p>
        </div>
        <div style={statusStyle}>{statusMessage}</div>
      </section>

      <section style={topGridStyle}>
        <form style={panelStyle} onSubmit={handleRunDiscovery}>
          <h2 style={sectionTitleStyle}>Run Discovery</h2>
          <div style={detailFormGridStyle}>
            <select
              style={inputStyle}
              value={runForm.campaignId}
              onChange={(event) =>
                setRunForm((current) => ({ ...current, campaignId: event.target.value }))
              }
            >
              <option value="">Select Instagram campaign</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  #{campaign.id} {campaign.name}
                </option>
              ))}
            </select>
            <input
              style={inputStyle}
              type="number"
              min={1}
              value={runForm.maxCandidatesPerSource}
              onChange={(event) =>
                setRunForm((current) => ({
                  ...current,
                  maxCandidatesPerSource: event.target.value
                }))
              }
              placeholder="Max candidates / source"
            />
            <input
              style={inputStyle}
              type="number"
              min={1}
              value={runForm.maxPostsPerLead}
              onChange={(event) =>
                setRunForm((current) => ({
                  ...current,
                  maxPostsPerLead: event.target.value
                }))
              }
              placeholder="Max posts / lead"
            />
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={runForm.dryRun}
                onChange={(event) =>
                  setRunForm((current) => ({ ...current, dryRun: event.target.checked }))
                }
              />
              <span>Dry run (mock collector)</span>
            </label>
          </div>
          <div style={buttonRowStyle}>
            <button type="submit" style={primaryButtonStyle} disabled={!canWrite || isSubmitting}>
              Run Discovery
            </button>
            <button
              type="button"
              style={ghostButtonStyle}
              onClick={() => void loadRuns()}
              disabled={isSubmitting}
            >
              Refresh Runs
            </button>
          </div>
          <div style={mutedStyle}>Operator: {operatorProfile.name} / {operatorProfile.role}</div>
        </form>

        <article style={panelStyle}>
          <h2 style={sectionTitleStyle}>Selected Run</h2>
          {selectedRun ? (
            <div style={listStyle}>
              <div style={rowStyle}>
                <strong>Run #{selectedRun.id}</strong>
                <span style={tagStyle}>{selectedRun.status}</span>
              </div>
              <div style={mutedStyle}>
                Campaign #{selectedRun.campaignId} {selectedRun.campaignName ? `- ${selectedRun.campaignName}` : ""}
              </div>
              <div style={mutedStyle}>Started: {formatDateTime(selectedRun.startedAt)}</div>
              <div style={mutedStyle}>Finished: {formatDateTime(selectedRun.finishedAt)}</div>
              <div style={mutedStyle}>
                Candidates: {selectedRun.summary?.candidateCount ?? 0} / Dry run: {selectedRun.summary?.dryRun ? "YES" : "NO"}
              </div>
              {selectedRun.summary?.warnings.length ? (
                <div style={subCardStyle}>
                  <strong>Warnings</strong>
                  {selectedRun.summary.warnings.map((warning, index) => (
                    <div key={`${warning}-${index}`} style={mutedStyle}>
                      {warning}
                    </div>
                  ))}
                </div>
              ) : null}
              {selectedRun.error ? (
                <div style={errorCardStyle}>
                  <strong>{selectedRun.error.message}</strong>
                  {selectedRun.error.details?.map((detail, index) => (
                    <div key={`${detail}-${index}`} style={mutedStyle}>
                      {detail}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div style={emptyStyle}>No discovery run loaded yet.</div>
          )}
        </article>
      </section>

      <section style={contentGridStyle}>
        <article style={panelStyle}>
          <div style={listHeaderStyle}>
            <h2 style={sectionTitleStyle}>Discovery Runs</h2>
            <span style={badgeStyle}>{runs.length}</span>
          </div>
          <div style={listStyle}>
            {runs.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => void loadRun(run.id)}
                style={{
                  ...itemButtonStyle,
                  borderColor: run.id === selectedRun?.id ? "#38bdf8" : "#1e293b"
                }}
              >
                <div style={rowStyle}>
                  <strong>Run #{run.id}</strong>
                  <span style={tagStyle}>{run.status}</span>
                </div>
                <div style={mutedStyle}>
                  Campaign #{run.campaignId} {run.campaignName ? `- ${run.campaignName}` : ""}
                </div>
                <div style={mutedStyle}>
                  Candidates {run.summary?.candidateCount ?? 0} / Imported {run.summary?.importedCount ?? 0}
                </div>
                <div style={mutedStyle}>{formatDateTime(run.startedAt)}</div>
              </button>
            ))}
            {!runs.length ? <div style={emptyStyle}>No discovery runs yet.</div> : null}
          </div>
        </article>

        <article style={panelStyle}>
          <div style={listHeaderStyle}>
            <h2 style={sectionTitleStyle}>Candidate Preview</h2>
            <div style={buttonRowStyle}>
              <button
                type="button"
                style={ghostButtonStyle}
                onClick={() => selectedRun && void loadRun(selectedRun.id)}
                disabled={!selectedRun || isSubmitting}
              >
                Refresh
              </button>
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={() => void handleImportCandidates()}
                disabled={!selectedRun || !canWrite || isSubmitting}
              >
                Import Selected Actions
              </button>
            </div>
          </div>
          {selectedRun?.summary?.sourceResults.length ? (
            <div style={subCardStyle}>
              <strong>Source Results</strong>
              {selectedRun.summary.sourceResults.map((item) => (
                <div key={`${item.sourceType}-${item.sourceValue}`} style={mutedStyle}>
                  {item.sourceType}: {item.sourceValue} / {item.status} / {item.candidateCount}
                  {item.warning ? ` / ${item.warning}` : ""}
                  {item.error ? ` / ${item.error}` : ""}
                </div>
              ))}
            </div>
          ) : null}
          {candidates.length ? (
            <div style={previewTableStyle}>
              <div style={{ ...previewRowStyle, fontWeight: 700 }}>
                <span>Handle</span>
                <span>Name</span>
                <span>Source</span>
                <span>Followers</span>
                <span>Posts</span>
                <span>Contact</span>
                <span>Status</span>
                <span>Action</span>
                <span>Reason</span>
              </div>
              {candidates.map((candidate) => (
                <div key={candidate.id} style={previewRowStyle}>
                  <div>
                    <div>{candidate.normalized.handle ?? "-"}</div>
                    <div style={helpTextStyle}>#{candidate.id}</div>
                  </div>
                  <div>{candidate.normalized.displayName ?? "-"}</div>
                  <div>{candidate.externalSourceType}</div>
                  <div>{candidate.normalized.followerCount ?? "-"}</div>
                  <div>{candidate.normalized.postCount ?? "-"}</div>
                  <div>{candidate.normalized.contactValue ?? "-"}</div>
                  <div>{candidate.preview.status}</div>
                  <select
                    style={previewInputStyle}
                    value={
                      candidate.decisionStatus === "IMPORTED"
                        ? "SKIP"
                        : candidateActions[candidate.id] ?? "SKIP"
                    }
                    onChange={(event) =>
                      setCandidateActions((current) => ({
                        ...current,
                        [candidate.id]: event.target.value as "SKIP" | "OVERWRITE" | "MERGE"
                      }))
                    }
                    disabled={candidate.decisionStatus === "IMPORTED"}
                  >
                    <option value="SKIP">SKIP</option>
                    <option value="OVERWRITE">OVERWRITE</option>
                    <option value="MERGE">MERGE</option>
                  </select>
                  <div style={mutedStyle}>
                    {candidate.decisionStatus === "IMPORTED"
                      ? "Already imported."
                      : candidate.preview.reason ?? "Ready to import"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={emptyStyle}>Run discovery first to populate preview candidates.</div>
          )}
        </article>
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = { minHeight: "100vh", padding: 32, background: "#020617", color: "#e2e8f0", display: "grid", gap: 20 };
const heroStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 24, padding: 24, borderRadius: 20, border: "1px solid #1e293b", background: "#0f172a" };
const topGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 };
const contentGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 };
const panelStyle: CSSProperties = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 20, padding: 20, display: "grid", gap: 14 };
const subCardStyle: CSSProperties = { borderRadius: 16, border: "1px solid #1e293b", background: "#020617", padding: 14, display: "grid", gap: 8 };
const errorCardStyle: CSSProperties = { ...subCardStyle, borderColor: "#7f1d1d", background: "#450a0a" };
const detailFormGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 };
const listStyle: CSSProperties = { display: "grid", gap: 10 };
const rowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" };
const listHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" };
const buttonRowStyle: CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap" };
const inputStyle: CSSProperties = { width: "100%", borderRadius: 12, border: "1px solid #334155", background: "#020617", color: "#e2e8f0", padding: "11px 12px" };
const primaryButtonStyle: CSSProperties = { border: 0, borderRadius: 12, padding: "12px 14px", background: "#38bdf8", color: "#082f49", fontWeight: 700, cursor: "pointer" };
const ghostButtonStyle: CSSProperties = { borderRadius: 12, padding: "12px 14px", border: "1px solid #334155", background: "transparent", color: "#e2e8f0", cursor: "pointer" };
const itemButtonStyle: CSSProperties = { display: "grid", gap: 8, textAlign: "left", borderRadius: 16, border: "1px solid #1e293b", background: "#020617", color: "#e2e8f0", padding: 16, cursor: "pointer" };
const previewTableStyle: CSSProperties = { display: "grid", gap: 8 };
const previewRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1.1fr 1.2fr 120px 90px 90px 1.2fr 90px 150px 1.8fr", gap: 10, padding: "10px 12px", borderRadius: 12, background: "#020617", color: "#cbd5e1", fontSize: 13, alignItems: "center" };
const previewInputStyle: CSSProperties = { width: "100%", borderRadius: 10, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", padding: "8px 10px", fontSize: 13 };
const checkboxLabelStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1" };
const eyebrowStyle: CSSProperties = { color: "#38bdf8", fontSize: 13, textTransform: "uppercase", letterSpacing: 1.2 };
const titleStyle: CSSProperties = { margin: "8px 0 10px", fontSize: 34 };
const sectionTitleStyle: CSSProperties = { margin: 0, fontSize: 22 };
const statusStyle: CSSProperties = { color: "#7dd3fc", fontSize: 14, maxWidth: 340, textAlign: "right" };
const textStyle: CSSProperties = { margin: 0, color: "#cbd5e1", lineHeight: 1.6, maxWidth: 760 };
const mutedStyle: CSSProperties = { color: "#94a3b8", fontSize: 14 };
const helpTextStyle: CSSProperties = { color: "#64748b", fontSize: 12 };
const tagStyle: CSSProperties = { padding: "5px 9px", borderRadius: 999, background: "#082f49", color: "#7dd3fc", fontSize: 12 };
const badgeStyle: CSSProperties = { padding: "6px 10px", borderRadius: 999, background: "#082f49", color: "#7dd3fc", fontSize: 13 };
const emptyStyle: CSSProperties = { borderRadius: 16, border: "1px dashed #334155", padding: 18, color: "#94a3b8", textAlign: "center" };
