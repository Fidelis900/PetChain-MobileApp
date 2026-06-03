import { randomUUID } from 'crypto';

import express from 'express';

import { authenticateJWT, type AuthenticatedRequest } from '../../middleware/auth';
import { ok, sendError } from '../response';
import {
  findNearbyMatches,
  isFoundReportExpired,
  type LostFoundLocation,
  type LostFoundReport,
} from '../../services/matchingService';
import { sendToUser } from '../../services/pushService';

const router = express.Router();
router.use(authenticateJWT);

const REPORT_EXPIRY_DAYS = 30;
const DEFAULT_ALERT_RADIUS_KM = 30;
const USER_LOCATION_STALE_MS = 24 * 60 * 60 * 1000;

interface StoredLostFoundReport extends LostFoundReport {
  ownerId: string;
  expiresAt?: string;
}

interface StoredUserLocation extends LostFoundLocation {
  updatedAt: string;
}

const reports = new Map<string, StoredLostFoundReport>();
const userLocations = new Map<string, StoredUserLocation>();

function cleanupExpiredReports(): void {
  const now = Date.now();
  for (const [id, report] of reports.entries()) {
    if (report.type === 'found' && report.expiresAt && Date.parse(report.expiresAt) < now) {
      reports.delete(id);
    }
  }
}

function normalizeReportType(value: unknown): 'lost' | 'found' | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.toLowerCase().trim();
  return normalized === 'lost' || normalized === 'found' ? normalized : undefined;
}

function parseLocation(value: unknown): LostFoundLocation | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const payload = value as { latitude?: unknown; longitude?: unknown };
  const latitude = typeof payload.latitude === 'number' ? payload.latitude : Number(payload.latitude);
  const longitude = typeof payload.longitude === 'number' ? payload.longitude : Number(payload.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { latitude, longitude };
  }
  return undefined;
}

function reportResponse(report: StoredLostFoundReport) {
  return {
    id: report.id,
    type: report.type,
    title: report.title,
    description: report.description,
    species: report.species,
    breed: report.breed,
    photoUrl: report.photoUrl,
    location: report.location,
    ownerId: report.ownerId,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    expiresAt: report.expiresAt,
  };
}

async function broadcastLostReport(report: StoredLostFoundReport, radiusKm: number): Promise<void> {
  const now = Date.now();
  const nearbyUsers = [...userLocations.entries()]
    .filter(([userId, location]) => {
      if (userId === report.ownerId) return false;
      if (now - Date.parse(location.updatedAt) > USER_LOCATION_STALE_MS) return false;
      const latDelta = location.latitude - report.location.latitude;
      const lonDelta = location.longitude - report.location.longitude;
      const approxKm = Math.sqrt(latDelta * latDelta + lonDelta * lonDelta) * 111;
      return approxKm <= radiusKm;
    })
    .map(([userId]) => userId);

  await Promise.all(
    nearbyUsers.map((userId) =>
      sendToUser(
        userId,
        'sos_notifications',
        'Lost pet alert near you',
        `A lost pet has been reported nearby. Tap the app for details.`,
        { reportId: report.id, route: 'LostFound' },
      ),
    ),
  );
}

router.get('/reports', (req, res) => {
  cleanupExpiredReports();

  const type = normalizeReportType(req.query.type) ?? 'lost';
  const species = typeof req.query.species === 'string' ? req.query.species.trim().toLowerCase() : undefined;
  const breed = typeof req.query.breed === 'string' ? req.query.breed.trim().toLowerCase() : undefined;
  const radiusKm = Number(req.query.radiusKm) || DEFAULT_ALERT_RADIUS_KM;
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);
  const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude);

  let result = [...reports.values()].filter((report) => report.type === type);
  if (type === 'found') {
    result = result.filter((report) => !isFoundReportExpired(report));
  }

  if (species) {
    result = result.filter((report) => report.species.toLowerCase() === species);
  }

  if (breed) {
    result = result.filter((report) => report.breed?.toLowerCase() === breed);
  }

  if (hasLocation) {
    result = result.filter((report) => {
      const latDelta = report.location.latitude - latitude;
      const lonDelta = report.location.longitude - longitude;
      const approxKm = Math.sqrt(latDelta * latDelta + lonDelta * lonDelta) * 111;
      return approxKm <= radiusKm;
    });
  }

  result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return res.json(ok({ data: result.map(reportResponse), total: result.length }));
});

router.get('/reports/:id', (req, res) => {
  cleanupExpiredReports();
  const report = reports.get(req.params.id);
  if (!report || (report.type === 'found' && isFoundReportExpired(report))) {
    return sendError(res, 404, 'NOT_FOUND', 'Report not found');
  }
  return res.json(ok(reportResponse(report)));
});

router.get('/reports/:id/matches', async (req, res) => {
  cleanupExpiredReports();
  const report = reports.get(req.params.id);
  if (!report || (report.type === 'found' && isFoundReportExpired(report))) {
    return sendError(res, 404, 'NOT_FOUND', 'Report not found');
  }

  const candidates = [...reports.values()].filter((candidate) => candidate.id !== report.id);
  const matches = await findNearbyMatches(report, candidates, Number(req.query.radiusKm) || DEFAULT_ALERT_RADIUS_KM);
  return res.json(ok({ data: matches.map(reportResponse), total: matches.length }));
});

router.post('/reports', async (req: AuthenticatedRequest, res) => {
  const { type: rawType, title: rawTitle, description: rawDescription, species: rawSpecies, breed: rawBreed, photoUrl: rawPhotoUrl, location: rawLocation } = req.body as Record<string, unknown>;

  const type = normalizeReportType(rawType);
  if (!type) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'type must be lost or found');
  }

  const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
  const description = typeof rawDescription === 'string' ? rawDescription.trim() : '';
  const species = typeof rawSpecies === 'string' ? rawSpecies.trim() : '';
  const breed = typeof rawBreed === 'string' ? rawBreed.trim() : undefined;
  const photoUrl = typeof rawPhotoUrl === 'string' ? rawPhotoUrl.trim() : undefined;
  const location = parseLocation(rawLocation);

  if (!title || !species || !location) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'title, species, and location are required');
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const report: StoredLostFoundReport = {
    id,
    type,
    title,
    description,
    species,
    breed,
    photoUrl,
    location,
    ownerId: req.user!.id,
    createdAt: now,
    updatedAt: now,
    expiresAt: type === 'found' ? new Date(Date.now() + REPORT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString() : undefined,
  };

  reports.set(id, report);

  if (type === 'lost') {
    await broadcastLostReport(report, DEFAULT_ALERT_RADIUS_KM);
  }

  return res.status(201).json(ok({ data: reportResponse(report) }));
});

router.post('/location', (req: AuthenticatedRequest, res) => {
  const location = parseLocation(req.body);
  if (!location) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'latitude and longitude are required');
  }
  userLocations.set(req.user!.id, { ...location, updatedAt: new Date().toISOString() });
  return res.status(201).json(ok({ data: { updated: true } }));
});

export default router;
/**
 * Lost and Found routes
 */

import express, { type Response } from 'express';
import { randomUUID } from 'crypto';

import {
  authenticateJWT,
  authorizeRoles,
  type AuthenticatedRequest,
} from '../../middleware/auth';
import { UserRole } from '../../models/UserRole';
import type {
  LostFoundReport,
  UpdateLostFoundReportInput,
  CreateLostFoundReportInput,
} from '../models/LostFound';
import { ok, sendError } from '../response';
import logger from '../../utils/logger';
import {
  createReport,
  getReport,
  listReportsByUser,
  updateReport,
  deleteReport,
  getUserPreferences,
  updateUserPreferences,
  confirmMatch,
} from '../services/lostFoundService';
import { findReportsInRadius, getStoredMatches } from '../services/matchingService';

const router = express.Router();
router.use(authenticateJWT);

// ─── Report CRUD ───────────────────────────────────────────────────────────

/**
 * POST /api/lost-found/reports
 * Create a new lost or found report
 */
router.post('/reports', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reportType, species, breed, color, description, photoUrls, location, alertRadiusKm, petId, qrCodeId, microchipId, dateOccurred } = req.body;

    // Validation
    if (!reportType || !['lost', 'found'].includes(reportType)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'reportType must be "lost" or "found"');
    }

    if (!species) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'species is required');
    }

    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      return sendError(res, 400, 'VALIDATION_ERROR', 'location with latitude and longitude is required');
    }

    if (location.latitude < -90 || location.latitude > 90) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid latitude');
    }

    if (location.longitude < -180 || location.longitude > 180) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid longitude');
    }

    const input: CreateLostFoundReportInput = {
      reportType,
      species,
      breed: breed || undefined,
      color: color || undefined,
      description: description || undefined,
      photoUrls: photoUrls || [],
      location,
      alertRadiusKm: alertRadiusKm || 5,
      petId: petId || undefined,
      qrCodeId: qrCodeId || undefined,
      microchipId: microchipId || undefined,
      dateOccurred: dateOccurred || undefined,
    };

    const report = await createReport(req.user!.id, input);

    logger.info('report_created_via_api', {
      reportId: report.id,
      userId: req.user!.id,
      reportType,
    });

    return res.status(201).json(ok(report, 'Report created successfully'));
  } catch (error) {
    logger.error('create_report_api_error', { error, userId: req.user!.id });
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to create report');
  }
});

/**
 * GET /api/lost-found/reports/:id
 * Get a specific report
 */
router.get('/reports/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const report = await getReport(req.params.id);

    if (!report) {
      return sendError(res, 404, 'NOT_FOUND', 'Report not found');
    }

    return res.json(ok(report));
  } catch (error) {
    logger.error('get_report_api_error', { error, reportId: req.params.id });
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve report');
  }
});

/**
 * GET /api/lost-found/my-reports
 * List all reports for the current user
 */
router.get('/my-reports', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, limit = 50, offset = 0 } = req.query;
    const reportType = type && ['lost', 'found'].includes(String(type)) ? (String(type) as 'lost' | 'found') : undefined;

    const reports = await listReportsByUser(req.user!.id, reportType, Number(limit), Number(offset));

    return res.json(
      ok({
        reports,
        count: reports.length,
        limit,
        offset,
      }),
    );
  } catch (error) {
    logger.error('list_reports_api_error', { error, userId: req.user!.id });
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve reports');
  }
});

/**
 * PUT /api/lost-found/reports/:id
 * Update a report
 */
router.put('/reports/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updates: UpdateLostFoundReportInput = {};

    if (req.body.species !== undefined) updates.species = req.body.species;
    if (req.body.breed !== undefined) updates.breed = req.body.breed;
    if (req.body.color !== undefined) updates.color = req.body.color;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.photoUrls !== undefined) updates.photoUrls = req.body.photoUrls;
    if (req.body.location !== undefined) updates.location = req.body.location;
    if (req.body.alertRadiusKm !== undefined) updates.alertRadiusKm = req.body.alertRadiusKm;
    if (req.body.status !== undefined) updates.status = req.body.status;
    if (req.body.dateResolved !== undefined) updates.dateResolved = req.body.dateResolved;

    const report = await updateReport(req.params.id, req.user!.id, updates);

    if (!report) {
      return sendError(res, 404, 'NOT_FOUND', 'Report not found or unauthorized');
    }

    logger.info('report_updated_via_api', {
      reportId: req.params.id,
      userId: req.user!.id,
    });

    return res.json(ok(report, 'Report updated successfully'));
  } catch (error) {
    logger.error('update_report_api_error', { error, reportId: req.params.id, userId: req.user!.id });
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to update report');
  }
});

/**
 * DELETE /api/lost-found/reports/:id
 * Delete a report
 */
router.delete('/reports/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = await deleteReport(req.params.id, req.user!.id);

    if (!success) {
      return sendError(res, 404, 'NOT_FOUND', 'Report not found or unauthorized');
    }

    logger.info('report_deleted_via_api', {
      reportId: req.params.id,
      userId: req.user!.id,
    });

    return res.json(ok(null, 'Report deleted successfully'));
  } catch (error) {
    logger.error('delete_report_api_error', { error, reportId: req.params.id, userId: req.user!.id });
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to delete report');
  }
});

// ─── Matching & Search ───────────────────────────────────────────────────────

/**
 * GET /api/lost-found/reports/:id/matches
 * Get potential matches for a report
 */
router.get('/reports/:id/matches', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const matches = await getStoredMatches(req.params.id);

    return res.json(
      ok({
        reportId: req.params.id,
        matches,
        count: matches.length,
      }),
    );
  } catch (error) {
    logger.error('get_matches_api_error', { error, reportId: req.params.id });
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve matches');
  }
});

/**
 * POST /api/lost-found/matches/:id/confirm
 * Confirm a match as correct
 */
router.post('/matches/:id/confirm', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = await confirmMatch(req.params.id, req.user!.id);

    if (!success) {
      return sendError(res, 404, 'NOT_FOUND', 'Match not found or unauthorized');
    }

    logger.info('match_confirmed_via_api', {
      matchId: req.params.id,
      userId: req.user!.id,
    });

    return res.json(ok(null, 'Match confirmed'));
  } catch (error) {
    logger.error('confirm_match_api_error', { error, matchId: req.params.id, userId: req.user!.id });
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to confirm match');
  }
});

/**
 * GET /api/lost-found/search
 * Search for reports by location and optional filters
 */
router.get('/search', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { latitude, longitude, radiusKm = 5, reportType, species } = req.query;

    if (!latitude || !longitude) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'latitude and longitude are required');
    }

    const lat = parseFloat(String(latitude));
    const lon = parseFloat(String(longitude));
    const radius = parseFloat(String(radiusKm));

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid latitude');
    }

    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid longitude');
    }

    if (!Number.isFinite(radius) || radius <= 0) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid radiusKm');
    }

    const location = { latitude: lat, longitude: lon };
    const type = reportType && ['lost', 'found'].includes(String(reportType)) ? (String(reportType) as 'lost' | 'found') : undefined;
    const speciesFilter = species ? String(species) : undefined;

    const reports = await findReportsInRadius(location, radius, type, speciesFilter);

    logger.info('location_search_performed', {
      userId: req.user!.id,
      location,
      radius,
      resultCount: reports.length,
    });

    return res.json(
      ok({
        location,
        radiusKm: radius,
        reports,
        count: reports.length,
      }),
    );
  } catch (error) {
    logger.error('location_search_error', { error, userId: req.user!.id });
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to search reports');
  }
});

// ─── User Preferences ───────────────────────────────────────────────────────

/**
 * GET /api/lost-found/preferences
 * Get user's lost/found preferences
 */
router.get('/preferences', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const preferences = await getUserPreferences(req.user!.id);
    return res.json(ok(preferences));
  } catch (error) {
    logger.error('get_preferences_api_error', { error, userId: req.user!.id });
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve preferences');
  }
});

/**
 * PUT /api/lost-found/preferences
 * Update user's lost/found preferences
 */
router.put('/preferences', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { defaultAlertRadiusKm, notificationsEnabled, emailOnMatch, pushOnMatch, receiveLostAlerts, alertSpecies } = req.body;

    const updates: Parameters<typeof updateUserPreferences>[1] = {};

    if (defaultAlertRadiusKm !== undefined) updates.defaultAlertRadiusKm = defaultAlertRadiusKm;
    if (notificationsEnabled !== undefined) updates.notificationsEnabled = notificationsEnabled;
    if (emailOnMatch !== undefined) updates.emailOnMatch = emailOnMatch;
    if (pushOnMatch !== undefined) updates.pushOnMatch = pushOnMatch;
    if (receiveLostAlerts !== undefined) updates.receiveLostAlerts = receiveLostAlerts;
    if (alertSpecies !== undefined) updates.alertSpecies = alertSpecies;

    const preferences = await updateUserPreferences(req.user!.id, updates);

    logger.info('preferences_updated_via_api', {
      userId: req.user!.id,
    });

    return res.json(ok(preferences, 'Preferences updated successfully'));
  } catch (error) {
    logger.error('update_preferences_api_error', { error, userId: req.user!.id });
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to update preferences');
  }
});

export default router;
