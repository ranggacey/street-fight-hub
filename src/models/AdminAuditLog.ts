import mongoose, { Schema } from 'mongoose';

const adminAuditLogSchema = new Schema(
  {
    adminUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true },
    detail: { type: String, default: '' },
  },
  { timestamps: true },
);

export const AdminAuditLog =
  mongoose.models.AdminAuditLog || mongoose.model('AdminAuditLog', adminAuditLogSchema);
