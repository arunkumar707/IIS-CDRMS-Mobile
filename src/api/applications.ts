import { apiRequest, ApiError } from './client';

function asData<T>(payload: unknown): T {
  if (
    payload !== null &&
    typeof payload === 'object' &&
    Object.prototype.hasOwnProperty.call(payload, 'data')
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function asList<T>(payload: unknown): T[] {
  if (
    payload !== null &&
    typeof payload === 'object' &&
    Array.isArray((payload as { items?: unknown }).items)
  ) {
    return (payload as { items: T[] }).items;
  }
  const value = asData<unknown>(payload);
  return Array.isArray(value) ? (value as T[]) : [];
}



export type ApplicationHistoryItem = {
  id?: string;
  taskName: string;
  performedBy: string;
  sentTo?: string | null;
  startedOn?: string | null;
  completedOn?: string | null;
  comments?: string | null;
  statusBefore?: string | null;
  statusAfter?: string | null;
};

export type MobileApplication = {
  id: string;
  applicationNumber: string;
  eOfficeNumber?: string | null;
  siteNo: string;
  addressLine1: string;
  addressLine2?: string | null;
  addressBlock: string;
  addressCity: string;
  addressState: string;
  addressPincode: string;
  siteDimensionType: 'Even' | 'Odd' | 'Regular';
  siteDimension?: string | null;
  siteDimensionComment?: string | null;
  scheduleNorth?: string | null;
  scheduleSouth?: string | null;
  scheduleWest?: string | null;
  scheduleEast?: string | null;
  engineerScheduleNotes?: Record<string, string> | null;
  scheduleRoadFlags?: Record<string, boolean> | null;
  /** Engineer N/S/E/W — separate from ZC siteDimension. */
  engineerDimensions?: Record<string, string> | null;
  zoneId?: number;
  zoneCode: string;
  status: MobileApplicationStatus;
  createdByZcName?: string | null;
  assignedEngineerName?: string | null;
  assignedEngineerUserId?: string;
  assignedEngineerLoginId?: string | null;
  assignedEngineerProfilePhoto?: string | null;
  assignedCaoName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  engineerSiteDetails?: string | null;
  compass?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  /** Reverse-geocoded place from engineer GPS (step 2 / submit). */
  engineerGeoAddress?: {
    displayName?: string;
    village?: string;
    taluk?: string;
    district?: string;
    state?: string;
    street?: string;
    name?: string;
    layoutName?: string;
    area?: string;
    block?: string;
    postalCode?: string;
    country?: string;
    accuracy?: number | null;
  } | null;
  occupancy?: 'Empty' | 'Occupied' | null;
  occupancyReason?: string | null;
  dimNorth?: string | null;
  dimSouth?: string | null;
  dimEast?: string | null;
  dimWest?: string | null;
  totalSiteArea?: string | null;
  selfieUrl?: string | null;
  photoUrls?: string[] | null;
  schedulePhotoUrls?: Record<string, string> | null;
  videoUrl?: string | null;
  engineerComments?: string | null;
  engineerSubmittedAt?: string | null;
};

export type ApplicationAs = 'engineer' | 'zc' | 'cao';

export type MyZoneEngineer = {
  userId: string;
  name: string;
  postName?: string | null;
};

export type MyZoneMeta = {
  zoneId: number;
  zoneCode: string;
  zoneName: string;
  engineers: MyZoneEngineer[];
};

export type CaoCounts = {
  pending: number;
  verified: number;
  returned: number;
  rejected: number;
  total: number;
};

export type CreateApplicationInput = {
  eOfficeNumber: string;
  siteNo: string;
  addressLine1: string;
  addressLine2?: string;
  addressBlock: string;
  /** Display only — backend stamps/ignores on write. */
  addressCity?: string;
  /** Display only — backend stamps/ignores on write. */
  addressState?: string;
  addressPincode: string;
  siteDimensionType: 'Even' | 'Odd';
  /** Plot size e.g. 20*40 — required by backend */
  siteDimension: string;
  siteDimensionComment?: string;
  scheduleNorth?: string;
  scheduleSouth?: string;
  scheduleWest?: string;
  scheduleEast?: string;
  assignedEngineerUserId: string;
  /** When true, ZC saves as draft (not visible to engineer until submitted). */
  saveAsDraft?: boolean;
};

export type AddressDefaults = {
  city: string;
  state: string;
  cityLocked: boolean;
  stateLocked: boolean;
};

export type SiteDimensionOption = {
  id: string;
  label: string;
  code?: string;
};

/** Public master list for Site dimension dropdown (Even/Odd plot sizes). */
export async function fetchSiteDimensions(token?: string | null) {
  const raw = await apiRequest<{ items?: SiteDimensionOption[] } | SiteDimensionOption[]>(
    '/public/attributes?type=site_dimension&status=Active',
    { token: token ?? undefined },
  );
  const items = Array.isArray(raw) ? raw : raw.items ?? [];
  return items
    .map((row) => ({
      id: String((row as SiteDimensionOption).id ?? ''),
      label: String((row as SiteDimensionOption).label ?? '').trim(),
      code: (row as SiteDimensionOption).code,
    }))
    .filter((row) => row.label);
}

/** Create a new site dimension master row (authenticated). */
export async function createSiteDimension(
  token: string,
  label: string,
): Promise<SiteDimensionOption> {
  const normalized = label.trim().replace(/\s+/g, '');
  const code = `DIM-${normalized.replace(/\*/g, 'x').replace(/[^\w]/g, '')}`.slice(0, 50);
  const body = {
    type: 'site_dimension',
    label: normalized,
    code,
    status: 'Active',
  };

  let raw: unknown;
  try {
    raw = await apiRequest<unknown>('/applications/meta/site-dimensions', {
      method: 'POST',
      token,
      body: { label: normalized },
      skipErrorPage: true,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      raw = await apiRequest<unknown>('/masters/attributes', {
        method: 'POST',
        token,
        body,
      });
    } else {
      throw err;
    }
  }

  const row = asData<Record<string, unknown>>(raw);
  return {
    id: String(row.id ?? ''),
    label: String(row.label ?? normalized).trim(),
    code: row.code != null ? String(row.code) : code,
  };
}

function parseJsonField<T>(value: unknown): T | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return null;
    }
  }
  return value as T;
}

function normalizeStringArray(value: unknown): string[] | null {
  const parsed = parseJsonField<unknown>(value) ?? value;
  if (typeof parsed === 'string' && parsed.trim()) return [parsed.trim()];
  if (!Array.isArray(parsed)) return null;
  const urls = parsed.map((v) => String(v).trim()).filter(Boolean);
  return urls.length ? urls : null;
}

function normalizeStringRecord(value: unknown): Record<string, string> | null {
  const parsed = parseJsonField<unknown>(value) ?? value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
    if (val != null && String(val).trim()) out[key] = String(val);
  }
  return Object.keys(out).length ? out : null;
}

function normalizeHistory(value: unknown): ApplicationHistoryItem[] | null {
  const parsed = parseJsonField<unknown>(value) ?? value;
  if (!Array.isArray(parsed)) return null;
  return parsed.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id != null ? String(r.id) : undefined,
      taskName: String(r.taskName ?? ''),
      performedBy: String(r.performedBy ?? ''),
      sentTo: r.sentTo != null ? String(r.sentTo) : null,
      startedOn: r.startedOn != null ? String(r.startedOn) : null,
      completedOn: r.completedOn != null ? String(r.completedOn) : null,
      comments: r.comments != null ? String(r.comments) : null,
      statusBefore: r.statusBefore != null ? String(r.statusBefore) : null,
      statusAfter: r.statusAfter != null ? String(r.statusAfter) : null,
    };
  });
}

function normalizeApplication(raw: Record<string, unknown>): MobileApplication {
  const status =
    normalizeApplicationStatus(String(raw.status ?? '')) ?? ('assigned' as MobileApplicationStatus);

  return {
    id: String(raw.id ?? ''),
    applicationNumber: String(raw.applicationNumber ?? ''),
    eOfficeNumber: raw.eOfficeNumber != null ? String(raw.eOfficeNumber) : null,
    siteNo: String(raw.siteNo ?? ''),
    addressLine1: String(raw.addressLine1 ?? raw.addressArea ?? ''),
    addressLine2: raw.addressLine2 != null ? String(raw.addressLine2) : null,
    addressBlock: String(raw.addressBlock ?? ''),
    addressCity: String(raw.addressCity ?? ''),
    addressState: String(raw.addressState ?? ''),
    addressPincode: String(raw.addressPincode ?? ''),
    siteDimensionType:
      raw.siteDimensionType === 'Odd' || raw.siteDimensionType === 'Regular'
        ? (raw.siteDimensionType === 'Odd' ? 'Odd' : 'Even')
        : 'Even',
    siteDimension: raw.siteDimension != null ? String(raw.siteDimension) : null,
    siteDimensionComment:
      raw.siteDimensionComment != null ? String(raw.siteDimensionComment) : null,
    scheduleNorth: raw.scheduleNorth != null ? String(raw.scheduleNorth) : null,
    scheduleSouth: raw.scheduleSouth != null ? String(raw.scheduleSouth) : null,
    scheduleWest: raw.scheduleWest != null ? String(raw.scheduleWest) : null,
    scheduleEast: raw.scheduleEast != null ? String(raw.scheduleEast) : null,
    engineerScheduleNotes:
      normalizeStringRecord(raw.engineerScheduleNotes) as MobileApplication['engineerScheduleNotes'],
    scheduleRoadFlags: parseJsonField<MobileApplication['scheduleRoadFlags']>(
      raw.scheduleRoadFlags,
    ),
    engineerDimensions:
      normalizeStringRecord(raw.engineerDimensions) as MobileApplication['engineerDimensions'],
    zoneId: raw.zoneId != null ? Number(raw.zoneId) : undefined,
    zoneCode: String(raw.zoneCode ?? ''),
    status,
    createdByZcName: raw.createdByZcName != null ? String(raw.createdByZcName) : null,
    assignedEngineerName:
      raw.assignedEngineerName != null ? String(raw.assignedEngineerName) : null,
    assignedEngineerUserId:
      raw.assignedEngineerUserId != null ? String(raw.assignedEngineerUserId) : undefined,
    assignedEngineerLoginId:
      raw.assignedEngineerLoginId != null ? String(raw.assignedEngineerLoginId) : null,
    assignedEngineerProfilePhoto:
      raw.assignedEngineerProfilePhoto != null
        ? String(raw.assignedEngineerProfilePhoto)
        : null,
    assignedCaoName: raw.assignedCaoName != null ? String(raw.assignedCaoName) : null,
    engineerSiteDetails:
      raw.engineerSiteDetails != null ? String(raw.engineerSiteDetails) : null,
    compass: raw.compass != null ? String(raw.compass) : null,
    latitude: raw.latitude != null ? String(raw.latitude) : null,
    longitude: raw.longitude != null ? String(raw.longitude) : null,
    engineerGeoAddress: parseJsonField<MobileApplication['engineerGeoAddress']>(
      raw.engineerGeoAddress,
    ),
    occupancy:
      raw.occupancy === 'Empty' || raw.occupancy === 'Occupied' ? raw.occupancy : null,
    occupancyReason: raw.occupancyReason != null ? String(raw.occupancyReason) : null,
    dimNorth: raw.dimNorth != null ? String(raw.dimNorth) : null,
    dimSouth: raw.dimSouth != null ? String(raw.dimSouth) : null,
    dimEast: raw.dimEast != null ? String(raw.dimEast) : null,
    dimWest: raw.dimWest != null ? String(raw.dimWest) : null,
    totalSiteArea: raw.totalSiteArea != null ? String(raw.totalSiteArea) : null,
    selfieUrl: raw.selfieUrl != null ? String(raw.selfieUrl) : null,
    photoUrls: normalizeStringArray(raw.photoUrls),
    schedulePhotoUrls:
      normalizeStringRecord(raw.schedulePhotoUrls) as MobileApplication['schedulePhotoUrls'],
    videoUrl: raw.videoUrl != null ? String(raw.videoUrl) : null,
    engineerComments: raw.engineerComments != null ? String(raw.engineerComments) : null,
    engineerSubmittedAt:
      raw.engineerSubmittedAt != null ? String(raw.engineerSubmittedAt) : null,
    createdAt: raw.createdAt != null ? String(raw.createdAt) : null,
    updatedAt: raw.updatedAt != null ? String(raw.updatedAt) : null,
  };
}

async function fetchApplicationList(
  token: string,
  as: ApplicationAs,
  queue: 'open' | 'all' = 'all',
) {
  const qs = new URLSearchParams({ as });
  if (queue === 'open') qs.set('queue', 'open');
  const raw = await apiRequest<unknown>(`/applications?${qs.toString()}`, { token });
  return asList<Record<string, unknown>>(raw).map(normalizeApplication);
}

/** Active engineer work only (assigned / in progress). Submitted tasks are excluded. */
export function isOpenEngineerTask(app: MobileApplication): boolean {
  if (app.engineerSubmittedAt?.trim()) return false;
  const status = normalizeApplicationStatus(app.status) ?? app.status;
  return status === 'assigned' || status === 'in_progress';
}

/**
 * Engineer applications.
 * - `open` → home task list (hides submitted)
 * - `all` → Applications tab (full history for assigned engineer)
 */
function isVisibleToEngineer(app: MobileApplication): boolean {
  return normalizeApplicationStatus(app.status) !== 'draft';
}

export function fetchEngineerTasks(token: string, queue: 'open' | 'all' = 'open') {
  return fetchApplicationList(token, 'engineer', queue).then((apps) => {
    const visible = apps.filter(isVisibleToEngineer);
    return queue === 'open' ? visible.filter(isOpenEngineerTask) : visible;
  });
}

export function fetchZcApplications(token: string) {
  return fetchApplicationList(token, 'zc');
}

export function fetchCaoApplications(token: string) {
  return fetchApplicationList(token, 'cao').then((apps) =>
    apps.filter((a) => {
      // CAO only after engineer submit — hide assigned / in_progress.
      if (a.engineerSubmittedAt?.trim()) return true;
      return normalizeApplicationStatus(a.status) === 'submitted';
    }),
  );
}

export function fetchApplicationsAs(token: string, as: ApplicationAs) {
  return fetchApplicationList(token, as);
}

export function fetchMyZoneMeta(token: string) {
  return apiRequest<unknown>('/applications/meta/my-zone', { token }).then((raw) =>
    asData<MyZoneMeta>(raw),
  );
}

export function fetchAddressDefaults(token: string) {
  return apiRequest<unknown>('/applications/meta/address-defaults', { token }).then((raw) =>
    asData<AddressDefaults>(raw),
  );
}

export function fetchCaoCounts(token: string) {
  return apiRequest<unknown>('/applications/meta/cao-counts', { token }).then((raw) =>
    asData<CaoCounts>(raw),
  );
}

export function createApplication(token: string, body: CreateApplicationInput) {
  return apiRequest<unknown>('/applications', {
    method: 'POST',
    token,
    body,
  }).then((raw) => normalizeApplication(asData<Record<string, unknown>>(raw)));
}

export function updateZcDraftApplication(
  token: string,
  id: string,
  body: Omit<CreateApplicationInput, 'saveAsDraft'>,
) {
  return apiRequest<unknown>(`/applications/${id}/zc`, {
    method: 'PATCH',
    token,
    body,
  }).then((raw) => normalizeApplication(asData<Record<string, unknown>>(raw)));
}

export function submitZcDraftApplication(
  token: string,
  id: string,
  body: Omit<CreateApplicationInput, 'saveAsDraft'>,
) {
  return apiRequest<unknown>(`/applications/${id}/zc-submit`, {
    method: 'POST',
    token,
    body,
  }).then((raw) => normalizeApplication(asData<Record<string, unknown>>(raw)));
}

export function caoDecideApplication(
  token: string,
  id: string,
  kind: 'verify' | 'return' | 'reject',
  remarks?: string,
) {
  return apiRequest<MobileApplication>(`/applications/${id}/${kind}`, {
    method: 'POST',
    token,
    body: remarks ? { remarks } : {},
  });
}

export function fetchApplication(
  token: string,
  id: string,
  options?: { skipErrorPage?: boolean },
) {
  return apiRequest<unknown>(`/applications/${id}`, {
    token,
    skipErrorPage: options?.skipErrorPage,
  }).then((raw) => normalizeApplication(asData<Record<string, unknown>>(raw)));
}

export function formatApplicationDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB');
}

export function countZcBuckets(apps: MobileApplication[]) {
  return {
    draft: apps.filter((a) => normalizeApplicationStatus(a.status) === 'draft').length,
    assigned: apps.filter((a) => normalizeApplicationStatus(a.status) === 'assigned').length,
    in_progress: apps.filter((a) => normalizeApplicationStatus(a.status) === 'in_progress')
      .length,
    submitted: apps.filter((a) => normalizeApplicationStatus(a.status) === 'submitted').length,
    total: apps.length,
  };
}

export function startApplicationTask(token: string, id: string) {
  return apiRequest<MobileApplication>(`/applications/${id}/start`, {
    method: 'PATCH',
    token,
  });
}

/** Partial engineer capture — each step / schedule edit. */
export type EngineerDraftInput = {
  engineerSiteDetails?: string;
  compass?: string;
  latitude?: string;
  longitude?: string;
  engineerGeoAddress?: MobileApplication['engineerGeoAddress'];
  occupancy?: 'Empty' | 'Occupied';
  occupancyReason?: string;
  dimNorth?: string;
  dimSouth?: string;
  dimEast?: string;
  dimWest?: string;
  /** Preferred engineer dims (separate from ZC siteDimension). */
  engineerDimensions?: Partial<Record<'N' | 'S' | 'E' | 'W', string>>;
  totalSiteArea?: string;
  selfieUrl?: string;
  photoUrls?: string[];
  schedulePhotoUrls?: Partial<Record<'N' | 'S' | 'E' | 'W', string>>;
  engineerScheduleNotes?: Partial<Record<'N' | 'S' | 'E' | 'W', string>>;
  scheduleRoadFlags?: Partial<Record<'N' | 'S' | 'E' | 'W', boolean>>;
  videoUrl?: string;
  engineerComments?: string;
};

export function saveEngineerDraft(
  token: string,
  id: string,
  body: EngineerDraftInput,
) {
  return apiRequest<MobileApplication>(`/applications/${id}/draft`, {
    method: 'PATCH',
    token,
    body,
    // Callers show a dialog; do not replace the survey with the full-page 500 screen.
    skipErrorPage: true,
  });
}

export function submitEngineerApplication(
  token: string,
  id: string,
  body: Record<string, unknown>,
) {
  return apiRequest<MobileApplication>(`/applications/${id}/submit`, {
    method: 'POST',
    token,
    body,
  });
}

export type MobileApplicationStatus =
  | 'draft'
  | 'assigned'
  | 'in_progress'
  | 'submitted';

export function applicationStatusLabel(status: MobileApplicationStatus) {
  if (status === 'draft') return 'Draft';
  if (status === 'assigned') return 'Assigned';
  if (status === 'in_progress') return 'In progress';
  if (status === 'submitted') return 'Submitted';
  return status;
}

/** Engineer home / applications list label — includes returned & verified from raw API status. */
export function engineerApplicationListStatus(app: MobileApplication): string {
  const raw = String(app.status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (app.engineerSubmittedAt?.trim()) return 'Submitted';
  if (raw === 'returned') return 'Returned';
  if (raw === 'verified' || raw === 'approved') return 'Verified';
  if (raw === 'rejected') return 'Rejected';
  const normalized = normalizeApplicationStatus(app.status);
  if (normalized === 'draft') return 'Assigned';
  if (normalized === 'in_progress') return 'In progress';
  if (normalized === 'submitted') return 'Submitted';
  return 'Assigned';
}

export type EngineerDashboardFilter = 'all' | 'assigned' | 'in_progress' | 'submitted';

/** Home dashboard bucket — matches engineerApplicationListStatus for Assigned / In progress / Submitted. */
export function engineerDashboardBucket(
  app: MobileApplication,
): Exclude<EngineerDashboardFilter, 'all'> | null {
  const status = engineerApplicationListStatus(app);
  if (status === 'Assigned') return 'assigned';
  if (status === 'In progress') return 'in_progress';
  if (status === 'Submitted') return 'submitted';
  return null;
}

export function countEngineerDashboardBuckets(apps: MobileApplication[]) {
  let assigned = 0;
  let inProgress = 0;
  let submitted = 0;
  for (const app of apps) {
    const bucket = engineerDashboardBucket(app);
    if (bucket === 'assigned') assigned += 1;
    else if (bucket === 'in_progress') inProgress += 1;
    else if (bucket === 'submitted') submitted += 1;
  }
  return {
    all: apps.length,
    assigned,
    in_progress: inProgress,
    submitted,
  };
}

export function filterEngineerDashboardApps(
  apps: MobileApplication[],
  filter: EngineerDashboardFilter,
) {
  if (filter === 'all') return apps;
  return apps.filter((app) => engineerDashboardBucket(app) === filter);
}

export type EngineerReviewBadgeTone = 'success' | 'warning' | 'info' | 'default';

/** Review & Submit header badge — aligned with engineer application list statuses. */
export function engineerReviewStatusBadge(draft: {
  status: string;
  backendApplicationId: string | null;
  backendStatus: MobileApplicationStatus | null;
}): { label: string; tone: EngineerReviewBadgeTone } {
  if (draft.status === 'submitted') {
    return { label: 'SUBMITTED', tone: 'success' };
  }
  if (draft.backendApplicationId && draft.backendStatus) {
    const listStatus = engineerApplicationListStatus({
      status: draft.backendStatus,
    } as MobileApplication);
    if (listStatus === 'In progress') return { label: 'IN PROGRESS', tone: 'info' };
    if (listStatus === 'Assigned') return { label: 'ASSIGNED', tone: 'warning' };
    if (listStatus === 'Submitted') return { label: 'SUBMITTED', tone: 'success' };
    if (listStatus === 'Returned') return { label: 'RETURNED', tone: 'warning' };
    if (listStatus === 'Verified') return { label: 'VERIFIED', tone: 'success' };
    if (listStatus === 'Rejected') return { label: 'REJECTED', tone: 'warning' };
  }
  return { label: 'IN PROGRESS', tone: 'info' };
}

function hasEngineerDimensions(app: MobileApplication): boolean {
  const flat = [app.dimNorth, app.dimSouth, app.dimEast, app.dimWest].every((d) =>
    Boolean(d?.trim()),
  );
  if (flat) return true;
  const ed = app.engineerDimensions;
  if (!ed) return false;
  return Boolean(ed.N?.trim() && ed.S?.trim() && ed.E?.trim() && ed.W?.trim());
}

/** Marker saved when engineer taps Continue on ZC details (step 1). */
export const ENGINEER_SITE_STEP_ACK = 'reviewed';

export function engineerFacingStepDone(app: MobileApplication): boolean {
  return Boolean(app.compass?.trim() && app.latitude?.trim() && app.longitude?.trim());
}

export function engineerDimsStepDone(app: MobileApplication): boolean {
  return hasEngineerDimensions(app);
}

export function engineerMediaStepDone(app: MobileApplication): boolean {
  return Boolean(app.selfieUrl?.trim());
}

/**
 * Step 1 is done only after Continue on ZC details (persisted site ack),
 * or when a later step already has saved data (resume / legacy drafts).
 */
export function engineerSiteStepDone(app: MobileApplication): boolean {
  return (
    Boolean(app.engineerSiteDetails?.trim()) ||
    engineerFacingStepDone(app) ||
    engineerDimsStepDone(app) ||
    engineerMediaStepDone(app)
  );
}

/**
 * Resume screen for edit / continue — first incomplete step in the 4-step flow.
 */
export function engineerResumeScreen(
  app: MobileApplication,
): 'project' | 'bandi' | 'dimensions' | 'photos' {
  if (!engineerSiteStepDone(app)) return 'project';
  if (!engineerFacingStepDone(app)) return 'bandi';
  if (!engineerDimsStepDone(app)) return 'dimensions';
  return 'photos';
}

/**
 * Progress increases only after each Continue (saved step data), not on open.
 * Caps at 75% until the task is fully submitted (then 100%).
 */
export function engineerTaskProgressPercent(app: MobileApplication): number {
  const status = normalizeApplicationStatus(app.status) ?? app.status;
  if (status === 'submitted' || Boolean(app.engineerSubmittedAt?.trim())) return 100;

  let completed = 0;
  if (engineerSiteStepDone(app)) completed += 1;
  if (engineerFacingStepDone(app)) completed += 1;
  if (engineerDimsStepDone(app)) completed += 1;
  if (engineerMediaStepDone(app)) completed += 1;

  // Never show 100% before submit — media Continue alone stays at 75%.
  return Math.min(75, Math.round((completed / 4) * 100));
}

/** Assigned / submitted / in-progress timestamps for cards and detail views. */
export function formatApplicationDateTime(iso?: string | null): string {
  if (!iso?.trim()) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Date/time line for application cards (no status prefix — badge already shows status).
 * - submitted → engineerSubmittedAt
 * - in_progress → updatedAt || createdAt
 * - assigned → createdAt
 */
export function applicationCardDateLine(app: MobileApplication): string {
  const status = normalizeApplicationStatus(app.status) ?? app.status;
  if (status === 'submitted' || Boolean(app.engineerSubmittedAt?.trim())) {
    return formatApplicationDateTime(app.engineerSubmittedAt);
  }
  if (status === 'in_progress') {
    return formatApplicationDateTime(app.updatedAt || app.createdAt);
  }
  return formatApplicationDateTime(app.createdAt);
}

export type ApplicationStatusTone = {
  bg: string;
  fg: string;
  bar: string;
  border: string;
};

/**
 * Canonical status colors for every role (ZC / Engineer / CAO):
 * Assigned = sky blue · In progress = orange · Submitted = green · Draft = slate
 */
export function applicationStatusTone(
  status: MobileApplicationStatus | string | null | undefined,
): ApplicationStatusTone {
  const raw = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (raw === 'draft') {
    return { bg: '#F1F5F9', fg: '#475569', bar: '#64748B', border: '#CBD5E1' };
  }
  if (raw === 'assigned') {
    return { bg: '#E0F2FE', fg: '#0369A1', bar: '#0EA5E9', border: '#BAE6FD' };
  }
  if (raw === 'in_progress' || raw === 'inprogress' || raw === 'in-progress') {
    return { bg: '#FFEDD5', fg: '#C2410C', bar: '#F97316', border: '#FED7AA' };
  }
  if (raw === 'submitted' || raw === 'pending_cao' || raw === 'pending') {
    return { bg: '#D1FAE5', fg: '#047857', bar: '#059669', border: '#A7F3D0' };
  }
  if (raw === 'verified' || raw === 'approved') {
    return { bg: '#D1FAE5', fg: '#047857', bar: '#059669', border: '#A7F3D0' };
  }
  if (raw === 'returned' || raw === 'send_back' || raw === 'sendback') {
    return { bg: '#FFEDD5', fg: '#C2410C', bar: '#F97316', border: '#FED7AA' };
  }
  if (raw === 'rejected') {
    return { bg: '#FFE4E6', fg: '#BE123C', bar: '#F43F5E', border: '#FECDD3' };
  }
  return { bg: '#F8FAFC', fg: '#334155', bar: '#64748B', border: '#E2E8F0' };
}

export function normalizeApplicationStatus(
  status: string | null | undefined,
): MobileApplicationStatus | null {
  const raw = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (raw === 'draft') return 'draft';
  if (raw === 'assigned') return 'assigned';
  if (raw === 'in_progress' || raw === 'inprogress') return 'in_progress';
  if (
    raw === 'submitted' ||
    raw === 'pending' ||
    raw === 'pending_cao' ||
    raw === 'verified' ||
    raw === 'returned' ||
    raw === 'rejected'
  ) {
    return 'submitted';
  }
  return null;
}

export function applicationStatusDisplayLabel(status: string | null | undefined) {
  const key = normalizeApplicationStatus(status);
  if (key) return applicationStatusLabel(key);
  return String(status || '—');
}
