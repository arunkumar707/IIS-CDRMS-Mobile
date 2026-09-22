import { normalizeApplicationStatus, type MobileApplication } from '@/src/api/applications';
import {
  createEmptyDraft,
  type MediaAsset,
  type ProjectDraft,
} from '@/src/cdrms/project/types';

function remoteAsset(
  uri: string,
  type: 'image' | 'video',
  id: string,
  now: number,
): MediaAsset {
  return { id, uri, type, createdAt: now };
}

const EMPTY_DIMS = { N: '', S: '', E: '', W: '' } as const;

/**
 * Engineer N/S/E/W only.
 * Keep saved measurements even when they match ZC siteDimension (e.g. 30*40).
 * Do not copy ZC siteDimension into empty fields.
 */
function engineerDimsFromApp(app: MobileApplication): {
  N: string;
  S: string;
  E: string;
  W: string;
} {
  const eng = app.engineerDimensions;
  if (!eng || !(eng.N || eng.S || eng.E || eng.W)) {
    return { ...EMPTY_DIMS };
  }
  return {
    N: String(eng.N || '').trim(),
    S: String(eng.S || '').trim(),
    E: String(eng.E || '').trim(),
    W: String(eng.W || '').trim(),
  };
}

/** Seed a survey draft from a ZC-assigned backend application (incl. saved draft media). */
export function draftFromBackendApplication(app: MobileApplication): ProjectDraft {
  const now = Date.now();
  const base = createEmptyDraft();
  const address = [
    app.addressLine1,
    app.addressLine2,
    app.addressBlock,
    app.addressCity,
    app.addressState,
    app.addressPincode,
  ]
    .filter(Boolean)
    .join(', ');

  let selfie: MediaAsset | null = null;
  if (app.selfieUrl) {
    selfie = remoteAsset(app.selfieUrl, 'image', `selfie-${app.id}`, now);
  }

  const photos: MediaAsset[] = [];
  for (let i = 0; i < (app.photoUrls?.length ?? 0) && i < 4; i += 1) {
    const url = app.photoUrls![i];
    if (url) photos.push(remoteAsset(url, 'image', `photo-${app.id}-${i}`, now));
  }

  const surroundingPhotos: ProjectDraft['surroundingPhotos'] = {};
  for (const k of ['N', 'S', 'E', 'W'] as const) {
    const url = app.schedulePhotoUrls?.[k];
    if (url) {
      surroundingPhotos[k] = remoteAsset(url, 'image', `sched-${k}-${app.id}`, now);
    }
  }

  return {
    ...base,
    id: `BE-${app.id.slice(0, 8)}`,
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    applicationId: app.applicationNumber,
    backendApplicationId: app.id,
    applicationNumber: app.applicationNumber,
    eOfficeNumber: app.eOfficeNumber?.trim() || '',
    siteNo: app.siteNo,
    addressLine1: app.addressLine1,
    addressLine2: app.addressLine2 || '',
    addressBlock: app.addressBlock,
    addressCity: app.addressCity || '',
    addressState: app.addressState || '',
    addressPincode: app.addressPincode,
    zoneCode: app.zoneCode,
    createdByZcName: app.createdByZcName || '',
    assignedEngineerName: app.assignedEngineerName || '',
    backendAssignedAt: app.createdAt || null,
    backendStatus: normalizeApplicationStatus(app.status) ?? app.status,
    siteDimensionType: app.siteDimensionType === 'Odd' ? 'Odd' : 'Even',
    siteDimensionMaster: app.siteDimension || '',
    siteDimensionComment: app.siteDimensionComment || '',
    siteDetails: app.engineerSiteDetails || '',
    compassReading: app.compass || '',
    occupancy: app.occupancy === 'Occupied' ? 'Occupied' : 'Empty',
    occupancyReason: app.occupancyReason || '',
    engineerComments: app.engineerComments || '',
    ...((() => {
      const d = engineerDimsFromApp(app);
      return {
        dimNorth: d.N,
        dimSouth: d.S,
        dimEast: d.E,
        dimWest: d.W,
      };
    })()),
    projectName: app.applicationNumber,
    khatedarName: app.createdByZcName || '',
    surveyNo: app.siteNo,
    plotNo: app.siteNo,
    // Do NOT copy ZC siteDimension into dimensionArea — that used to prefill Step 3.
    dimensionArea: '',
    village: app.addressLine1 || '',
    taluk: app.addressBlock || '',
    district: address,
    state: app.addressState || 'Karnataka',
    gps:
      app.latitude && app.longitude
        ? {
            latitude: Number(app.latitude),
            longitude: Number(app.longitude),
            accuracy:
              typeof app.engineerGeoAddress?.accuracy === 'number'
                ? app.engineerGeoAddress.accuracy
                : null,
            altitude: null,
            timestamp: now,
          }
        : null,
    geoAddress: app.engineerGeoAddress
      ? {
          displayName: app.engineerGeoAddress.displayName || '',
          village: app.engineerGeoAddress.village || app.addressLine1 || '',
          taluk: app.engineerGeoAddress.taluk || app.addressBlock || '',
          district: app.engineerGeoAddress.district || app.addressCity || '',
          state: app.engineerGeoAddress.state || app.addressState || 'Karnataka',
          street: app.engineerGeoAddress.street,
          name: app.engineerGeoAddress.name,
          layoutName: app.engineerGeoAddress.layoutName,
          area: app.engineerGeoAddress.area,
          block: app.engineerGeoAddress.block,
          postalCode: app.engineerGeoAddress.postalCode,
          country: app.engineerGeoAddress.country,
          accuracy:
            typeof app.engineerGeoAddress.accuracy === 'number'
              ? app.engineerGeoAddress.accuracy
              : null,
        }
      : null,
    directions: {
      N: app.engineerScheduleNotes?.N || '',
      S: app.engineerScheduleNotes?.S || '',
      E: app.engineerScheduleNotes?.E || '',
      W: app.engineerScheduleNotes?.W || '',
    },
    zcDirections: {
      N: app.scheduleNorth || '',
      S: app.scheduleSouth || '',
      E: app.scheduleEast || '',
      W: app.scheduleWest || '',
    },
    roadFlags: {
      N: Boolean(app.scheduleRoadFlags?.N),
      S: Boolean(app.scheduleRoadFlags?.S),
      E: Boolean(app.scheduleRoadFlags?.E),
      W: Boolean(app.scheduleRoadFlags?.W),
    },
    surroundingPhotos,
    photos,
    selfie,
    video: app.videoUrl
      ? remoteAsset(app.videoUrl, 'video', `video-${app.id}`, now)
      : null,
    approachNotes: app.siteDimensionComment || '',
    resubmitOfId: null,
  };
}
