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

function withinRadius(
  report: LostFoundReport,
  center: LostFoundLocation,
  radiusKm: number,
): boolean {
  return haversineDistanceKm(report.location, center) <= radiusKm;
}

async function queryPostgisMatches(
  report: LostFoundReport,
  radiusKm: number,
): Promise<LostFoundReport[] | undefined> {
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
      [
        report.type === 'lost' ? 'found' : 'lost',
        report.id,
        report.location.longitude,
        report.location.latitude,
        radiusKm * METERS_PER_KM,
      ],
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
        return (
          withinRadius(candidate, report.location, radiusKm) ||
          photoUrlsMatch(report.photoUrl, candidate.photoUrl)
        );
      });
    }
  }

  return candidates.filter((candidate) => {
    if (candidate.type === report.type) return false;
    if (!hasSpeciesBreedMatch(report, candidate)) return false;
    if (candidate.type === 'found' && isFoundReportExpired(candidate)) return false;
    return (
      withinRadius(candidate, report.location, radiusKm) ||
      photoUrlsMatch(report.photoUrl, candidate.photoUrl)
    );
  });
}
