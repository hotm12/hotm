"use client";

import type { ChangeEvent, CSSProperties, FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  canWriteWithRole,
  loadOperatorProfile,
  type OperatorProfile
} from "../operator-profile";

type LeadSummary = {
  id: number;
  campaignId: number;
  platform: string;
  handle: string;
  displayName: string;
  category?: string;
  followerCount?: number;
  leadStatus: string;
  crmStage?: string;
  totalScore: number;
  scoreGrade: string;
  riskFlags: string[];
};

type LeadDetail = LeadSummary & {
  bio?: string;
  postCount?: number;
  reviewNotes?: string;
  posts: Array<{
    id: number;
    postUrl: string;
    caption: string;
    postedAt: string;
  }>;
  contacts: Array<{
    id: number;
    contactType: string;
    contactValue: string;
    isPrimary: boolean;
  }>;
  reviewChecklistAnswers: Array<{
    id: number;
    label: string;
    passed: boolean | null;
    note?: string;
  }>;
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

type LeadFilter = {
  campaignId: string;
  platform: string;
  leadStatus: string;
  keyword: string;
};

type CreateLeadForm = {
  campaignId: string;
  platform: string;
  handle: string;
  displayName: string;
  category: string;
  followerCount: string;
  postCount: string;
  bio: string;
  contactValue: string;
};

type LeadEditForm = {
  campaignId: string;
  platform: string;
  handle: string;
  displayName: string;
  category: string;
  followerCount: string;
  postCount: string;
  bio: string;
  contactValue: string;
  leadStatus: string;
  crmStage: string;
  reviewNotes: string;
};

type CsvImportForm = {
  campaignId: string;
  platform: string;
  csvText: string;
  fileName: string;
};

type ImportResult = {
  imported: LeadDetail[];
  skipped: Array<{
    rowNumber: number;
    reason: string;
    handle?: string;
    contactValue?: string;
  }>;
};

type ImportPreviewResult = {
  rows: Array<{
    rowNumber: number;
    campaignId: number;
    platform: string;
    handle?: string;
    displayName?: string;
    category?: string;
    followerCount?: number;
    postCount?: number;
    bio?: string;
    contactValue?: string;
    status: "READY" | "SKIP";
    reason?: string;
    action?: "SKIP" | "OVERWRITE" | "MERGE";
  }>;
  readyCount: number;
  skipCount: number;
};

type PreviewFilter = "ALL" | "READY" | "SKIP";

type ImportColumnTarget =
  | "IGNORE"
  | "campaignId"
  | "platform"
  | "handle"
  | "displayName"
  | "category"
  | "followerCount"
  | "postCount"
  | "bio"
  | "contactValue";

type ColumnMappingTemplate = {
  name: string;
  mapping: Record<string, ImportColumnTarget>;
  campaignId: string;
  platform: string;
  createdAt: string;
};

type LeadImportHistoryItem = {
  id: number;
  fileName?: string;
  templateName?: string;
  campaignId?: number;
  platform?: string;
  importedCount: number;
  skippedCount: number;
  overwriteCount: number;
  mergeCount: number;
  createdAt: string;
};

type ContactForm = {
  contactType: string;
  contactValue: string;
  isPrimary: boolean;
};

type PostForm = {
  postUrl: string;
  caption: string;
  postedAt: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";
const columnTemplateStorageKey = "seller-find-lead-import-templates";

const fallbackLeads: LeadSummary[] = [
  {
    id: 3,
    campaignId: 1,
    platform: "TIKTOK",
    handle: "@kglow_finds",
    displayName: "KGlow Finds",
    category: "K-Beauty",
    followerCount: 42100,
    leadStatus: "APPROVED",
    crmStage: "REPLIED",
    totalScore: 40,
    scoreGrade: "A",
    riskFlags: []
  }
];

const fallbackDetail: LeadDetail = {
  ...fallbackLeads[0],
  postCount: 312,
  bio: "Beauty seller account focused on product discovery and reviews.",
  reviewNotes: "Review completed. Outreach is allowed.",
  posts: [],
  contacts: [
    {
      id: 1,
      contactType: "EMAIL",
      contactValue: "partnerships@kglowfinds.com",
      isPrimary: true
    }
  ],
  reviewChecklistAnswers: [
    {
      id: 1,
      label: "Looks like a real seller account",
      passed: true,
      note: "Sales content and product links are visible."
    }
  ],
  score: {
    totalScore: 40,
    scoreGrade: "A",
    scoreBreakdown: [
      {
        label: "Follower size",
        scoreDelta: 20,
        reason: "Large enough audience for the target campaign."
      }
    ]
  }
};

const defaultFilter: LeadFilter = {
  campaignId: "",
  platform: "",
  leadStatus: "",
  keyword: ""
};

const defaultCreateForm: CreateLeadForm = {
  campaignId: "1",
  platform: "INSTAGRAM",
  handle: "",
  displayName: "",
  category: "",
  followerCount: "",
  postCount: "",
  bio: "",
  contactValue: ""
};

const sampleCsvText =
  "handle,displayName,platform,category,followerCount,contactValue\n@sample_handle,Sample Seller,INSTAGRAM,K-Beauty,12000,sample@example.com";

const defaultCsvImportForm: CsvImportForm = {
  campaignId: "1",
  platform: "INSTAGRAM",
  csvText: sampleCsvText,
  fileName: ""
};

const defaultColumnMapping = buildSuggestedColumnMapping(sampleCsvText);

const defaultLeadEditForm: LeadEditForm = {
  campaignId: "",
  platform: "INSTAGRAM",
  handle: "",
  displayName: "",
  category: "",
  followerCount: "",
  postCount: "",
  bio: "",
  contactValue: "",
  leadStatus: "NEW",
  crmStage: "",
  reviewNotes: ""
};

const defaultContactForm: ContactForm = {
  contactType: "EMAIL",
  contactValue: "",
  isPrimary: true
};

const defaultPostForm: PostForm = {
  postUrl: "",
  caption: "",
  postedAt: ""
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

function toQueryString(filters: LeadFilter) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value.trim()) {
      params.set(key, value.trim());
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

async function fileToCsvText(file: File) {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".csv")) {
    return file.text();
  }

  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
    const { read, utils } = await import("xlsx");
    const workbook = read(await file.arrayBuffer(), { type: "array" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      throw new Error("Spreadsheet has no sheets.");
    }

    return utils.sheet_to_csv(workbook.Sheets[firstSheetName]);
  }

  throw new Error("Unsupported file type.");
}

function parseCsvText(csvText: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let insideQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    const nextCharacter = csvText[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }

      continue;
    }

    if (!insideQuotes && character === ",") {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if (!insideQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows;
}

function normalizeCsvHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function suggestColumnTarget(header: string): ImportColumnTarget {
  const normalizedHeader = normalizeCsvHeader(header);

  if (!normalizedHeader) {
    return "IGNORE";
  }

  const aliasMap: Record<Exclude<ImportColumnTarget, "IGNORE">, string[]> = {
    campaignId: ["campaignid", "campaign", "campaignnumber"],
    platform: ["platform", "channel", "sourceplatform", "socialplatform"],
    handle: ["handle", "username", "account", "accountname", "sellerhandle", "ighandle", "tiktokhandle"],
    displayName: ["displayname", "name", "sellername", "profilename"],
    category: ["category", "niche", "vertical"],
    followerCount: ["followercount", "followers", "followerscount", "audience", "audiencesize"],
    postCount: ["postcount", "posts", "contentcount", "videocount"],
    bio: ["bio", "description", "profilebio", "introduction"],
    contactValue: ["contactvalue", "contact", "email", "emailaddress", "phone", "contactemail"]
  };

  for (const [target, aliases] of Object.entries(aliasMap) as Array<
    [Exclude<ImportColumnTarget, "IGNORE">, string[]]
  >) {
    if (aliases.includes(normalizedHeader)) {
      return target;
    }
  }

  return "IGNORE";
}

function buildSuggestedColumnMapping(csvText: string) {
  const rows = parseCsvText(csvText.trim());
  const headers = rows[0] ?? [];
  const usedTargets = new Set<ImportColumnTarget>();

  return headers.reduce<Record<string, ImportColumnTarget>>((mapping, header) => {
    const suggestedTarget = suggestColumnTarget(header);
    if (suggestedTarget !== "IGNORE" && !usedTargets.has(suggestedTarget)) {
      mapping[header] = suggestedTarget;
      usedTargets.add(suggestedTarget);
    } else {
      mapping[header] = "IGNORE";
    }
    return mapping;
  }, {});
}

function getDetectedCsvHeaders(csvText: string) {
  return parseCsvText(csvText.trim())[0] ?? [];
}

function escapeCsvValue(value: string | number | undefined) {
  const nextValue = value === undefined ? "" : String(value);

  if (nextValue.includes(",") || nextValue.includes('"') || nextValue.includes("\n")) {
    return `"${nextValue.replace(/"/g, '""')}"`;
  }

  return nextValue;
}

function buildCsvFromPreviewRows(rows: ImportPreviewResult["rows"]) {
  const headers = [
    "campaignId",
    "platform",
    "handle",
    "displayName",
    "category",
    "followerCount",
    "postCount",
    "bio",
    "contactValue"
  ];

  const lines = rows.map((row) =>
    [
      row.campaignId,
      row.platform,
      row.handle,
      row.displayName,
      row.category,
      row.followerCount,
      row.postCount,
      row.bio,
      row.contactValue
    ]
      .map((value) => escapeCsvValue(value))
      .join(",")
  );

  return [headers.join(","), ...lines].join("\n");
}

function buildMappedCsvText(csvText: string, columnMapping: Record<string, ImportColumnTarget>) {
  const rows = parseCsvText(csvText.trim());

  if (!rows.length) {
    return csvText;
  }

  const [headers, ...dataRows] = rows;
  const targetHeaders: Array<Exclude<ImportColumnTarget, "IGNORE">> = [
    "campaignId",
    "platform",
    "handle",
    "displayName",
    "category",
    "followerCount",
    "postCount",
    "bio",
    "contactValue"
  ];

  const mappedLines = dataRows.map((row) =>
    targetHeaders
      .map((targetHeader) => {
        const sourceIndex = headers.findIndex(
          (header) => (columnMapping[header] ?? suggestColumnTarget(header)) === targetHeader
        );
        return escapeCsvValue(sourceIndex >= 0 ? row[sourceIndex]?.trim() ?? "" : "");
      })
      .join(",")
  );

  return [targetHeaders.join(","), ...mappedLines].join("\n");
}

function buildImportActions(rows: ImportPreviewResult["rows"]) {
  return rows
    .filter((row) => row.action === "OVERWRITE" || row.action === "MERGE")
    .map((row) => ({
      rowNumber: row.rowNumber,
      action: row.action as "OVERWRITE" | "MERGE"
    }));
}

function summarizePreviewRows(rows: ImportPreviewResult["rows"]) {
  return {
    readyCount: rows.filter((row) => row.status === "READY").length,
    skipCount: rows.filter((row) => row.status === "SKIP").length
  };
}

function isDuplicateReason(reason?: string) {
  return Boolean(
    reason &&
      (reason.startsWith("Duplicate handle:") || reason.startsWith("Duplicate contactValue:"))
  );
}

export function LeadsClient() {
  const [filters, setFilters] = useState(defaultFilter);
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [csvImportForm, setCsvImportForm] = useState(defaultCsvImportForm);
  const [columnMapping, setColumnMapping] = useState<Record<string, ImportColumnTarget>>(defaultColumnMapping);
  const [columnTemplates, setColumnTemplates] = useState<ColumnMappingTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [activeTemplateName, setActiveTemplateName] = useState("");
  const [importHistory, setImportHistory] = useState<LeadImportHistoryItem[]>([]);
  const [operatorProfile, setOperatorProfile] = useState<OperatorProfile>(loadOperatorProfile());
  const [items, setItems] = useState<LeadSummary[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [editForm, setEditForm] = useState(defaultLeadEditForm);
  const [contactForm, setContactForm] = useState(defaultContactForm);
  const [postForm, setPostForm] = useState(defaultPostForm);
  const [statusMessage, setStatusMessage] = useState("Loading leads.");
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null);
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>("ALL");
  const detectedHeaders = getDetectedCsvHeaders(csvImportForm.csvText);

  useEffect(() => {
    void loadLeads();
    void loadImportHistory();
    loadColumnTemplates();
    setOperatorProfile(loadOperatorProfile());
  }, []);

  useEffect(() => {
    if (!detail) {
      setEditForm(defaultLeadEditForm);
      return;
    }

    setEditForm({
      campaignId: String(detail.campaignId),
      platform: detail.platform,
      handle: detail.handle,
      displayName: detail.displayName,
      category: detail.category ?? "",
      followerCount: detail.followerCount ? String(detail.followerCount) : "",
      postCount: detail.postCount ? String(detail.postCount) : "",
      bio: detail.bio ?? "",
      contactValue: detail.contacts.find((contact) => contact.contactType === "EMAIL")?.contactValue ?? "",
      leadStatus: detail.leadStatus,
      crmStage: detail.crmStage ?? "",
      reviewNotes: detail.reviewNotes ?? ""
    });
  }, [detail]);

  async function loadLeads(preferredLeadId?: number | null, nextFilters?: LeadFilter) {
    try {
      const nextItems = await request<LeadSummary[]>(`/leads${toQueryString(nextFilters ?? filters)}`);
      setItems(nextItems);
      const nextLeadId =
        nextItems.find((item) => item.id === preferredLeadId)?.id ?? nextItems[0]?.id ?? null;
      setSelectedLeadId(nextLeadId);
      if (nextLeadId) {
        await loadDetail(nextLeadId);
      } else {
        setDetail(null);
      }
      setStatusMessage("Loaded leads from API.");
    } catch {
      setItems(fallbackLeads);
      setSelectedLeadId(fallbackDetail.id);
      setDetail(fallbackDetail);
      setStatusMessage("API unavailable. Showing fallback data.");
    }
  }

  async function loadDetail(leadId: number) {
    try {
      setDetail(await request<LeadDetail>(`/leads/${leadId}`));
    } catch {
      setDetail(fallbackDetail);
    }
  }

  async function loadImportHistory() {
    try {
      setImportHistory(await request<LeadImportHistoryItem[]>("/leads/import-history?limit=8"));
    } catch {
      setImportHistory([]);
    }
  }

  function loadColumnTemplates() {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(columnTemplateStorageKey);

      if (!raw) {
        setColumnTemplates([]);
        return;
      }

      const parsed = JSON.parse(raw) as ColumnMappingTemplate[];
      setColumnTemplates(Array.isArray(parsed) ? parsed : []);
    } catch {
      setColumnTemplates([]);
    }
  }

  function saveColumnTemplates(nextTemplates: ColumnMappingTemplate[]) {
    setColumnTemplates(nextTemplates);

    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(columnTemplateStorageKey, JSON.stringify(nextTemplates));
  }

  function handleSaveTemplate() {
    const normalizedName = templateName.trim();

    if (!normalizedName) {
      setStatusMessage("Template name is required.");
      return;
    }

    const nextTemplate: ColumnMappingTemplate = {
      name: normalizedName,
      mapping: columnMapping,
      campaignId: csvImportForm.campaignId,
      platform: csvImportForm.platform,
      createdAt: new Date().toISOString()
    };

    const nextTemplates = [
      nextTemplate,
      ...columnTemplates.filter((item) => item.name !== normalizedName)
    ];

    saveColumnTemplates(nextTemplates);
    setActiveTemplateName(normalizedName);
    setStatusMessage(`Saved mapping template: ${normalizedName}`);
  }

  function handleApplyTemplate(name: string) {
    const nextTemplate = columnTemplates.find((item) => item.name === name);

    if (!nextTemplate) {
      return;
    }

    setColumnMapping(nextTemplate.mapping);
    setCsvImportForm((current) => ({
      ...current,
      campaignId: nextTemplate.campaignId || current.campaignId,
      platform: nextTemplate.platform || current.platform
    }));
    setActiveTemplateName(nextTemplate.name);
    setImportPreview(null);
    setStatusMessage(`Applied mapping template: ${nextTemplate.name}`);
  }

  function handleDeleteTemplate(name: string) {
    saveColumnTemplates(columnTemplates.filter((item) => item.name !== name));
    if (activeTemplateName === name) {
      setActiveTemplateName("");
    }
    setStatusMessage(`Deleted mapping template: ${name}`);
  }

  async function handleCreateLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const created = await request<LeadDetail>("/leads", {
        method: "POST",
        body: JSON.stringify({
          campaignId: Number(createForm.campaignId),
          platform: createForm.platform,
          handle: createForm.handle,
          displayName: createForm.displayName,
          category: createForm.category || undefined,
          followerCount: createForm.followerCount ? Number(createForm.followerCount) : undefined,
          postCount: createForm.postCount ? Number(createForm.postCount) : undefined,
          bio: createForm.bio || undefined,
          contactValue: createForm.contactValue || undefined,
          actor: operatorProfile.name
        })
      });

      setCreateForm(defaultCreateForm);
      await loadLeads(created.id);
      setStatusMessage(`Created lead: ${created.displayName}`);
    } catch {
      setStatusMessage("Lead creation failed. The handle or contact may already exist.");
    }
  }

  async function handleSaveLeadDetail() {
    if (!selectedLeadId) {
      return;
    }

    try {
      const updated = await request<LeadDetail>(`/leads/${selectedLeadId}`, {
        method: "PATCH",
        body: JSON.stringify({
          campaignId: Number(editForm.campaignId),
          platform: editForm.platform,
          handle: editForm.handle,
          displayName: editForm.displayName,
          category: editForm.category || undefined,
          followerCount: editForm.followerCount ? Number(editForm.followerCount) : undefined,
          postCount: editForm.postCount ? Number(editForm.postCount) : undefined,
          bio: editForm.bio || undefined,
          contactValue: editForm.contactValue,
          leadStatus: editForm.leadStatus,
          crmStage: editForm.crmStage || undefined,
          reviewNotes: editForm.reviewNotes || undefined,
          actor: operatorProfile.name
        })
      });

      setDetail(updated);
      await loadLeads(updated.id);
      setStatusMessage(`Updated lead: ${updated.displayName}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Lead update failed.");
    }
  }

  async function handleAddContact() {
    if (!selectedLeadId) {
      return;
    }

    try {
      const updated = await request<LeadDetail>(`/leads/${selectedLeadId}/contacts`, {
        method: "POST",
        body: JSON.stringify({
          contactType: contactForm.contactType,
          contactValue: contactForm.contactValue,
          isPrimary: contactForm.isPrimary,
          actor: operatorProfile.name
        })
      });

      setDetail(updated);
      setContactForm(defaultContactForm);
      await loadLeads(updated.id);
      setStatusMessage("Added contact to lead.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Adding contact failed.");
    }
  }

  async function handleRemoveContact(contactId: number) {
    if (!selectedLeadId) {
      return;
    }

    try {
      const updated = await request<LeadDetail>(
        `/leads/${selectedLeadId}/contacts/${contactId}?actor=${encodeURIComponent(operatorProfile.name)}`,
        {
          method: "DELETE"
        }
      );

      setDetail(updated);
      await loadLeads(updated.id);
      setStatusMessage("Removed contact from lead.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Removing contact failed.");
    }
  }

  async function handleAddPost() {
    if (!selectedLeadId) {
      return;
    }

    try {
      const updated = await request<LeadDetail>(`/leads/${selectedLeadId}/posts`, {
        method: "POST",
        body: JSON.stringify({
          postUrl: postForm.postUrl,
          caption: postForm.caption,
          postedAt: postForm.postedAt || undefined,
          actor: operatorProfile.name
        })
      });

      setDetail(updated);
      setPostForm(defaultPostForm);
      await loadLeads(updated.id);
      setStatusMessage("Added tracked post to lead.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Adding post failed.");
    }
  }

  function updateCsvImportText(csvText: string, fileName?: string) {
    setCsvImportForm((current) => ({
      ...current,
      csvText,
      fileName: fileName ?? current.fileName
    }));
    setColumnMapping(buildSuggestedColumnMapping(csvText));
    setImportPreview(null);
  }

  function buildPreparedImportCsvText() {
    if (importPreview) {
      return buildCsvFromPreviewRows(importPreview.rows);
    }

    return buildMappedCsvText(csvImportForm.csvText, columnMapping);
  }

  async function handleImportCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const importCsvText = buildPreparedImportCsvText();
      const result = await request<ImportResult>("/leads/import-csv", {
        method: "POST",
        body: JSON.stringify({
          campaignId: Number(csvImportForm.campaignId),
          platform: csvImportForm.platform,
          fileName: csvImportForm.fileName || undefined,
          templateName: activeTemplateName || undefined,
          actor: operatorProfile.name,
          csvText: importCsvText,
          actions: importPreview ? buildImportActions(importPreview.rows) : []
        })
      });

      await loadLeads(result.imported[0]?.id ?? null);
      await loadImportHistory();
      setImportPreview(null);
      setStatusMessage(
        `Imported ${result.imported.length} leads. Skipped ${result.skipped.length} duplicates or invalid rows.`
      );
    } catch {
      setStatusMessage("CSV import failed.");
    }
  }

  async function handlePreviewImport() {
    try {
      const previewCsvText = buildPreparedImportCsvText();
      const preview = await request<ImportPreviewResult>("/leads/preview-import-csv", {
        method: "POST",
        body: JSON.stringify({
          campaignId: Number(csvImportForm.campaignId),
          platform: csvImportForm.platform,
          fileName: csvImportForm.fileName || undefined,
          templateName: activeTemplateName || undefined,
          csvText: previewCsvText,
          actions: importPreview ? buildImportActions(importPreview.rows) : []
        })
      });

      setImportPreview({
        ...preview,
        rows: preview.rows.map((row) => {
          const previousAction = importPreview?.rows.find(
            (currentRow) => currentRow.rowNumber === row.rowNumber
          )?.action;

          return {
            ...row,
            action: previousAction ?? (isDuplicateReason(row.reason) ? "SKIP" : undefined)
          };
        })
      });
      setPreviewFilter("ALL");
      setCsvImportForm((current) => ({
        ...current,
        csvText: previewCsvText
      }));
      setColumnMapping(buildSuggestedColumnMapping(previewCsvText));
      setStatusMessage(
        `Preview ready. ${preview.readyCount} rows can be imported and ${preview.skipCount} rows will be skipped.`
      );
    } catch {
      setStatusMessage("Import preview failed.");
    }
  }

  function handlePreviewRowChange(
    rowNumber: number,
    field:
      | "campaignId"
      | "platform"
      | "handle"
      | "displayName"
      | "category"
      | "followerCount"
      | "postCount"
      | "bio"
      | "contactValue",
    value: string
  ) {
    setImportPreview((current) => {
      if (!current) {
        return current;
      }

      const nextValue =
        field === "campaignId" || field === "followerCount" || field === "postCount"
          ? value.trim()
            ? Number(value)
            : undefined
          : value || undefined;

      return {
        ...current,
        rows: current.rows.map((row) =>
          row.rowNumber === rowNumber
            ? {
                ...row,
                [field]: Number.isNaN(nextValue) ? undefined : nextValue
              }
            : row
        )
      };
    });
  }

  function handlePreviewRowActionChange(
    rowNumber: number,
    action: "SKIP" | "OVERWRITE" | "MERGE"
  ) {
    setImportPreview((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        rows: current.rows.map((row) =>
          row.rowNumber === rowNumber
            ? {
                ...row,
                action
              }
            : row
        )
      };
    });
  }

  function handleRemovePreviewRow(rowNumber: number) {
    setImportPreview((current) => {
      if (!current) {
        return current;
      }

      const rows = current.rows.filter((row) => row.rowNumber !== rowNumber);
      return {
        ...current,
        ...summarizePreviewRows(rows),
        rows
      };
    });
    setStatusMessage(`Removed row ${rowNumber} from preview.`);
  }

  function applyPreviewEditsToCsv() {
    if (!importPreview) {
      return;
    }

    const nextCsvText = buildCsvFromPreviewRows(importPreview.rows);
    setCsvImportForm((current) => ({
      ...current,
      csvText: nextCsvText
    }));
    setColumnMapping(buildSuggestedColumnMapping(nextCsvText));
    setStatusMessage("Applied preview edits to CSV text.");
  }

  function handleColumnMappingChange(header: string, target: ImportColumnTarget) {
    setColumnMapping((current) => {
      const nextMapping = { ...current };

      if (target !== "IGNORE") {
        for (const [currentHeader, currentTarget] of Object.entries(nextMapping)) {
          if (currentHeader !== header && currentTarget === target) {
            nextMapping[currentHeader] = "IGNORE";
          }
        }
      }

      nextMapping[header] = target;
      return nextMapping;
    });
    setImportPreview(null);
  }

  async function handleCsvFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const csvText = await fileToCsvText(file);
      updateCsvImportText(csvText, file.name);
      setStatusMessage(`Loaded file: ${file.name}`);
    } catch {
      setStatusMessage("Could not read the selected CSV or Excel file.");
    } finally {
      event.target.value = "";
    }
  }

  const visiblePreviewRows = importPreview
    ? importPreview.rows.filter((row) =>
        previewFilter === "ALL" ? true : row.status === previewFilter
      )
    : [];
  const canWrite = canWriteWithRole(operatorProfile.role);

  async function handleRecalculateScore() {
    if (!selectedLeadId) {
      return;
    }

    try {
      await request(`/leads/${selectedLeadId}/recalculate-score`, {
        method: "POST"
      });
      await loadLeads(selectedLeadId);
      setStatusMessage("Recalculated score.");
    } catch {
      setStatusMessage("Score recalculation failed.");
    }
  }

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>Lead Workspace</div>
          <h1 style={titleStyle}>Lead import and review</h1>
          <p style={textStyle}>Manual create, CSV paste, CSV file upload, and Excel file upload are available here.</p>
        </div>
        <div style={statusStyle}>{statusMessage}</div>
      </section>

      <section style={topGridStyle}>
        <article style={panelStyle}>
          <h2 style={sectionTitleStyle}>Filters</h2>
          <form style={gridStyle} onSubmit={(event) => { event.preventDefault(); void loadLeads(selectedLeadId, filters); }}>
            <input style={inputStyle} placeholder="Campaign ID" value={filters.campaignId} onChange={(event) => setFilters((current) => ({ ...current, campaignId: event.target.value }))} />
            <select style={inputStyle} value={filters.platform} onChange={(event) => setFilters((current) => ({ ...current, platform: event.target.value }))}>
              <option value="">ALL Platforms</option>
              <option value="INSTAGRAM">INSTAGRAM</option>
              <option value="TIKTOK">TIKTOK</option>
              <option value="YOUTUBE">YOUTUBE</option>
            </select>
            <select style={inputStyle} value={filters.leadStatus} onChange={(event) => setFilters((current) => ({ ...current, leadStatus: event.target.value }))}>
              <option value="">ALL Statuses</option>
              <option value="NEW">NEW</option>
              <option value="REVIEW_READY">REVIEW_READY</option>
              <option value="APPROVED">APPROVED</option>
            </select>
            <input style={inputStyle} placeholder="Keyword" value={filters.keyword} onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))} />
            <button type="submit" style={primaryButtonStyle}>Apply</button>
          </form>
        </article>

        <article style={panelStyle}>
          <h2 style={sectionTitleStyle}>Quick Create</h2>
          <form style={gridStyle} onSubmit={handleCreateLead}>
            <input style={inputStyle} placeholder="Campaign ID" value={createForm.campaignId} onChange={(event) => setCreateForm((current) => ({ ...current, campaignId: event.target.value }))} />
            <select style={inputStyle} value={createForm.platform} onChange={(event) => setCreateForm((current) => ({ ...current, platform: event.target.value }))}>
              <option value="INSTAGRAM">INSTAGRAM</option>
              <option value="TIKTOK">TIKTOK</option>
              <option value="YOUTUBE">YOUTUBE</option>
            </select>
            <input style={inputStyle} placeholder="Handle" value={createForm.handle} onChange={(event) => setCreateForm((current) => ({ ...current, handle: event.target.value }))} required />
            <input style={inputStyle} placeholder="Display Name" value={createForm.displayName} onChange={(event) => setCreateForm((current) => ({ ...current, displayName: event.target.value }))} required />
            <input style={inputStyle} placeholder="Category" value={createForm.category} onChange={(event) => setCreateForm((current) => ({ ...current, category: event.target.value }))} />
            <input style={inputStyle} placeholder="Follower Count" value={createForm.followerCount} onChange={(event) => setCreateForm((current) => ({ ...current, followerCount: event.target.value }))} />
            <input style={inputStyle} placeholder="Post Count" value={createForm.postCount} onChange={(event) => setCreateForm((current) => ({ ...current, postCount: event.target.value }))} />
            <input style={inputStyle} placeholder="Contact" value={createForm.contactValue} onChange={(event) => setCreateForm((current) => ({ ...current, contactValue: event.target.value }))} />
            <textarea style={textareaStyle} placeholder="Bio" value={createForm.bio} onChange={(event) => setCreateForm((current) => ({ ...current, bio: event.target.value }))} />
            <button type="submit" style={primaryButtonStyle} disabled={!canWrite}>Create Lead</button>
          </form>
        </article>

        <article style={panelStyle}>
          <h2 style={sectionTitleStyle}>CSV / Excel Import</h2>
          <p style={textStyle}>Paste CSV text or select a `.csv`, `.xlsx`, or `.xls` file.</p>
          <form style={gridStyle} onSubmit={handleImportCsv}>
            <input style={inputStyle} placeholder="Default Campaign ID" value={csvImportForm.campaignId} onChange={(event) => setCsvImportForm((current) => ({ ...current, campaignId: event.target.value }))} />
            <select style={inputStyle} value={csvImportForm.platform} onChange={(event) => setCsvImportForm((current) => ({ ...current, platform: event.target.value }))}>
              <option value="INSTAGRAM">INSTAGRAM</option>
              <option value="TIKTOK">TIKTOK</option>
              <option value="YOUTUBE">YOUTUBE</option>
            </select>
            <input style={inputStyle} type="file" accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={(event) => void handleCsvFileChange(event)} />
            <div style={helpTextStyle}>{csvImportForm.fileName || "No file selected"}</div>
            <textarea style={largeTextareaStyle} value={csvImportForm.csvText} onChange={(event) => updateCsvImportText(event.target.value)} />
            {detectedHeaders.length ? (
              <div style={mappingPanelStyle}>
                <div style={buttonRowStyle}>
                  <strong>Column Mapping</strong>
                  <button
                    type="button"
                    style={ghostButtonStyle}
                    onClick={() => setColumnMapping(buildSuggestedColumnMapping(csvImportForm.csvText))}
                    disabled={!canWrite}
                  >
                    Auto Map Headers
                  </button>
                </div>
                <div style={helpTextStyle}>
                  If your Excel or CSV uses different header names, map them here before previewing.
                </div>
                <div style={mappingGridStyle}>
                  {detectedHeaders.map((header) => (
                    <div key={header} style={mappingItemStyle}>
                      <strong>{header}</strong>
                      <select
                        style={previewInputStyle}
                        value={columnMapping[header] ?? "IGNORE"}
                        onChange={(event) =>
                          handleColumnMappingChange(
                            header,
                            event.target.value as ImportColumnTarget
                          )
                        }
                      >
                        <option value="IGNORE">IGNORE</option>
                        <option value="campaignId">campaignId</option>
                        <option value="platform">platform</option>
                        <option value="handle">handle</option>
                        <option value="displayName">displayName</option>
                        <option value="category">category</option>
                        <option value="followerCount">followerCount</option>
                        <option value="postCount">postCount</option>
                        <option value="bio">bio</option>
                        <option value="contactValue">contactValue</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div style={mappingPanelStyle}>
              <div style={buttonRowStyle}>
                <strong>Mapping Templates</strong>
                <span style={mutedStyle}>{columnTemplates.length} saved</span>
              </div>
              <div style={mappingTemplateRowStyle}>
                <input
                  style={inputStyle}
                  placeholder="Template name"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                />
                <button type="button" style={ghostButtonStyle} onClick={handleSaveTemplate} disabled={!canWrite}>
                  Save Template
                </button>
              </div>
              {columnTemplates.length ? (
                <div style={mappingGridStyle}>
                  {columnTemplates.map((template) => (
                    <div key={template.name} style={mappingItemStyle}>
                      <strong>{template.name}</strong>
                      <div style={helpTextStyle}>
                        Campaign #{template.campaignId || "-"} · {template.platform}
                      </div>
                      <div style={buttonRowStyle}>
                        <button
                          type="button"
                          style={ghostButtonStyle}
                          onClick={() => handleApplyTemplate(template.name)}
                        >
                          {activeTemplateName === template.name ? "Applied" : "Apply"}
                        </button>
                        <button
                          type="button"
                          style={previewDeleteButtonStyle}
                          onClick={() => handleDeleteTemplate(template.name)}
                          disabled={!canWrite}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={helpTextStyle}>No saved templates yet.</div>
              )}
            </div>
            <div style={buttonRowStyle}>
              <button type="button" style={ghostButtonStyle} onClick={() => updateCsvImportText(sampleCsvText, "")}>Load Sample</button>
              <button type="button" style={ghostButtonStyle} onClick={() => void handlePreviewImport()}>Preview Import</button>
              <button type="submit" style={primaryButtonStyle} disabled={!canWrite}>Import CSV</button>
            </div>
          </form>
          <div style={subCardStyle}>
            <div style={listHeaderStyle}>
              <strong>Import History</strong>
              <button type="button" style={ghostButtonStyle} onClick={() => void loadImportHistory()}>
                Refresh
              </button>
            </div>
            {importHistory.length ? (
              <div style={listStyle}>
                {importHistory.map((item) => (
                  <div key={item.id} style={subCardStyle}>
                    <div style={rowStyle}>
                      <strong>{item.fileName ?? "Manual CSV import"}</strong>
                      <span style={tagStyle}>{new Date(item.createdAt).toLocaleString("ko-KR")}</span>
                    </div>
                    <div style={mutedStyle}>
                      Imported {item.importedCount} · Skipped {item.skippedCount} · OVERWRITE {item.overwriteCount} · MERGE {item.mergeCount}
                    </div>
                    <div style={mutedStyle}>
                      Campaign #{item.campaignId ?? "-"} · {item.platform ?? "-"} · Template {item.templateName ?? "-"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={emptyStyle}>No import history yet.</div>
            )}
          </div>
          {importPreview ? (
            <div style={subCardStyle}>
              <strong>
                Preview: {importPreview.readyCount} ready / {importPreview.skipCount} skipped
              </strong>
              <div style={buttonRowStyle}>
                <select
                  style={previewInputStyle}
                  value={previewFilter}
                  onChange={(event) => setPreviewFilter(event.target.value as PreviewFilter)}
                >
                  <option value="ALL">ALL Rows</option>
                  <option value="READY">READY Only</option>
                  <option value="SKIP">SKIP Only</option>
                </select>
                <button type="button" style={ghostButtonStyle} onClick={applyPreviewEditsToCsv}>
                  Apply Edits To CSV
                </button>
                <button type="button" style={ghostButtonStyle} onClick={() => void handlePreviewImport()}>
                  Re-Preview
                </button>
              </div>
              <div style={previewTableStyle}>
                {visiblePreviewRows.length ? visiblePreviewRows.map((row) => (
                  <div key={`${row.rowNumber}-${row.handle ?? "row"}`} style={previewRowStyle}>
                    <span>Row {row.rowNumber}</span>
                    <input
                      style={previewInputStyle}
                      type="number"
                      value={row.campaignId ?? ""}
                      onChange={(event) => handlePreviewRowChange(row.rowNumber, "campaignId", event.target.value)}
                    />
                    <select
                      style={previewInputStyle}
                      value={row.platform ?? csvImportForm.platform}
                      onChange={(event) => handlePreviewRowChange(row.rowNumber, "platform", event.target.value)}
                    >
                      <option value="INSTAGRAM">INSTAGRAM</option>
                      <option value="TIKTOK">TIKTOK</option>
                      <option value="YOUTUBE">YOUTUBE</option>
                    </select>
                    <input style={previewInputStyle} value={row.handle ?? ""} onChange={(event) => handlePreviewRowChange(row.rowNumber, "handle", event.target.value)} />
                    <input style={previewInputStyle} value={row.displayName ?? ""} onChange={(event) => handlePreviewRowChange(row.rowNumber, "displayName", event.target.value)} />
                    <input style={previewInputStyle} value={row.category ?? ""} onChange={(event) => handlePreviewRowChange(row.rowNumber, "category", event.target.value)} />
                    <input
                      style={previewInputStyle}
                      type="number"
                      value={row.followerCount ?? ""}
                      onChange={(event) => handlePreviewRowChange(row.rowNumber, "followerCount", event.target.value)}
                    />
                    <input
                      style={previewInputStyle}
                      type="number"
                      value={row.postCount ?? ""}
                      onChange={(event) => handlePreviewRowChange(row.rowNumber, "postCount", event.target.value)}
                    />
                    <input style={previewInputStyle} value={row.bio ?? ""} onChange={(event) => handlePreviewRowChange(row.rowNumber, "bio", event.target.value)} />
                    <span>{row.status}</span>
                    <span>{row.reason ?? "Ready to import"}</span>
                    <input style={previewInputStyle} value={row.contactValue ?? ""} onChange={(event) => handlePreviewRowChange(row.rowNumber, "contactValue", event.target.value)} />
                    {isDuplicateReason(row.reason) ? (
                      <select
                        style={previewInputStyle}
                        value={row.action ?? "SKIP"}
                        onChange={(event) =>
                          handlePreviewRowActionChange(
                            row.rowNumber,
                            event.target.value as "SKIP" | "OVERWRITE" | "MERGE"
                          )
                        }
                      >
                        <option value="SKIP">SKIP</option>
                        <option value="OVERWRITE">OVERWRITE</option>
                        <option value="MERGE">MERGE</option>
                      </select>
                    ) : (
                      <span style={mutedStyle}>{row.action ?? "-"}</span>
                    )}
                    <button
                      type="button"
                      style={previewDeleteButtonStyle}
                      onClick={() => handleRemovePreviewRow(row.rowNumber)}
                    >
                      Remove
                    </button>
                  </div>
                )) : (
                  <div style={emptyPreviewStyle}>No rows match the current preview filter.</div>
                )}
              </div>
            </div>
          ) : null}
        </article>
      </section>

      <section style={contentGridStyle}>
        <article style={panelStyle}>
          <div style={listHeaderStyle}>
            <h2 style={sectionTitleStyle}>Lead List</h2>
            <span style={badgeStyle}>{items.length}</span>
          </div>
          <div style={listStyle}>
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => { setSelectedLeadId(item.id); void loadDetail(item.id); }} style={{ ...itemButtonStyle, borderColor: item.id === selectedLeadId ? "#38bdf8" : "#1e293b" }}>
                <div style={rowStyle}>
                  <strong>{item.displayName}</strong>
                  <span style={tagStyle}>{item.scoreGrade}</span>
                </div>
                <div style={mutedStyle}>{item.handle} · {item.platform}</div>
                <div style={mutedStyle}>{item.leadStatus} · Score {item.totalScore}</div>
              </button>
            ))}
          </div>
        </article>

        <article style={panelStyle}>
          <div style={listHeaderStyle}>
            <h2 style={sectionTitleStyle}>Lead Detail</h2>
            <div style={buttonRowStyle}>
            <button type="button" style={ghostButtonStyle} onClick={handleRecalculateScore} disabled={!canWrite}>
                Recalculate
              </button>
              <button type="button" style={primaryButtonStyle} onClick={() => void handleSaveLeadDetail()} disabled={!canWrite}>
                Save Changes
              </button>
            </div>
          </div>
          {detail ? (
            <div style={listStyle}>
              <div style={subCardStyle}>
                <div style={rowStyle}>
                  <strong>{detail.displayName}</strong>
                  <span style={tagStyle}>{editForm.leadStatus}</span>
                </div>
                <div style={mutedStyle}>{detail.handle} · {detail.platform} · Campaign #{detail.campaignId}</div>
                <div style={mutedStyle}>Operator: {operatorProfile.name} 쨌 Role: {operatorProfile.role}</div>
                <div style={textStyle}>{detail.bio ?? "No bio available."}</div>
              </div>
              <div style={detailFormGridStyle}>
                <input
                  style={inputStyle}
                  placeholder="Campaign ID"
                  value={editForm.campaignId}
                  onChange={(event) => setEditForm((current) => ({ ...current, campaignId: event.target.value }))}
                />
                <select
                  style={inputStyle}
                  value={editForm.platform}
                  onChange={(event) => setEditForm((current) => ({ ...current, platform: event.target.value }))}
                >
                  <option value="INSTAGRAM">INSTAGRAM</option>
                  <option value="TIKTOK">TIKTOK</option>
                  <option value="YOUTUBE">YOUTUBE</option>
                </select>
                <input
                  style={inputStyle}
                  placeholder="Handle"
                  value={editForm.handle}
                  onChange={(event) => setEditForm((current) => ({ ...current, handle: event.target.value }))}
                />
                <input
                  style={inputStyle}
                  placeholder="Display Name"
                  value={editForm.displayName}
                  onChange={(event) => setEditForm((current) => ({ ...current, displayName: event.target.value }))}
                />
                <input
                  style={inputStyle}
                  placeholder="Category"
                  value={editForm.category}
                  onChange={(event) => setEditForm((current) => ({ ...current, category: event.target.value }))}
                />
                <input
                  style={inputStyle}
                  placeholder="Follower Count"
                  value={editForm.followerCount}
                  onChange={(event) => setEditForm((current) => ({ ...current, followerCount: event.target.value }))}
                />
                <input
                  style={inputStyle}
                  placeholder="Post Count"
                  value={editForm.postCount}
                  onChange={(event) => setEditForm((current) => ({ ...current, postCount: event.target.value }))}
                />
                <input
                  style={inputStyle}
                  placeholder="Primary Contact"
                  value={editForm.contactValue}
                  onChange={(event) => setEditForm((current) => ({ ...current, contactValue: event.target.value }))}
                />
                <select
                  style={inputStyle}
                  value={editForm.leadStatus}
                  onChange={(event) => setEditForm((current) => ({ ...current, leadStatus: event.target.value }))}
                >
                  <option value="NEW">NEW</option>
                  <option value="REVIEW_READY">REVIEW_READY</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="ON_HOLD">ON_HOLD</option>
                  <option value="DO_NOT_CONTACT">DO_NOT_CONTACT</option>
                </select>
                <input
                  style={inputStyle}
                  placeholder="CRM Stage"
                  value={editForm.crmStage}
                  onChange={(event) => setEditForm((current) => ({ ...current, crmStage: event.target.value }))}
                />
                <textarea
                  style={textareaStyle}
                  placeholder="Bio"
                  value={editForm.bio}
                  onChange={(event) => setEditForm((current) => ({ ...current, bio: event.target.value }))}
                />
                <textarea
                  style={textareaStyle}
                  placeholder="Review Notes"
                  value={editForm.reviewNotes}
                  onChange={(event) => setEditForm((current) => ({ ...current, reviewNotes: event.target.value }))}
                />
              </div>
              <div style={gridStyle}>
                <div style={subCardStyle}><strong>Score</strong><span>{detail.score.totalScore}</span></div>
                <div style={subCardStyle}><strong>Grade</strong><span>{detail.score.scoreGrade}</span></div>
                <div style={subCardStyle}><strong>Followers</strong><span>{detail.followerCount ?? "-"}</span></div>
                <div style={subCardStyle}><strong>Posts</strong><span>{detail.postCount ?? "-"}</span></div>
              </div>
              <div style={subCardStyle}>
                <strong>Contacts</strong>
                {detail.contacts.map((contact) => (
                  <div key={contact.id} style={rowStyle}>
                    <span style={mutedStyle}>{contact.contactType}: {contact.contactValue}</span>
                    <button
                      type="button"
                      style={previewDeleteButtonStyle}
                      onClick={() => void handleRemoveContact(contact.id)}
                      disabled={!canWrite}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div style={detailFormGridStyle}>
                  <select
                    style={inputStyle}
                    value={contactForm.contactType}
                    onChange={(event) => setContactForm((current) => ({ ...current, contactType: event.target.value }))}
                  >
                    <option value="EMAIL">EMAIL</option>
                    <option value="PHONE">PHONE</option>
                    <option value="DM">DM</option>
                  </select>
                  <input
                    style={inputStyle}
                    placeholder="Contact value"
                    value={contactForm.contactValue}
                    onChange={(event) => setContactForm((current) => ({ ...current, contactValue: event.target.value }))}
                  />
                  <label style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      checked={contactForm.isPrimary}
                      onChange={(event) => setContactForm((current) => ({ ...current, isPrimary: event.target.checked }))}
                    />
                    <span>Primary</span>
                  </label>
                  <button type="button" style={ghostButtonStyle} onClick={() => void handleAddContact()} disabled={!canWrite}>
                    Add Contact
                  </button>
                </div>
              </div>
              <div style={subCardStyle}>
                <strong>Tracked Posts</strong>
                {detail.posts.length ? detail.posts.map((post) => (
                  <div key={post.id} style={mutedStyle}>
                    {post.postUrl} {post.caption ? `쨌 ${post.caption}` : ""} {post.postedAt ? `쨌 ${post.postedAt}` : ""}
                  </div>
                )) : (
                  <div style={mutedStyle}>No tracked posts yet.</div>
                )}
                <div style={detailFormGridStyle}>
                  <input
                    style={inputStyle}
                    placeholder="Post URL"
                    value={postForm.postUrl}
                    onChange={(event) => setPostForm((current) => ({ ...current, postUrl: event.target.value }))}
                  />
                  <input
                    style={inputStyle}
                    placeholder="Caption"
                    value={postForm.caption}
                    onChange={(event) => setPostForm((current) => ({ ...current, caption: event.target.value }))}
                  />
                  <input
                    style={inputStyle}
                    type="datetime-local"
                    value={postForm.postedAt}
                    onChange={(event) => setPostForm((current) => ({ ...current, postedAt: event.target.value }))}
                  />
                  <button type="button" style={ghostButtonStyle} onClick={() => void handleAddPost()} disabled={!canWrite}>
                    Add Post
                  </button>
                </div>
              </div>
              <div style={subCardStyle}>
                <strong>Score Breakdown</strong>
                {detail.score.scoreBreakdown.map((item) => (
                  <div key={`${item.label}-${item.reason}`} style={mutedStyle}>
                    {item.label}: {item.scoreDelta > 0 ? `+${item.scoreDelta}` : item.scoreDelta} · {item.reason}
                  </div>
                ))}
              </div>
              <div style={subCardStyle}>
                <strong>Checklist</strong>
                {detail.reviewChecklistAnswers.map((item) => (
                  <div key={item.id} style={mutedStyle}>
                    {item.label}: {item.passed === null ? "PENDING" : item.passed ? "PASS" : "FAIL"} {item.note ? `· ${item.note}` : ""}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={emptyStyle}>Select a lead from the list.</div>
          )}
        </article>
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = { minHeight: "100vh", padding: 32, background: "#020617", color: "#e2e8f0", display: "grid", gap: 20 };
const heroStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 24, padding: 24, borderRadius: 20, border: "1px solid #1e293b", background: "#0f172a" };
const topGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 };
const contentGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 };
const panelStyle: CSSProperties = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 20, padding: 20, display: "grid", gap: 14 };
const gridStyle: CSSProperties = { display: "grid", gap: 12 };
const detailFormGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 };
const listStyle: CSSProperties = { display: "grid", gap: 10 };
const rowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" };
const listHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" };
const buttonRowStyle: CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap" };
const mappingTemplateRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10 };
const checkboxLabelStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1" };
const inputStyle: CSSProperties = { width: "100%", borderRadius: 12, border: "1px solid #334155", background: "#020617", color: "#e2e8f0", padding: "11px 12px" };
const textareaStyle: CSSProperties = { ...inputStyle, minHeight: 90, resize: "vertical" };
const largeTextareaStyle: CSSProperties = { ...inputStyle, minHeight: 160, resize: "vertical" };
const primaryButtonStyle: CSSProperties = { border: 0, borderRadius: 12, padding: "12px 14px", background: "#38bdf8", color: "#082f49", fontWeight: 700, cursor: "pointer" };
const ghostButtonStyle: CSSProperties = { borderRadius: 12, padding: "12px 14px", border: "1px solid #334155", background: "transparent", color: "#e2e8f0", cursor: "pointer" };
const itemButtonStyle: CSSProperties = { display: "grid", gap: 8, textAlign: "left", borderRadius: 16, border: "1px solid #1e293b", background: "#020617", color: "#e2e8f0", padding: 16, cursor: "pointer" };
const subCardStyle: CSSProperties = { borderRadius: 16, border: "1px solid #1e293b", background: "#020617", padding: 14, display: "grid", gap: 8 };
const mappingPanelStyle: CSSProperties = {
  borderRadius: 16,
  border: "1px solid #1e293b",
  background: "#020617",
  padding: 14,
  display: "grid",
  gap: 12
};
const mappingGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10
};
const mappingItemStyle: CSSProperties = {
  display: "grid",
  gap: 8
};
const previewTableStyle: CSSProperties = { display: "grid", gap: 8 };
const previewRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "90px 120px 140px 1fr 1fr 1fr 130px 130px 1.4fr 90px 1.4fr 1fr 140px 110px",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 12,
  background: "#0f172a",
  color: "#cbd5e1",
  fontSize: 13
};
const emptyPreviewStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px dashed #334155",
  padding: 16,
  color: "#94a3b8",
  textAlign: "center"
};
const previewInputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#020617",
  color: "#e2e8f0",
  padding: "8px 10px",
  fontSize: 13
};
const previewDeleteButtonStyle: CSSProperties = {
  borderRadius: 10,
  border: "1px solid #7f1d1d",
  background: "#450a0a",
  color: "#fecaca",
  padding: "8px 10px",
  cursor: "pointer",
  fontSize: 13
};
const eyebrowStyle: CSSProperties = { color: "#38bdf8", fontSize: 13, textTransform: "uppercase", letterSpacing: 1.2 };
const titleStyle: CSSProperties = { margin: "8px 0 10px", fontSize: 34 };
const sectionTitleStyle: CSSProperties = { margin: 0, fontSize: 22 };
const statusStyle: CSSProperties = { color: "#7dd3fc", fontSize: 14, maxWidth: 320, textAlign: "right" };
const textStyle: CSSProperties = { margin: 0, color: "#cbd5e1", lineHeight: 1.6 };
const mutedStyle: CSSProperties = { color: "#94a3b8", fontSize: 14 };
const helpTextStyle: CSSProperties = { color: "#94a3b8", fontSize: 12 };
const tagStyle: CSSProperties = { padding: "5px 9px", borderRadius: 999, background: "#082f49", color: "#7dd3fc", fontSize: 12 };
const badgeStyle: CSSProperties = { padding: "6px 10px", borderRadius: 999, background: "#082f49", color: "#7dd3fc", fontSize: 13 };
const emptyStyle: CSSProperties = { borderRadius: 16, border: "1px dashed #334155", padding: 18, color: "#94a3b8", textAlign: "center" };
