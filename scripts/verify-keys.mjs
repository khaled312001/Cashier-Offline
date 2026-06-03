/**
 * Pre-build license-key guard.
 *
 * Catastrophe this prevents: regenerating the Ed25519 key pair after the first
 * release silently invalidates EVERY customer license (the embedded public key
 * no longer matches the private key used by the License Manager). This script
 * fails the build if:
 *   1) the embedded public key is missing or not a valid Ed25519 SPKI key, OR
 *   2) the embedded public key changed vs the recorded fingerprint, OR
 *   3) (when the private key is present locally) the pair fails a sign/verify
 *      round-trip — i.e. the public key does NOT match the private key.
 *
 * Runs automatically before `npm run dist`. After the FIRST real release, the
 * recorded fingerprint locks the public key — never delete it, never run
 * `npm run license:keygen` again on a shipped product.
 */
import { createPublicKey, createPrivateKey, sign as edSign, verify as edVerify, createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pubPath = join(root, 'resources', 'keys', 'license_public.pem')
const fpPath = join(root, 'resources', 'keys', 'license_public.fingerprint')
const privPath = join(root, 'tools', 'license-cli', 'keys', 'license_private.pem')

function fail(msg) {
  console.error('\n❌ فشل التحقق من مفتاح الترخيص — تم إيقاف البناء:\n   ' + msg + '\n')
  process.exit(1)
}

// 1) Public key must exist and be a valid Ed25519 SPKI key.
if (!existsSync(pubPath)) fail('المفتاح العام مفقود: ' + pubPath)
let pubPem, pubKey
try {
  pubPem = readFileSync(pubPath, 'utf8')
  pubKey = createPublicKey(pubPem)
  if (pubKey.asymmetricKeyType !== 'ed25519') fail('المفتاح العام ليس من نوع Ed25519')
} catch (e) {
  fail('تعذّر قراءة المفتاح العام: ' + (e && e.message))
}

// 2) Fingerprint lock: the public key must not change between releases.
const fingerprint = createHash('sha256').update(pubPem.trim()).digest('hex')
if (existsSync(fpPath)) {
  const recorded = readFileSync(fpPath, 'utf8').trim()
  if (recorded && recorded !== fingerprint) {
    fail(
      'المفتاح العام تغيّر عن المُسجَّل! هذا سيُبطل كل تراخيص العملاء.\n' +
        '   المُسجَّل: ' + recorded.slice(0, 24) + '…\n' +
        '   الحالي : ' + fingerprint.slice(0, 24) + '…\n' +
        '   إن كان التغيير مقصودًا (قبل أول إصدار فقط) احذف الملف:\n   ' + fpPath
    )
  }
} else {
  // First run: record the fingerprint so future builds are locked to this key.
  writeFileSync(fpPath, fingerprint + '\n')
  console.log('🔒 تم تسجيل بصمة المفتاح العام لأول مرة:', fingerprint.slice(0, 24) + '…')
}

// 3) If the private key is available locally, prove the pair matches.
if (existsSync(privPath)) {
  try {
    const privKey = createPrivateKey(readFileSync(privPath, 'utf8'))
    if (privKey.asymmetricKeyType !== 'ed25519') fail('المفتاح الخاص ليس من نوع Ed25519')
    const probe = Buffer.from('barmagly-key-pair-check')
    const sig = edSign(null, probe, privKey)
    if (!edVerify(null, probe, pubKey, sig)) {
      fail('المفتاح الخاص والعام غير متطابقين — لا توقّع/تحقّق سليم.')
    }
    console.log('✅ زوج المفاتيح متطابق (sign/verify ناجح).')
  } catch (e) {
    fail('تعذّر التحقق من تطابق الزوج: ' + (e && e.message))
  }
} else {
  console.log('ℹ️  المفتاح الخاص غير موجود على هذا الجهاز — تم التحقق من المفتاح العام وبصمته فقط.')
}

console.log('✅ التحقق من مفتاح الترخيص ناجح. بصمة المفتاح:', fingerprint.slice(0, 16) + '…\n')
