import * as FileSystem from 'expo-file-system/legacy';
import { Linking, Platform } from 'react-native';

import {
  applicationStatusDisplayLabel,
  applicationStatusTone,
  fetchApplication,
  type MobileApplication,
} from '@/src/api/applications';
import { API_BASE_URL } from '@/src/api/config';
import { buildSiteDimensionPlotSvg } from '@/src/cdrms/lib/buildSiteDimensionPlotSvg';
import { deriveSiteTypeFromDims, resolveBoundaryDims } from '@/src/cdrms/lib/resolveBoundaryDims';
import type { PdfDownloadProgressHandler } from '@/src/cdrms/lib/pdfDownloadProgress';
import { fetchAuthenticatedMediaBlob } from '@/src/cdrms/media/displayUri';
import { downloadPdfInBrowser } from '@/src/cdrms/lib/pdfBrowserDownload';
import { BDA_LOGO_BASE64 } from './bdaLogoBase64';

export type PdfDownloadResult = {
  fileName: string;
  savedPath: string;
  message: string;
  openUri?: string;
  fileSizeBytes?: number;
};

/** Share a downloaded PDF file on the device using native share sheet */
export async function sharePdfFile(targetUri: string) {
  if (!targetUri) return;
  try {
    try {
      const Sharing = require('expo-sharing') as typeof import('expo-sharing');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(targetUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share PDF',
          UTI: 'com.adobe.pdf',
        });
        return;
      }
    } catch {
      // Native ExpoSharing not in this iOS binary yet
    }
    await Linking.openURL(targetUri);
  } catch (err) {
    console.log('Could not share PDF file:', err);
  }
}

export const openPdfFile = sharePdfFile;

function escapeHtml(value: string) {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(value?: string | number | null) {
  if (value == null || value === '') return '—';
  return escapeHtml(String(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
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

function isRoadSide(app: MobileApplication, side: 'N' | 'S' | 'E' | 'W') {
  const flags = app.scheduleRoadFlags || {};
  return Boolean(flags[side] ?? flags[side.toLowerCase()]);
}

/** Engineer plot labels (notes + road checkbox only — never ZC schedule text). */
function diagramSchedule(app: MobileApplication, side: 'N' | 'S' | 'E' | 'W') {
  const engNotes = app.engineerScheduleNotes || {};
  const eng = engNotes[side]?.trim() || engNotes[side.toLowerCase()]?.trim() || '';
  const road = isRoadSide(app, side);
  if (road && eng) return `Road · ${eng}`;
  if (road) return 'Road';
  return eng || null;
}

function isVideoMedia(url: string) {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url) || /\/video/i.test(url);
}

function resolveFullMediaDownloadUrl(uri: string): string {
  if (!uri?.trim()) return '';
  const trimmed = uri.trim();
  if (trimmed.startsWith('file://') || trimmed.startsWith('data:')) return trimmed;
  return `${API_BASE_URL}/object-store/view-by-url?url=${encodeURIComponent(trimmed)}`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string' && result.startsWith('data:')) {
        resolve(result);
        return;
      }
      reject(new Error('Could not read image'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image'));
    reader.readAsDataURL(blob);
  });
}

async function fetchImageAsBase64(url: string, token: string): Promise<string | null> {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/')) return trimmed;

  if (trimmed.startsWith('file://')) {
    try {
      const b64 = await FileSystem.readAsStringAsync(trimmed, { encoding: 'base64' });
      const mime = trimmed.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      return `data:${mime};base64,${b64}`;
    } catch {
      return null;
    }
  }

  try {
    if (Platform.OS === 'web') {
      const blob = await fetchAuthenticatedMediaBlob(trimmed, token);
      if (blob.size < 100) return null;
      return await blobToDataUrl(blob);
    }

    const downloadUrl = resolveFullMediaDownloadUrl(trimmed);
    const tempFile = `${FileSystem.cacheDirectory}pdf_img_${Date.now()}_${Math.random().toString(36).substring(7)}.tmp`;
    const downloadRes = await FileSystem.downloadAsync(downloadUrl, tempFile, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (downloadRes?.status >= 200 && downloadRes.status < 300 && downloadRes.uri) {
      const info = await FileSystem.getInfoAsync(downloadRes.uri);
      if (info.exists && 'size' in info && (info.size ?? 0) > 100) {
        const b64 = await FileSystem.readAsStringAsync(downloadRes.uri, { encoding: 'base64' });
        await FileSystem.deleteAsync(downloadRes.uri, { idempotent: true }).catch(() => undefined);
        const mime = trimmed.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        return `data:${mime};base64,${b64}`;
      }
    }
  } catch (e) {
    console.log('PDF photo download error for:', trimmed, e);
  }
  return null;
}

function paint(bg: string) {
  return `background:${bg};box-shadow:inset 0 0 0 1000px ${bg};-webkit-print-color-adjust:exact;print-color-adjust:exact;`;
}

function statusBadgeHtml(status: string | null | undefined) {
  const label = applicationStatusDisplayLabel(status);
  const tone = applicationStatusTone(status);
  return `<span style="display:inline-block;${paint(tone.bg)}color:${tone.fg};border:1px solid ${tone.border};padding:2px 8px;border-radius:999px;font-size:8.5px;font-weight:bold;letter-spacing:0.2px;">${escapeHtml(label)}</span>`;
}

function siteTypeBadgeHtml(type: string | null | undefined) {
  if (!type?.trim() || type === '—') return fmt(null);
  const odd = type === 'Odd';
  const bg = odd ? '#FFE4E6' : '#D1FAE5';
  const fg = odd ? '#BE123C' : '#047857';
  const border = odd ? '#FDA4AF' : '#A7F3D0';
  return `<span style="display:inline-block;${paint(bg)}color:${fg};border:1px solid ${border};padding:2px 8px;border-radius:8px;font-size:9px;font-weight:bold;">${escapeHtml(odd ? 'Odd' : 'Even')}</span>`;
}

function cardOpen(title: string, status?: string | null) {
  const badge = status ? statusBadgeHtml(status) : '';
  return `<table width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #cbd5e1;margin:0 0 8px;${paint('#ffffff')}border-radius:6px;overflow:hidden;">
    <tr><td style="${paint('#dbeafe')}color:#1e3a8a;font-size:11px;font-weight:bold;padding:7px 10px;border-bottom:1px solid #bfdbfe;">
      <table width="100%" cellspacing="0" cellpadding="0"><tr>
        <td style="vertical-align:middle;">${escapeHtml(title)}</td>
        <td style="text-align:right;vertical-align:middle;width:120px;">${badge}</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:0;">
      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">`;
}

function cardClose() {
  return `</table></td></tr></table>`;
}

function formRowPair(a: [string, string], b?: [string, string]) {
  const cellL =
    `width:20%;${paint('#f8fafc')}color:#1e3a8a;font-weight:600;font-size:8.5px;border-top:1px solid #e2e8f0;padding:5px 7px;vertical-align:top;letter-spacing:0.2px;`;
  const cellV =
    `width:30%;${paint('#ffffff')}color:#0f172a;font-size:9.5px;font-weight:700;border-top:1px solid #e2e8f0;padding:5px 7px;vertical-align:top;line-height:1.35;`;
  if (b) {
    return `<tr>
      <td style="${cellL}">${escapeHtml(a[0])}</td><td style="${cellV}">${a[1]}</td>
      <td style="${cellL}">${escapeHtml(b[0])}</td><td style="${cellV}">${b[1]}</td>
    </tr>`;
  }
  return `<tr><td style="${cellL}">${escapeHtml(a[0])}</td><td style="${cellV}" colspan="3">${a[1]}</td></tr>`;
}

function sectionSubHeader(title: string) {
  return `
    <tr>
      <td colspan="4" style="${paint('#dbeafe')}color:#1e3a8a;font-size:9.5px;font-weight:bold;padding:6px 8px;border-top:1px solid #93c5fd;border-bottom:1px solid #bfdbfe;text-transform:uppercase;letter-spacing:0.4px;page-break-after:avoid;break-after:avoid;">
        ${escapeHtml(title)}
      </td>
    </tr>
  `;
}

function compactPlotSvgForPdf(svg: string) {
  // Tall enough to fill page 1 under Dimensions; Comments still start on page 2.
  return svg.replace(/height="(?:340|220|128)"/g, 'height="176"');
}

function zcFormTable(app: MobileApplication) {
  const eOfficeRow = `
    <tr>
      <td colspan="4" style="padding:8px 10px;${paint('#dbeafe')}border-bottom:1px solid #bfdbfe;">
        <table width="100%" cellspacing="0" cellpadding="0"><tr>
          <td style="color:#1e3a8a;font-weight:bold;font-size:8.5px;text-transform:uppercase;letter-spacing:0.3px;">E-office number</td>
          <td style="text-align:right;color:#0f172a;font-weight:bold;font-size:11px;">${fmt(app.eOfficeNumber)}</td>
        </tr></table>
      </td>
    </tr>
  `;

  const zcCommentsBlock = app.siteDimensionComment?.trim()
    ? `
      ${sectionSubHeader('ZC comments')}
      <tr><td colspan="4" style="padding:8px 10px;color:#0f172a;font-size:9.5px;font-weight:600;line-height:1.4;border-top:1px solid #e2e8f0;">${fmt(app.siteDimensionComment)}</td></tr>
    `
    : '';

  return `
    ${cardOpen('Application Details', app.status)}
      ${eOfficeRow}
      ${formRowPair(['Application no', fmt(app.applicationNumber)])}
      ${formRowPair(['Site no', fmt(app.siteNo)], ['Site type', fmt(app.siteDimensionType)])}
      ${formRowPair(['Site dimension', fmt(app.siteDimension)], ['Zone', fmt(app.zoneCode)])}
      ${formRowPair(['Address line 1', fmt(app.addressLine1)])}
      ${formRowPair(['Address line 2', fmt(app.addressLine2)])}
      ${formRowPair(['Block', fmt(app.addressBlock)], ['City', fmt(app.addressCity)])}
      ${formRowPair(['State', fmt(app.addressState)], ['Pincode', fmt(app.addressPincode)])}
      ${formRowPair(['Created by ZC', fmt(app.createdByZcName)], ['Assigned on', fmt(formatDateTime(app.createdAt))])}
      ${formRowPair(['Assigned engineer', fmt(app.assignedEngineerName)])}
      ${sectionSubHeader('Site Schedules')}
      ${formRowPair(['North', fmt(app.scheduleNorth)], ['South', fmt(app.scheduleSouth)])}
      ${formRowPair(['West', fmt(app.scheduleWest)], ['East', fmt(app.scheduleEast)])}
      ${zcCommentsBlock}
    ${cardClose()}
  `;
}

function engineerScheduleDisplay(app: MobileApplication, side: 'N' | 'S' | 'E' | 'W'): string {
  const engNotes = app.engineerScheduleNotes || {};
  const note = engNotes[side]?.trim() || engNotes[side.toLowerCase()]?.trim() || '';
  const road = isRoadSide(app, side);
  if (road && note) return `Road · ${note}`;
  if (road) return 'Road';
  return note || '—';
}

function formatEngineerMeasuredDimension(dims: {
  north: number;
  south: number;
  east: number;
  west: number;
}): string {
  const parts = [dims.north, dims.south, dims.east, dims.west].map((n) =>
    Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))),
  );
  return parts.join(' × ');
}

function engineerBlock(app: MobileApplication) {
  const boundary = resolveBoundaryDims(app);
  const hasEngineerDims = boundary.source === 'engineer' && boundary.dims != null;
  const engineerDims = hasEngineerDims ? boundary.dims! : null;

  const measuredType = engineerDims
    ? deriveSiteTypeFromDims(
        engineerDims.north,
        engineerDims.south,
        engineerDims.east,
        engineerDims.west,
      )
    : null;

  const svgXml =
    engineerDims &&
    buildSiteDimensionPlotSvg({
      north: engineerDims.north,
      south: engineerDims.south,
      east: engineerDims.east,
      west: engineerDims.west,
      odd: measuredType === 'Odd',
      siteNo: app.siteNo,
      totalArea: boundary.total,
      scheduleNorth: diagramSchedule(app, 'N'),
      scheduleSouth: diagramSchedule(app, 'S'),
      scheduleEast: diagramSchedule(app, 'E'),
      scheduleWest: diagramSchedule(app, 'W'),
      roadNorth: isRoadSide(app, 'N'),
      roadSouth: isRoadSide(app, 'S'),
      roadEast: isRoadSide(app, 'E'),
      roadWest: isRoadSide(app, 'W'),
    });

  const cleanSvg = svgXml
    ? compactPlotSvgForPdf(svgXml.replace(/<div class="plot-footer">[\s\S]*?<\/div>\s*$/, ''))
    : '';
  const areaSqFt = app.totalSiteArea ? Number(app.totalSiteArea) : null;
  const areaSqM = areaSqFt ? (areaSqFt * 0.092903).toFixed(2) : null;
  const totalAreaLabel = areaSqFt
    ? `${areaSqFt.toFixed(2)} Sq.Ft${areaSqM ? ` (${areaSqM} Sq.M)` : ''}`
    : null;
  const measuredDimensionLabel = engineerDims
    ? formatEngineerMeasuredDimension(engineerDims)
    : null;
  const occupancyReasonRow =
    app.occupancy === 'Occupied'
      ? formRowPair(['Occupancy reason', fmt(app.occupancyReason)])
      : '';
  const geoAreaLine = [
    app.engineerGeoAddress?.area,
    app.engineerGeoAddress?.block,
    app.engineerGeoAddress?.district,
    app.engineerGeoAddress?.state,
    app.engineerGeoAddress?.postalCode,
  ]
    .filter(Boolean)
    .join(' · ');
  const commentsBlock = app.engineerComments?.trim()
    ? `
      <tbody class="pdf-comments-block">
      ${sectionSubHeader('Comments')}
      <tr><td colspan="4" style="padding:8px 10px;color:#0f172a;font-size:9.5px;font-weight:600;line-height:1.4;border-top:1px solid #e2e8f0;">${fmt(app.engineerComments)}</td></tr>
      </tbody>
    `
    : '';

  const dimSideBySideHtml = `
    <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#ffffff;">
      <tr>
        <td style="width:42%;vertical-align:top;text-align:center;padding:4px 6px;border-right:1px solid #e2e8f0;background:#ffffff;">
          ${
            cleanSvg
              ? `<div style="width:100%;max-width:220px;height:176px;margin:0 auto;overflow:hidden;">${cleanSvg}</div>`
              : '<div style="font-size:8.5px;color:#94a3b8;font-style:italic;padding:8px 0;">No plot diagram</div>'
          }
        </td>
        <td style="width:58%;vertical-align:top;padding:0;background:#ffffff;">
          <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            ${
              engineerDims
                ? `${formRowPair(
                    ['Dim North', fmt(engineerDims.north)],
                    ['Dim South', fmt(engineerDims.south)],
                  )}${formRowPair(
                    ['Dim East', fmt(engineerDims.east)],
                    ['Dim West', fmt(engineerDims.west)],
                  )}`
                : formRowPair(['Measured dimensions', fmt(null)])
            }
          </table>
          ${
            areaSqFt
              ? `
            <div style="margin:4px 6px 6px;padding:4px 7px;${paint('#fefce8')}border:1px solid #fef08a;border-radius:4px;color:#854d0e;font-size:8.5px;font-weight:bold;text-align:center;">
              TOTAL AREA: ${areaSqFt.toFixed(2)} Sq.Ft ${areaSqM ? `(${areaSqM} Sq.M)` : ''}
            </div>
          `
              : ''
          }
        </td>
      </tr>
    </table>
  `;

  const dimensionsBlock = hasEngineerDims
    ? `
      <tbody class="pdf-dim-block">
      ${sectionSubHeader('Dimensions')}
      ${formRowPair(
        ['Measured site type', siteTypeBadgeHtml(measuredType)],
        ['Total area', fmt(totalAreaLabel)],
      )}
      ${formRowPair(['Measured site dimension', fmt(measuredDimensionLabel)])}
      <tr>
        <td colspan="4" style="padding:0;background:#ffffff;border-top:1px solid #e2e8f0;page-break-before:avoid;break-before:avoid;">
          ${dimSideBySideHtml}
        </td>
      </tr>
      </tbody>
  `
    : '';

  return `
    ${cardOpen('Engineer details', app.status)}
      ${formRowPair(['Assigned on', fmt(formatDateTime(app.createdAt))], ['Submitted on', fmt(formatDateTime(app.engineerSubmittedAt))])}

      ${sectionSubHeader('Boundary capture')}
      ${formRowPair(['North', fmt(engineerScheduleDisplay(app, 'N'))], ['South', fmt(engineerScheduleDisplay(app, 'S'))])}
      ${formRowPair(['West', fmt(engineerScheduleDisplay(app, 'W'))], ['East', fmt(engineerScheduleDisplay(app, 'E'))])}

      ${sectionSubHeader('Compass & GPS')}
      ${formRowPair(['Compass', fmt(app.compass)], ['Occupancy', fmt(app.occupancy)])}
      ${occupancyReasonRow}
      ${formRowPair([
        'Location',
        fmt(
          app.engineerGeoAddress?.displayName ||
            app.engineerGeoAddress?.village ||
            null,
        ),
      ])}
      ${geoAreaLine ? formRowPair(['Area', fmt(geoAreaLine)]) : ''}
      ${formRowPair(['Latitude', fmt(app.latitude)], ['Longitude', fmt(app.longitude)])}

      ${dimensionsBlock}
      ${commentsBlock}
    ${cardClose()}
  `;
}

async function photosMediaBlock(app: MobileApplication, token: string): Promise<string> {
  type PhotoEntry = { label: string; url: string };
  const rawEntries: PhotoEntry[] = [];

  if (app.selfieUrl?.trim() && !isVideoMedia(app.selfieUrl)) {
    rawEntries.push({ label: 'Engineer Live Selfie', url: app.selfieUrl.trim() });
  }

  const raw = app.schedulePhotoUrls ?? {};
  const schedule = {
    N: raw.N || raw.n || '',
    S: raw.S || raw.s || '',
    E: raw.E || raw.e || '',
    W: raw.W || raw.w || '',
  };

  if (schedule.N?.trim() && !isVideoMedia(schedule.N)) {
    rawEntries.push({ label: 'North Boundary Photo', url: schedule.N.trim() });
  }
  if (schedule.S?.trim() && !isVideoMedia(schedule.S)) {
    rawEntries.push({ label: 'South Boundary Photo', url: schedule.S.trim() });
  }
  if (schedule.E?.trim() && !isVideoMedia(schedule.E)) {
    rawEntries.push({ label: 'East Boundary Photo', url: schedule.E.trim() });
  }
  if (schedule.W?.trim() && !isVideoMedia(schedule.W)) {
    rawEntries.push({ label: 'West Boundary Photo', url: schedule.W.trim() });
  }

  (app.photoUrls ?? []).forEach((u, i) => {
    if (u?.trim() && !isVideoMedia(u)) {
      rawEntries.push({ label: `Site Photo ${i + 1}`, url: u.trim() });
    }
  });

  const hasVideo = Boolean(app.videoUrl?.trim());
  if (rawEntries.length === 0 && !hasVideo) return '';

  const resolvedPhotos: { label: string; b64: string }[] = [];
  for (const entry of rawEntries) {
    const b64 = await fetchImageAsBase64(entry.url, token);
    if (b64) {
      resolvedPhotos.push({ label: entry.label, b64 });
    }
  }

  let html = `
    <div style="margin-top:10px;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden;${paint('#ffffff')}page-break-inside:avoid;break-inside:avoid;">
      <div style="${paint('#dbeafe')}color:#1e3a8a;font-size:11px;font-weight:bold;padding:7px 10px;border-bottom:1px solid #bfdbfe;">
        Photos &amp; Media (${resolvedPhotos.length} photos)
      </div>
      <div style="padding:8px;">
  `;

  if (resolvedPhotos.length > 0) {
    html += `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">`;
    for (let i = 0; i < resolvedPhotos.length; i += 2) {
      const p1 = resolvedPhotos[i];
      const p2 = resolvedPhotos[i + 1];
      html += `<tr>`;
      html += `
        <td style="width:50%;padding:5px;vertical-align:top;">
          <div style="border:1px solid #e2e8f0;border-radius:6px;padding:6px;${paint('#ffffff')}text-align:center;">
            <img src="${p1.b64}" style="max-width:100%;height:118px;object-fit:cover;border-radius:4px;display:block;margin:0 auto;" alt="${escapeHtml(p1.label)}" />
            <div style="font-size:8.5px;font-weight:bold;color:#1d4ed8;margin-top:5px;line-height:1.3;">${escapeHtml(p1.label)}</div>
          </div>
        </td>
      `;
      if (p2) {
        html += `
          <td style="width:50%;padding:5px;vertical-align:top;">
            <div style="border:1px solid #e2e8f0;border-radius:6px;padding:6px;${paint('#ffffff')}text-align:center;">
              <img src="${p2.b64}" style="max-width:100%;height:118px;object-fit:cover;border-radius:4px;display:block;margin:0 auto;" alt="${escapeHtml(p2.label)}" />
              <div style="font-size:8.5px;font-weight:bold;color:#1d4ed8;margin-top:5px;line-height:1.3;">${escapeHtml(p2.label)}</div>
            </div>
          </td>
        `;
      } else {
        html += `<td style="width:50%;padding:4px;"></td>`;
      }
      html += `</tr>`;
    }
    html += `</table>`;
  }

  if (hasVideo) {
    html += `
      <div style="margin-top:8px;padding:6px 10px;${paint('#f0fdf4')}border:1px solid #bbf7d0;border-radius:4px;color:#15803d;font-size:9px;font-weight:bold;">
        ✓ Site Walk-Through Video Recorded
      </div>
    `;
  }

  html += `
      </div>
    </div>
  `;

  return html;
}

async function buildHtml(app: MobileApplication, token: string): Promise<string> {
  const mediaHtml = await photosMediaBlock(app, token);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(app.applicationNumber)} CDR Report</title>
  <style>
    @page {
      size: A4;
      margin: 8mm;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      font-size: 9px;
      line-height: 1.35;
      background: #ffffff;
    }
    .pdf-dim-block {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-before: avoid !important;
      break-before: avoid !important;
    }
    .pdf-comments-block {
      page-break-before: always !important;
      break-before: page !important;
    }
    svg {
      max-height: 176px !important;
      height: 176px !important;
      width: 100% !important;
    }
  </style>
</head>
<body style="margin:0;padding:8px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:9px;line-height:1.35;${paint('#ffffff')}">

  <table width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 10px;${paint('#0256d0')}border-radius:8px;overflow:hidden;">
    <tr>
      <td style="width:28%;padding:10px 12px;vertical-align:middle;">
        <table cellspacing="0" cellpadding="0"><tr>
          <td style="vertical-align:middle;">
            <img src="${BDA_LOGO_BASE64}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;display:block;${paint('#ffffff')}" alt="BDA Logo" />
          </td>
          <td style="vertical-align:middle;padding-left:8px;">
            <div style="color:#ffffff;font-size:8px;font-weight:bold;letter-spacing:0.6px;text-transform:uppercase;">BANGALORE DEVELOPMENT AUTHORITY</div>
            <div style="color:#dbeafe;font-size:8.5px;margin-top:2px;">Ministry of Public Works</div>
          </td>
        </tr></table>
      </td>
      <td style="vertical-align:middle;text-align:center;padding:8px 6px;">
        <div style="color:#ffffff;font-size:15px;font-weight:bold;letter-spacing:0.4px;line-height:18px;">CDRMS SITE SURVEY REPORT</div>
      </td>
      <td style="width:24%;text-align:right;vertical-align:middle;padding:10px 12px;">
        <div style="${paint('#ffffff')}color:#0256d0;font-size:9.5px;font-weight:bold;padding:4px 10px;border-radius:14px;display:inline-block;">
          ${escapeHtml(app.applicationNumber)}
        </div>
      </td>
    </tr>
  </table>

  ${zcFormTable(app)}
  ${engineerBlock(app)}
  ${mediaHtml}

  <div style="margin-top:10px;padding-top:6px;border-top:1px solid #cbd5e1;color:#64748b;font-size:8px;text-align:center;line-height:1.4;">
    Generated by CDRMS · Bangalore Development Authority · ${escapeHtml(new Date().toLocaleString())}
  </div>
</body>
</html>`;
}

async function resolvePdfApplication(
  app: MobileApplication,
  token: string,
): Promise<MobileApplication> {
  try {
    return await fetchApplication(token, app.id);
  } catch {
    return app;
  }
}

function pdfFileName(app: MobileApplication) {
  return `${app.applicationNumber.replace(/[^\w.-]+/g, '_')}-CDR.pdf`;
}

async function assertPdfFile(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri);
  const size = info.exists && 'size' in info ? Number(info.size ?? 0) : 0;
  if (!info.exists || size < 200) {
    throw new Error('PDF generation failed (empty file). Try again.');
  }
  return size;
}

async function keepSandboxCopy(tempUri: string, fileName: string): Promise<string | null> {
  const root = FileSystem.documentDirectory;
  if (!root) return null;
  const dir = `${root}CDRMS/Downloads/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const dest = `${dir}${fileName}`;
  await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => undefined);
  await FileSystem.copyAsync({ from: tempUri, to: dest });
  return dest;
}

async function trySaveToAndroidDownloads(
  tempUri: string,
  fileName: string,
): Promise<string | null> {
  const saf = FileSystem.StorageAccessFramework;
  if (Platform.OS !== 'android' || !saf) return null;

  try {
    const downloadsUri = saf.getUriForDirectoryInRoot('Download');
    const base64 = await FileSystem.readAsStringAsync(tempUri, {
      encoding: 'base64',
    });
    const destUri = await saf.createFileAsync(downloadsUri, fileName, 'application/pdf');
    await FileSystem.writeAsStringAsync(destUri, base64, {
      encoding: 'base64',
    });
    return destUri;
  } catch {
    return null;
  }
}

/** Direct save — no folder picker; tries public Downloads, then app storage. */
async function savePdfToDevice(
  tempUri: string,
  fileName: string,
): Promise<{ savedPath: string; openUri: string; message: string }> {
  await assertPdfFile(tempUri);

  const sandboxUri = (await keepSandboxCopy(tempUri, fileName)) || tempUri;
  const publicPath = await trySaveToAndroidDownloads(tempUri, fileName);

  if (publicPath) {
    return {
      savedPath: publicPath,
      openUri: sandboxUri,
      message: `${fileName} saved to Downloads.`,
    };
  }

  return {
    savedPath: sandboxUri,
    openUri: sandboxUri,
    message: `${fileName} saved on device. Tap the notification to open.`,
  };
}

/** Generate and save a CDR application PDF on the device. */
export async function downloadApplicationPdf(
  app: MobileApplication,
  token: string,
  onProgress?: PdfDownloadProgressHandler,
): Promise<PdfDownloadResult> {
  if (!token?.trim()) throw new Error('Sign in required to download PDF');

  const report = (percent: number, label: string) => onProgress?.({ percent, label });

  report(5, 'Starting…');

  report(15, 'Loading application…');
  const full = await resolvePdfApplication(app, token);
  const fileName = pdfFileName(full);

  report(40, 'Building PDF…');
  const html = await buildHtml(full, token);

  if (Platform.OS === 'web') {
    report(80, 'Saving PDF…');
    await downloadPdfInBrowser(html, fileName);
    report(100, 'Complete');
    return {
      fileName,
      savedPath: fileName,
      openUri: undefined,
      message: `${fileName} downloaded.`,
    };
  }

  let Print: typeof import('expo-print');
  try {
    Print = require('expo-print');
  } catch {
    throw new Error(
      'PDF engine is not available in this build. Open with Expo Go, or rebuild the app with expo-print.',
    );
  }

  report(55, 'Generating PDF…');
  const printed = await Print.printToFileAsync({ html });
  const uri = printed?.uri;

  if (!uri) throw new Error('PDF engine returned no file');

  const size = await assertPdfFile(uri);
  if (size < 500) {
    throw new Error('PDF looks empty. Please try Download again.');
  }

  report(80, 'Saving file…');
  const result = await savePdfToDevice(uri, fileName);
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);

  report(100, 'Complete');

  return {
    fileName,
    savedPath: result.savedPath,
    openUri: result.openUri,
    message: result.message,
    fileSizeBytes: size,
  };
}
