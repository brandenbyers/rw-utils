import { promises as fs } from 'fs'
import path from 'node:path'
import { Roast } from '../types/roast'
import * as S from '@fp-ts/schema'

// INPUT_DATA_DIR="" \
// npx ts-node bin/validateRoastData.ts

const dir = process.env.INPUT_DATA_DIR ?? ''

;(async () => {
  const start = parseInt(`${Date.now() / 1000}`)
  const filePaths = await fs.readdir(dir)
  await fs.mkdir('temp', { recursive: true })
  await fs.mkdir(`temp/valid-roasts-${start}`, { recursive: true })
  const roasts = (
    await Promise.all(
      filePaths.map(async (filePath) => {
        const fullPath = path.join(dir, filePath)
        const data = JSON.parse(await fs.readFile(fullPath, 'utf-8'))
        const validRoast = S.decode(Roast)(data, {
          isUnexpectedAllowed: true,
          allErrors: true,
        })
        if (S.isFailure(validRoast)) {
          // only log if not a 404 error response
          if (validRoast.left.length < 29) {
            console.log('\n\n-----------------------------')
            console.log(fullPath)
            console.log(JSON.stringify(validRoast.left, null, 2))
          }
          return false
        }
        if (S.isSuccess(validRoast)) {
          await fs.writeFile(
            `temp/valid-roasts-${start}/${filePath}`,
            JSON.stringify(validRoast.right),
            'utf-8'
          )
          return true
        }
      })
    )
  ).filter((result) => {
    return result
  })
  console.log('total roasts:', filePaths.length)
  console.log('total valid roasts:', roasts.length)
})()
