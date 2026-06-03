import type { AxiosResponse } from 'axios';

import apiClient from './apiClient';

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

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface ListResponse {
  data: LostFoundReport[];
  total: number;
}

const BASE_URL = '/lost-found';

export async function getLostFoundReports(params?: {
  type?: LostFoundType;
  species?: string;
  breed?: string;
  radiusKm?: number;
  latitude?: number;
  longitude?: number;
}): Promise<{ reports: LostFoundReport[]; total: number }> {
  const response: AxiosResponse<ApiResponse<ListResponse>> = await apiClient.get(
    `${BASE_URL}/reports`,
    { params },
  );
  return response.data.data;
}

export async function getReportMatches(
  reportId: string,
  radiusKm?: number,
): Promise<{ reports: LostFoundReport[]; total: number }> {
  const response: AxiosResponse<ApiResponse<ListResponse>> = await apiClient.get(
    `${BASE_URL}/reports/${encodeURIComponent(reportId)}/matches`,
    {
      params: { radiusKm },
    },
  );
  return response.data.data;
}

export async function createLostFoundReport(data: {
  type: LostFoundType;
  title: string;
  description: string;
  species: string;
  breed?: string;
  photoUrl?: string;
  location: LostFoundLocation;
}): Promise<LostFoundReport> {
  const response: AxiosResponse<ApiResponse<{ data: LostFoundReport }>> = await apiClient.post(
    `${BASE_URL}/reports`,
    data,
  );
  return response.data.data.data;
}

export async function updateMyLocation(location: LostFoundLocation): Promise<void> {
  await apiClient.post(`${BASE_URL}/location`, location);
}

const lostFoundService = {
  getLostFoundReports,
  getReportMatches,
  createLostFoundReport,
  updateMyLocation,
};

export default lostFoundService;
/**
 * Lost and Found Service
 * Frontend service for interacting with Lost/Found Network API
 */

import apiClient from './apiClient';
import logger from '../utils/logger';
import type {
  LostFoundReport,
  CreateLostFoundReportInput,
  UpdateLostFoundReportInput,
  LostFoundMatch,
  UserLostFoundPreferences,
} from '../../backend/models/LostFound';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Create a new lost/found report
 */
export const createReport = async (input: CreateLostFoundReportInput): Promise<LostFoundReport> => {
  try {
    const response = await apiClient.post<ApiResponse<LostFoundReport>>('/api/lost-found/reports', input);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to create report');
    }

    logger.info('report_created', { reportType: input.reportType });
    return response.data.data!;
  } catch (error) {
    logger.error('create_report_error', { error });
    throw error;
  }
};

/**
 * Get a specific report
 */
export const getReport = async (reportId: string): Promise<LostFoundReport> => {
  try {
    const response = await apiClient.get<ApiResponse<LostFoundReport>>(
      `/api/lost-found/reports/${reportId}`,
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get report');
    }

    return response.data.data!;
  } catch (error) {
    logger.error('get_report_error', { error, reportId });
    throw error;
  }
};

/**
 * Get all user's reports
 */
export const getMyReports = async (
  reportType?: 'lost' | 'found',
  limit = 50,
  offset = 0,
): Promise<LostFoundReport[]> => {
  try {
    const params = new URLSearchParams();
    if (reportType) params.append('type', reportType);
    params.append('limit', String(limit));
    params.append('offset', String(offset));

    const response = await apiClient.get<
      ApiResponse<{
        reports: LostFoundReport[];
        count: number;
      }>
    >(`/api/lost-found/my-reports?${params.toString()}`);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get reports');
    }

    return response.data.data?.reports || [];
  } catch (error) {
    logger.error('get_my_reports_error', { error });
    throw error;
  }
};

/**
 * Update a report
 */
export const updateReport = async (
  reportId: string,
  input: UpdateLostFoundReportInput,
): Promise<LostFoundReport> => {
  try {
    const response = await apiClient.put<ApiResponse<LostFoundReport>>(
      `/api/lost-found/reports/${reportId}`,
      input,
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to update report');
    }

    logger.info('report_updated', { reportId });
    return response.data.data!;
  } catch (error) {
    logger.error('update_report_error', { error, reportId });
    throw error;
  }
};

/**
 * Delete a report
 */
export const deleteReport = async (reportId: string): Promise<void> => {
  try {
    const response = await apiClient.delete<ApiResponse<null>>(
      `/api/lost-found/reports/${reportId}`,
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete report');
    }

    logger.info('report_deleted', { reportId });
  } catch (error) {
    logger.error('delete_report_error', { error, reportId });
    throw error;
  }
};

/**
 * Search reports by location
 */
export const searchReports = async (query: {
  latitude: number;
  longitude: number;
  radiusKm: number;
  reportType?: 'lost' | 'found';
  species?: string;
}): Promise<LostFoundReport[]> => {
  try {
    const params = new URLSearchParams();
    params.append('latitude', String(query.latitude));
    params.append('longitude', String(query.longitude));
    params.append('radiusKm', String(query.radiusKm));
    if (query.reportType) params.append('reportType', query.reportType);
    if (query.species) params.append('species', query.species);

    const response = await apiClient.get<
      ApiResponse<{
        location: { latitude: number; longitude: number };
        radiusKm: number;
        reports: LostFoundReport[];
        count: number;
      }>
    >(`/api/lost-found/search?${params.toString()}`);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to search reports');
    }

    return response.data.data?.reports || [];
  } catch (error) {
    logger.error('search_reports_error', { error });
    throw error;
  }
};

/**
 * Get matches for a report
 */
export const getMatches = async (reportId: string): Promise<LostFoundMatch[]> => {
  try {
    const response = await apiClient.get<
      ApiResponse<{
        reportId: string;
        matches: LostFoundMatch[];
        count: number;
      }>
    >(`/api/lost-found/reports/${reportId}/matches`);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get matches');
    }

    return response.data.data?.matches || [];
  } catch (error) {
    logger.error('get_matches_error', { error, reportId });
    throw error;
  }
};

/**
 * Confirm a match
 */
export const confirmMatch = async (matchId: string): Promise<void> => {
  try {
    const response = await apiClient.post<ApiResponse<null>>(
      `/api/lost-found/matches/${matchId}/confirm`,
      {},
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to confirm match');
    }

    logger.info('match_confirmed', { matchId });
  } catch (error) {
    logger.error('confirm_match_error', { error, matchId });
    throw error;
  }
};

/**
 * Get user's lost/found preferences
 */
export const getPreferences = async (): Promise<UserLostFoundPreferences> => {
  try {
    const response = await apiClient.get<ApiResponse<UserLostFoundPreferences>>(
      '/api/lost-found/preferences',
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get preferences');
    }

    return response.data.data!;
  } catch (error) {
    logger.error('get_preferences_error', { error });
    throw error;
  }
};

/**
 * Update user's lost/found preferences
 */
export const updatePreferences = async (
  updates: Partial<UserLostFoundPreferences>,
): Promise<UserLostFoundPreferences> => {
  try {
    const response = await apiClient.put<ApiResponse<UserLostFoundPreferences>>(
      '/api/lost-found/preferences',
      updates,
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to update preferences');
    }

    logger.info('preferences_updated');
    return response.data.data!;
  } catch (error) {
    logger.error('update_preferences_error', { error });
    throw error;
  }
};
