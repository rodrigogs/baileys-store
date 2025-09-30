import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const targetDir = resolve('lib-cjs')
const packageJsonPath = resolve(targetDir, 'package.json')

mkdirSync(targetDir, { recursive: true })

const pkg = { type: 'commonjs' }
writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, { encoding: 'utf8' })
