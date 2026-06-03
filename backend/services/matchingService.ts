import { query } from '../src/db/index';

export type LostFoundType = 'lost' | 'found';

export interface LostFoundLocation {
  latitude: number;
  longitude: number;
}

export interface LostFoundReport {
  id: string;
  type: LostFoundType;
  title: string;
  description: string;
  species: string;
  breed?: string;
  photoUrl?: string;
  location: LostFoundLocation;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

const POSTGIS_SRID = 4326;
const METERS_PER_KM = 1000;

export function haversineDistanceKm(a: LostFoundLocation, b: LostFoundLocation): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const r = 6371;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const underRoot = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return r * 2 * Math.atan2(Math.sqrt(underRoot), Math.sqrt(1 - underRoot));
}

export function isFoundReportExpired(report: LostFoundReport): boolean {
  if (report.type !== 'found' || !report.expiresAt) return false;
  return Date.now() > Date.parse(report.expiresAt);
}

function normalize(value?: string): string {
  return value?.trim().toLowerCase() ?? '';
}

function photoUrlsMatch(left?: string, right?: string): boolean {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const filename = (value: string) => value.replace(/^.*[\/]/, '').replace(/[?].*$/, '');
  return filename(a) === filename(b);
}

function hasSpeciesBreedMatch(a: LostFoundReport, b: LostFoundReport): boolean {
  if (normalize(a.species) !== normalize(b.species)) return false;
  const breedA = normalize(a.breed);
  const breedB = normalize(b.breed);
  return !breedA || !breedB || breedA === breedB;
}

function withinRadius(report: LostFoundReport, center: LostFoundLocation, radiusKm: number): boolean {
  return haversineDistanceKm(report.location, center) <= radiusKm;
}

async function queryPostgisMatches(report: LostFoundReport, radiusKm: number): Promise<LostFoundReport[] | undefined> {
  try {
    const result = await query(
      `
      SELECT
        id,
        type,
        title,
        description,
        species,
        breed,
        photo_url AS "photoUrl",
        owner_id AS "ownerId",
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        expires_at AS "expiresAt",
        ST_Y(location::geometry) AS latitude,
        ST_X(location::geometry) AS longitude
      FROM lost_found_reports
      WHERE type = $1
        AND id != $2
        AND ST_DWithin(
          location::geography,
          ST_SetSRID(ST_Point($3, $4), ${POSTGIS_SRID})::geography,
          $5
        )
    `,
      [report.type === 'lost' ? 'found' : 'lost', report.id, report.location.longitude, report.location.latitude, radiusKm * METERS_PER_KM],
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      type: String(row.type) as LostFoundType,
      title: String(row.title),
      description: String(row.description),
      species: String(row.species),
      breed: row.breed ? String(row.breed) : undefined,
      photoUrl: row.photoUrl ? String(row.photoUrl) : undefined,
      location: {
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
      },
      ownerId: String(row.ownerId),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
      expiresAt: row.expiresAt ? String(row.expiresAt) : undefined,
    }));
  } catch {
    return undefined;
  }
}

export async function findNearbyMatches(
  report: LostFoundReport,
  candidates: LostFoundReport[],
  radiusKm = 30,
): Promise<LostFoundReport[]> {
  if (process.env.DATABASE_URL) {
    const dbMatches = await queryPostgisMatches(report, radiusKm);
    if (Array.isArray(dbMatches)) {
      return dbMatches.filter((candidate) => {
        if (!hasSpeciesBreedMatch(report, candidate)) return false;
        if (candidate.type === 'found' && isFoundReportExpired(candidate)) return false;
        return withinRadius(candidate, report.location, radiusKm) || photoUrlsMatch(report.photoUrl, candidate.photoUrl);
      });
    }
  }

  return candidates.filter((candidate) => {
    if (candidate.type === report.type) return false;
    if (!hasSpeciesBreedMatch(report, candidate)) return false;
    if (candidate.type === 'found' && isFoundReportExpired(candidate)) return false;
    return withinRadius(candidate, report.location, radiusKm) || photoUrlsMatch(report.photoUrl, candidate.photoUrl);
  });
}
/**
 * Matching service for lost and found reports
 * Uses PostGIS for geospatial queries and similarity scoring for photo/pet attributes
 */

import { pool } from '../config/database';
import logger from '../../utils/logger';
import type { LostFoundReport, LostFoundMatch, Location } from '../models/LostFound';

interface MatchingCriteria {
  speciesWeight: number;
  breedWeight: number;
  colorWeight: number;
  locationWeight: number;
  photoWeight: number;
}

const DEFAULT_MATCHING_CRITERIA: MatchingCriteria = {
  speciesWeight: 30,
  breedWeight: 25,
  colorWeight: 20,
  locationWeight: 15,
  photoWeight: 10,
};

/**
 * Find potential matches for a lost report
 */
export async function findMatches(
  lostReportId: string,
  criteria: Partial<MatchingCriteria> = {},
): Promise<LostFoundMatch[]> {
  const finalCriteria = { ...DEFAULT_MATCHING_CRITERIA, ...criteria };

  try {
    const query = `
      WITH lost_report AS (
        SELECT 
          id, user_id, species, breed, color, location, 
          alert_radius_km, description
        FROM lost_found_reports
        WHERE id = $1 AND report_type = 'lost' AND status = 'active'
      ),
      found_reports_in_radius AS (
        SELECT 
          f.id, f.species, f.breed, f.color, f.location,
          ST_Distance(f.location::geography, l.location::geography) / 1000 AS distance_km
        FROM lost_found_reports f, lost_report l
        WHERE f.report_type = 'found' 
          AND f.status = 'active'
          AND f.user_id != l.user_id
          AND ST_DWithin(f.location::geography, l.location::geography, l.alert_radius_km * 1000)
      ),
      scoring AS (
        SELECT 
          l.id as lost_id,
          f.id as found_id,
          f.distance_km,
          CASE WHEN LOWER(f.species) = LOWER(l.species) THEN $3 ELSE 0 END as species_score,
          CASE 
            WHEN f.breed IS NOT NULL AND l.breed IS NOT NULL 
              AND LOWER(f.breed) = LOWER(l.breed) THEN $4 
            ELSE 0 
          END as breed_score,
          CASE 
            WHEN f.color IS NOT NULL AND l.color IS NOT NULL 
              AND LOWER(f.color) = LOWER(l.color) THEN $5 
            ELSE 0 
          END as color_score,
          (1 - (f.distance_km / GREATEST(l.alert_radius_km, 1))) * $6 as location_score,
          CASE 
            WHEN l.description IS NOT NULL AND f.id IS NOT NULL THEN $7 
            ELSE 0 
          END as photo_score,
          CASE WHEN LOWER(f.species) = LOWER(l.species) THEN TRUE ELSE FALSE END as species_match,
          CASE 
            WHEN f.breed IS NOT NULL AND l.breed IS NOT NULL 
              AND LOWER(f.breed) = LOWER(l.breed) THEN TRUE 
            ELSE FALSE 
          END as breed_match,
          CASE 
            WHEN f.color IS NOT NULL AND l.color IS NOT NULL 
              AND LOWER(f.color) = LOWER(l.color) THEN TRUE 
            ELSE FALSE 
          END as color_match
        FROM found_reports_in_radius f, lost_report l
      )
      SELECT 
        gen_random_uuid() as id,
        lost_id,
        found_id,
        ROUND(CAST((species_score + breed_score + color_score + location_score + photo_score) AS decimal), 2) as match_score,
        ROUND(CAST(distance_km AS decimal), 2) as location_distance_km,
        species_match,
        breed_match,
        color_match,
        NULL::decimal as photo_similarity_score,
        CASE 
          WHEN species_match THEN 'Species match'
          WHEN breed_match THEN 'Breed match'
          WHEN color_match THEN 'Color match'
          ELSE 'Location proximity'
        END as match_reason,
        FALSE as user_confirmed,
        NULL as confirmed_at,
        NOW() as created_at,
        NOW() as updated_at
      FROM scoring
      WHERE (species_score + breed_score + color_score + location_score + photo_score) > 20
      ORDER BY (species_score + breed_score + color_score + location_score + photo_score) DESC
      LIMIT 10;
    `;

    const result = await pool.query(query, [
      lostReportId,
      lostReportId, // For the subquery
      DEFAULT_MATCHING_CRITERIA.speciesWeight,
      DEFAULT_MATCHING_CRITERIA.breedWeight,
      DEFAULT_MATCHING_CRITERIA.colorWeight,
      DEFAULT_MATCHING_CRITERIA.locationWeight,
      DEFAULT_MATCHING_CRITERIA.photoWeight,
    ]);

    const matches = result.rows.map((row) => ({
      id: row.id,
      lostReportId: row.lost_id,
      foundReportId: row.found_id,
      matchScore: parseFloat(row.match_score),
      locationDistanceKm: parseFloat(row.location_distance_km),
      speciesMatch: row.species_match,
      breedMatch: row.breed_match,
      colorMatch: row.color_match,
      photoSimilarityScore: row.photo_similarity_score,
      matchReason: row.match_reason,
      userConfirmed: row.user_confirmed,
      confirmedAt: row.confirmed_at,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));

    logger.info('found_potential_matches', {
      lostReportId,
      matchCount: matches.length,
    });

    return matches;
  } catch (error) {
    logger.error('matching_service_error', { error, lostReportId });
    throw error;
  }
}

/**
 * Find all reports within a geographic radius
 */
export async function findReportsInRadius(
  location: Location,
  radiusKm: number,
  reportType?: 'lost' | 'found',
  species?: string,
): Promise<LostFoundReport[]> {
  try {
    let query = `
      SELECT 
        id, user_id, pet_id, report_type, species, breed, color,
        description, photo_urls, location_latitude, location_longitude,
        location_name, alert_radius_km, status, qr_code_id, microchip_id,
        date_reported, date_occurred, date_resolved, created_at, updated_at,
        expires_at
      FROM lost_found_reports
      WHERE status = 'active'
        AND ST_DWithin(
          location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3 * 1000
        )
    `;

    const params: unknown[] = [location.longitude, location.latitude, radiusKm];
    let paramIndex = 4;

    if (reportType) {
      query += ` AND report_type = $${paramIndex}`;
      params.push(reportType);
      paramIndex++;
    }

    if (species) {
      query += ` AND LOWER(species) = LOWER($${paramIndex})`;
      params.push(species);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT 50`;

    const result = await pool.query(query, params);

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      petId: row.pet_id,
      reportType: row.report_type,
      species: row.species,
      breed: row.breed,
      color: row.color,
      description: row.description,
      photoUrls: row.photo_urls || [],
      location: {
        latitude: parseFloat(row.location_latitude),
        longitude: parseFloat(row.location_longitude),
        name: row.location_name,
      },
      alertRadiusKm: row.alert_radius_km,
      status: row.status,
      qrCodeId: row.qr_code_id,
      microchipId: row.microchip_id,
      dateReported: row.date_reported.toISOString(),
      dateOccurred: row.date_occurred?.toISOString(),
      dateResolved: row.date_resolved?.toISOString(),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
    }));
  } catch (error) {
    logger.error('radius_search_error', { error, location, radiusKm });
    throw error;
  }
}

/**
 * Calculate matching score between two reports
 */
export function calculateMatchScore(
  lostReport: LostFoundReport,
  foundReport: LostFoundReport,
  criteria: Partial<MatchingCriteria> = {},
): number {
  const finalCriteria = { ...DEFAULT_MATCHING_CRITERIA, ...criteria };
  let score = 0;

  // Species match (highest weight)
  if (lostReport.species.toLowerCase() === foundReport.species.toLowerCase()) {
    score += finalCriteria.speciesWeight;
  }

  // Breed match
  if (
    lostReport.breed &&
    foundReport.breed &&
    lostReport.breed.toLowerCase() === foundReport.breed.toLowerCase()
  ) {
    score += finalCriteria.breedWeight;
  }

  // Color match
  if (
    lostReport.color &&
    foundReport.color &&
    lostReport.color.toLowerCase() === foundReport.color.toLowerCase()
  ) {
    score += finalCriteria.colorWeight;
  }

  // Location proximity (calculate distance and score)
  const distance = calculateDistance(
    lostReport.location.latitude,
    lostReport.location.longitude,
    foundReport.location.latitude,
    foundReport.location.longitude,
  );

  if (distance <= lostReport.alertRadiusKm) {
    const locationScore =
      finalCriteria.locationWeight * (1 - distance / lostReport.alertRadiusKm);
    score += locationScore;
  }

  // Photo/description similarity (simplified - would use ML in production)
  if (lostReport.description && foundReport.description) {
    score += finalCriteria.photoWeight * 0.5;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get matches for a report that's already in the database
 */
export async function getStoredMatches(reportId: string): Promise<LostFoundMatch[]> {
  try {
    const query = `
      SELECT 
        id, lost_report_id, found_report_id, match_score,
        location_distance_km, species_match, breed_match, color_match,
        photo_similarity_score, match_reason, user_confirmed, confirmed_at,
        created_at, updated_at
      FROM lost_found_matches
      WHERE (lost_report_id = $1 OR found_report_id = $1)
      ORDER BY match_score DESC;
    `;

    const result = await pool.query(query, [reportId]);

    return result.rows.map((row) => ({
      id: row.id,
      lostReportId: row.lost_report_id,
      foundReportId: row.found_report_id,
      matchScore: parseFloat(row.match_score),
      locationDistanceKm: parseFloat(row.location_distance_km),
      speciesMatch: row.species_match,
      breedMatch: row.breed_match,
      colorMatch: row.color_match,
      photoSimilarityScore: row.photo_similarity_score,
      matchReason: row.match_reason,
      userConfirmed: row.user_confirmed,
      confirmedAt: row.confirmed_at?.toISOString(),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));
  } catch (error) {
    logger.error('get_stored_matches_error', { error, reportId });
    throw error;
  }
}
