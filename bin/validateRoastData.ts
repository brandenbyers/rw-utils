import { promises as fs } from 'fs'
import { Roast } from '../types/roastSchema'
import * as S from '@fp-ts/schema'

// INPUT_DATA_PATHS="" \
// npx ts-node bin/validateRoastData.ts

const dataPaths = (process.env.INPUT_DATA_PATHS ?? '').split(',')

;(async () => {
  const start = parseInt(`${Date.now() / 1000}`)
  const roasts = await Promise.all(
    dataPaths.map(async (path) => {
      // const convertedJson = ConvertRoastData.toRoastData(json)
      // const roastData = JSON.stringify(convertedJson)
      const data = await fs.readFile(path, 'utf-8')
      S.decode(Roast)(data)
      return data
    })
  )

  console.log(roasts)
  console.log('total roasts:', roasts.length)

  // await fs.mkdir('temp', { recursive: true })
  // await fs.mkdir(`temp/clean-roasts-${start}`, { recursive: true })
})()
