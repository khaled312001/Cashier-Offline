/**
 * Vendor key generation — run ONCE.
 *   npm run license:keygen
 * Produces:
 *   tools/license-cli/keys/license_private.pem   (KEEP SECRET — never ship/commit)
 *   resources/keys/license_public.pem            (embedded in the app for verification)
 */
import { generateKeyPairSync } from 'node:crypto'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const privDir = join(here, 'keys')
const pubDir = join(repoRoot, 'resources', 'keys')

const privPath = join(privDir, 'license_private.pem')
const pubPath = join(pubDir, 'license_public.pem')

if (existsSync(privPath)) {
  console.error('⚠️  المفتاح الخاص موجود بالفعل:', privPath)
  console.error('احذفه يدويًا أولاً إذا كنت تريد توليد زوج جديد (سيُبطل كل التراخيص القديمة).')
  process.exit(1)
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
const pubPem = publicKey.export({ type: 'spki', format: 'pem' }) as string

mkdirSync(privDir, { recursive: true })
mkdirSync(pubDir, { recursive: true })
writeFileSync(privPath, privPem)
writeFileSync(pubPath, pubPem)

console.log('✅ تم توليد زوج المفاتيح (Ed25519)')
console.log('   المفتاح الخاص (سري):', privPath)
console.log('   المفتاح العام (داخل التطبيق):', pubPath)
