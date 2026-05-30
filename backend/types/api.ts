/**
 * Generic API response wrapper for successful responses
 */
export interface ApiResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

/**
 * Generic API error response
 */
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    stack?: string;
  };
  timestamp: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T = any> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
  timestamp: string;
}

/**
 * Pagination request parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Authentication - Login Request
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Authentication - Login Response
 */
export interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  token: string;
  refreshToken?: string;
  expiresIn: number;
}

/**
 * Authentication - Register Request
 */
export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
  phone?: string;
  role?: string;
}

/**
 * Authentication - Register Response
 */
export interface RegisterResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  token: string;
  refreshToken?: string;
}

/**
 * Authentication - Refresh Token Request
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Authentication - Refresh Token Response
 */
export interface RefreshTokenResponse {
  token: string;
  refreshToken?: string;
  expiresIn: number;
}

/**
 * User - Get User Response
 */
export interface GetUserResponse {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  pets: Array<{
    id: string;
    name?: string;
  }>;
  createdAt: string;
  updatedAt: string;
  isEmailVerified: boolean;
  lastLoginAt?: string;
}

/**
 * User - Update User Request
 */
export interface UpdateUserRequest {
  name?: string;
  phone?: string;
  role?: string;
}

/**
 * User - Update User Response
 */
export interface UpdateUserResponse {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  updatedAt: string;
}

/**
 * User - List Users Request
 */
export interface ListUsersRequest extends PaginationParams {
  role?: string;
  search?: string;
}

/**
 * Pet - Create Pet Request
 */
export interface CreatePetRequest {
  name: string;
  species: string;
  breed?: string;
  dateOfBirth?: string;
  microchipId?: string;
  photoUrl?: string;
  ownerId: string;
}

/**
 * Pet - Create Pet Response
 */
export interface CreatePetResponse {
  id: string;
  name: string;
  species: string;
  breed?: string;
  dateOfBirth?: string;
  microchipId?: string;
  photoUrl?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Pet - Get Pet Response
 */
export interface GetPetResponse {
  id: string;
  name: string;
  species: string;
  breed?: string;
  dateOfBirth?: string;
  microchipId?: string;
  photoUrl?: string;
  ownerId: string;
  owner?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Pet - Update Pet Request
 */
export interface UpdatePetRequest {
  name?: string;
  species?: string;
  breed?: string;
  dateOfBirth?: string;
  microchipId?: string;
  photoUrl?: string;
}

/**
 * Pet - List Pets Request
 */
export interface ListPetsRequest extends PaginationParams {
  ownerId?: string;
  species?: string;
  search?: string;
}

/**
 * Medical Record - Create Medical Record Request
 */
export interface CreateMedicalRecordRequest {
  petId: string;
  vetId: string;
  type: 'checkup' | 'vaccination' | 'surgery' | 'treatment' | 'other';
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  visitDate: string;
  nextVisitDate?: string;
}

/**
 * Medical Record - Create Medical Record Response
 */
export interface CreateMedicalRecordResponse {
  id: string;
  petId: string;
  vetId: string;
  type: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  visitDate: string;
  nextVisitDate?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Medical Record - Get Medical Record Response
 */
export interface GetMedicalRecordResponse {
  id: string;
  petId: string;
  vetId: string;
  vet?: {
    id: string;
    name: string;
    email: string;
  };
  type: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  visitDate: string;
  nextVisitDate?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Medical Record - List Medical Records Request
 */
export interface ListMedicalRecordsRequest extends PaginationParams {
  petId?: string;
  vetId?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Waitlist - Join Waitlist Request
 */
export interface JoinWaitlistRequest {
  vetId: string;
  petId: string;
  preferredDateStart: string;
  preferredDateEnd: string;
}

/**
 * Waitlist - Waitlist Entry (API shape)
 */
export interface WaitlistEntryDto {
  id: string;
  userId: string;
  vetId: string;
  petId: string;
  preferredDateStart: string;
  preferredDateEnd: string;
  status: 'WAITING' | 'NOTIFIED' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  position: number;
  estimatedWaitMinutes: number;
  notifiedAt: string | null;
  acceptanceDeadline: string | null;
  appointmentId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Waitlist - Accept Slot Request
 */
export interface AcceptWaitlistSlotRequest {
  appointmentId: string;
}

/**
 * Waitlist - Position Info Response
 */
export interface WaitlistPositionResponse {
  entryId: string;
  position: number;
  estimatedWaitMinutes: number;
  status: string;
}

/**
 * Blockchain - Store Record Request
 */
export interface StoreRecordRequest {
  recordId: string;
  hash: string;
  metadata?: Record<string, unknown>;
}

/**
 * Blockchain - Store Record Response
 */
export interface StoreRecordResponse {
  hash: string;
  txHash: string;
  successful: boolean;
  ledger?: number;
  createdAt?: string;
  sourceAccount?: string;
  feeCharged?: string;
  memo?: string;
  operationCount?: number;
}

/**
 * Blockchain - Verify Record Request
 */
export interface VerifyRecordRequest {
  recordId: string;
  hash: string;
}

/**
 * Blockchain - Verify Record Response
 */
export interface VerifyRecordResponse {
  verified: boolean;
  onChainHash?: string;
  recordId: string;
  ledger?: number;
  txHash?: string;
  timestamp?: string;
}

/**
 * Blockchain - Retrieve Record Hash Response
 */
export interface RetrieveRecordHashResponse {
  hash: string;
  txHash: string;
  timestamp: string;
  ledger?: number;
}

/**
 * Blockchain - Transaction History Request
 */
export interface TransactionHistoryRequest {
  recordId?: string;
  accountId?: string;
  limit?: number;
}

/**
 * Blockchain - Transaction History Response
 */
export interface TransactionHistoryResponse {
  hash: string;
  successful: boolean;
  ledger?: number;
  createdAt?: string;
  sourceAccount?: string;
  feeCharged?: string;
  memo?: string;
  operationCount?: number;
}

/**
 * Blockchain - Network Info Response
 */
export interface NetworkInfoResponse {
  network: string;
  horizonUrl: string;
  passphrase: string;
  currentLedger: number;
  latestLedger: number;
}

/**
 * Blockchain - Batch Verify Request
 */
export interface BatchVerifyRequest {
  records: Array<{
    recordId: string;
    hash: string;
  }>;
}

/**
 * Blockchain - Batch Verify Response
 */
export interface BatchVerifyResponse {
  verified: boolean;
  onChainHash?: string;
  recordId: string;
  ledger?: number;
  txHash?: string;
  timestamp?: string;
}

/**
 * API Endpoint paths
 */
export const API_ENDPOINTS = {
  // Authentication
  AUTH_LOGIN: '/auth/login',
  AUTH_REGISTER: '/auth/register',
  AUTH_REFRESH: '/auth/refresh',
  AUTH_LOGOUT: '/auth/logout',
  AUTH_VERIFY_EMAIL: '/auth/verify-email',
  AUTH_FORGOT_PASSWORD: '/auth/forgot-password',
  AUTH_RESET_PASSWORD: '/auth/reset-password',

  // Users
  USERS_LIST: '/users',
  USERS_GET: '/users/:id',
  USERS_CREATE: '/users',
  USERS_UPDATE: '/users/:id',
  USERS_DELETE: '/users/:id',
  USERS_ME: '/users/me',

  // Pets
  PETS_LIST: '/pets',
  PETS_GET: '/pets/:id',
  PETS_CREATE: '/pets',
  PETS_UPDATE: '/pets/:id',
  PETS_DELETE: '/pets/:id',
  PETS_BY_OWNER: '/pets/owner/:ownerId',

  // Medical Records
  MEDICAL_RECORDS_LIST: '/medical-records',
  MEDICAL_RECORDS_GET: '/medical-records/:id',
  MEDICAL_RECORDS_CREATE: '/medical-records',
  MEDICAL_RECORDS_UPDATE: '/medical-records/:id',
  MEDICAL_RECORDS_DELETE: '/medical-records/:id',
  MEDICAL_RECORDS_BY_PET: '/medical-records/pet/:petId',

  // Waitlist
  WAITLIST_JOIN: '/waitlist',
  WAITLIST_LEAVE: '/waitlist/:id',
  WAITLIST_ACCEPT: '/waitlist/:id/accept',
  WAITLIST_MY_ENTRIES: '/waitlist/me',
  WAITLIST_POSITION: '/waitlist/:id/position',
  WAITLIST_VET_QUEUE: '/waitlist/vet/:vetId',

  // Blockchain
  BLOCKCHAIN_RECORDS_VERIFY: '/blockchain/records/verify',
  BLOCKCHAIN_RECORDS_STORE: '/blockchain/records/store',
  BLOCKCHAIN_RECORDS_RETRIEVE: '/blockchain/records/:id/hash',
  BLOCKCHAIN_RECORDS_BATCH_VERIFY: '/blockchain/records/batch-verify',
  BLOCKCHAIN_TRANSACTIONS_GET: '/blockchain/transactions/:txHash',
  BLOCKCHAIN_TRANSACTIONS_HISTORY: '/blockchain/transactions/history',
  BLOCKCHAIN_NETWORK_INFO: '/blockchain/network/info',
} as const;

/**
 * HTTP Methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * API Request configuration
 */
export interface ApiRequestConfig {
  method: HttpMethod;
  endpoint: string;
  params?: Record<string, any>;
  data?: any;
  headers?: Record<string, string>;
}

/**
 * Type guard to check if response is an error
 */
export function isApiError(response: ApiResponse | ApiError): response is ApiError {
  return response.success === false;
}

/**
 * Type guard to check if response is paginated
 */
export function isPaginatedResponse<T>(
  response: ApiResponse<T> | PaginatedResponse<T>,
): response is PaginatedResponse<T> {
  return 'pagination' in response;
}
