import { AdminAuditLog } from '../models/AdminAuditLog';

/**
 * Tulis log audit untuk setiap aksi admin (CONTRACT §4).
 * Gagal menulis audit tidak boleh menggagalkan aksi admin itu sendiri.
 */
export async function audit(
  adminUserId: string,
  action: string,
  targetType: string,
  targetId: string,
  detail: string,
): Promise<void> {
  try {
    await AdminAuditLog.create({ adminUserId, action, targetType, targetId, detail });
  } catch (err) {
    console.error('Gagal menulis audit log:', err);
  }
}
