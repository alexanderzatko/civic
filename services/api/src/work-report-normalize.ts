import type {
  ProjectWorkReportItem,
  ProjectWorkReportPage,
  RewardKind,
  WorkReportDetail,
  WorkReportGeoJsonGeometry,
  WorkReportSimpleGeometry,
  WorkReportVerificationContext,
} from "@civic/shared";

export function normalizeWorkReportItem(raw: unknown): ProjectWorkReportItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<ProjectWorkReportItem> & { photo_urls?: unknown };
  const workReportNid =
    r.work_report_nid != null ? String(r.work_report_nid).trim() : "";
  const title = typeof r.title === "string" ? r.title.trim() : "";
  if (!workReportNid || !title) return null;
  const hoursRaw = r.hours;
  const hours =
    hoursRaw == null || hoursRaw === ("" as unknown)
      ? null
      : Number.isFinite(Number(hoursRaw))
        ? Number(hoursRaw)
        : null;
  const photoUrls = Array.isArray(r.photo_urls)
    ? r.photo_urls
        .filter((u): u is string => typeof u === "string" && Boolean(u.trim()))
        .map((u) => u.trim())
    : [];
  return {
    work_report_nid: workReportNid,
    title,
    summary: typeof r.summary === "string" && r.summary ? r.summary : null,
    hours,
    author_username:
      typeof r.author_username === "string" && r.author_username
        ? r.author_username
        : null,
    author_display_name:
      typeof r.author_display_name === "string" && r.author_display_name
        ? r.author_display_name
        : null,
    created_at:
      typeof r.created_at === "string" && r.created_at ? r.created_at : null,
    photo_urls: photoUrls,
  };
}

function normalizeSimpleFieldLocation(
  raw: unknown,
): WorkReportSimpleGeometry | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as { type?: unknown; coordinates?: unknown };
  const type = g.type;
  if (type !== "Point" && type !== "LineString" && type !== "Polygon") {
    return null;
  }
  if (!Array.isArray(g.coordinates)) return null;
  if (type === "Point") {
    return { type: "Point", coordinates: g.coordinates as [number, number] };
  }
  if (type === "LineString") {
    return {
      type: "LineString",
      coordinates: g.coordinates as [number, number][],
    };
  }
  return {
    type: "Polygon",
    coordinates: g.coordinates as [number, number][][],
  };
}

function normalizeFieldLocation(raw: unknown): WorkReportGeoJsonGeometry | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as { type?: unknown; geometries?: unknown };
  if (g.type === "GeometryCollection") {
    if (!Array.isArray(g.geometries) || g.geometries.length === 0) return null;
    const parts: WorkReportSimpleGeometry[] = [];
    for (const part of g.geometries) {
      const normalized = normalizeSimpleFieldLocation(part);
      if (normalized) parts.push(normalized);
    }
    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0];
    return { type: "GeometryCollection", geometries: parts };
  }
  return normalizeSimpleFieldLocation(raw);
}

function normalizeVerificationContext(
  raw: unknown,
): WorkReportVerificationContext | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const v = raw as Partial<WorkReportVerificationContext>;
  const slotNid = v.slot_nid != null ? String(v.slot_nid).trim() : "";
  if (!/^\d+$/.test(slotNid) || slotNid === "0") return undefined;
  return {
    slot_nid: slotNid,
    can_decline: Boolean(v.can_decline),
    verification_count:
      typeof v.verification_count === "number" ? v.verification_count : 0,
    verification_needed:
      typeof v.verification_needed === "number" ? v.verification_needed : 2,
  };
}

export function normalizeWorkReportDetail(raw: unknown): WorkReportDetail | null {
  const base = normalizeWorkReportItem(raw);
  if (!base) return null;
  const r = raw as Partial<WorkReportDetail> & {
    web_urls?: unknown;
    field_location?: unknown;
    verification?: unknown;
  };
  const projectNid =
    r.project_nid != null && String(r.project_nid).trim()
      ? String(r.project_nid).trim()
      : null;
  const webUrls = Array.isArray(r.web_urls)
    ? r.web_urls
        .filter((u): u is string => typeof u === "string" && Boolean(u.trim()))
        .map((u) => u.trim())
    : [];
  const rewardKind: RewardKind | undefined =
    r.reward_kind === "merits" || r.reward_kind === "chrons"
      ? r.reward_kind
      : undefined;
  const dateStarted =
    r.date_started != null && Number.isFinite(Number(r.date_started))
      ? Number(r.date_started)
      : null;

  return {
    ...base,
    project_nid: projectNid,
    project_name:
      typeof r.project_name === "string" && r.project_name
        ? r.project_name
        : null,
    web_urls: webUrls,
    field_location: normalizeFieldLocation(r.field_location),
    nace_tid:
      r.nace_tid != null && String(r.nace_tid).trim()
        ? String(r.nace_tid).trim()
        : null,
    nace_label:
      typeof r.nace_label === "string" && r.nace_label ? r.nace_label : null,
    reward_kind: rewardKind,
    date_started: dateStarted,
    verification: normalizeVerificationContext(r.verification),
  };
}

export function normalizeWorkReportPage(
  raw: Partial<ProjectWorkReportPage> | undefined,
  fallbackNid: string,
  fallbackLimit: number,
  fallbackOffset: number,
): ProjectWorkReportPage {
  const items = Array.isArray(raw?.items)
    ? raw.items
        .map(normalizeWorkReportItem)
        .filter((x): x is ProjectWorkReportItem => x != null)
    : [];
  return {
    project_nid:
      raw?.project_nid != null && String(raw.project_nid).trim()
        ? String(raw.project_nid).trim()
        : fallbackNid,
    total: typeof raw?.total === "number" ? raw.total : items.length,
    limit: typeof raw?.limit === "number" ? raw.limit : fallbackLimit,
    offset: typeof raw?.offset === "number" ? raw.offset : fallbackOffset,
    items,
  };
}
