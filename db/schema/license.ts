import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'

/**
 * Mirror of the verified license state for fast UI reads.
 * This row is NOT trusted for enforcement — the license.service always
 * re-reads and re-verifies the signed file on disk.
 */
export const licenseState = sqliteTable('license_state', {
  id: integer('id').primaryKey(), // singleton, always 1
  customerId: text('customer_id'),
  customerName: text('customer_name'),
  licenseType: text('license_type'), // trial | monthly | annual | perpetual
  issuedAt: integer('issued_at'),
  expiresAt: integer('expires_at'),
  machineId: text('machine_id'),
  featuresJson: text('features_json'),
  status: text('status'), // active | expired | grace | invalid | trial | none
  activatedAt: integer('activated_at'),
  lastVerifiedAt: integer('last_verified_at'),
  trialStartedAt: integer('trial_started_at'),
  rawLicense: text('raw_license')
})
