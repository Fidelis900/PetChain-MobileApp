/**
 * Audit log model — captures important actions for compliance and traceability.
 */

export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'pet.created'
  | 'pet.updated'
  | 'pet.deleted'
  | 'medical_record.created'
  | 'medical_record.updated'
  | 'medical_record.deleted'
  | 'medical_record.accessed'
  | 'appointment.created'
  | 'appointment.updated'
  | 'appointment.deleted'
  | 'medication.created'
  | 'medication.updated'
  | 'medication.deleted';

export type AuditResourceType = 'user' | 'pet' | 'medical_record' | 'appointment' | 'medication';

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  meta?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface AuditLogQuery {
  actorId?: string;
  action?: AuditAction;
  resourceType?: AuditResourceType;
  resourceId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}
