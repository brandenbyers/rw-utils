import { promises as fs } from 'fs'
import { fetch } from 'undici'
import { Convert as ConvertRoastSearchResults } from '../types/search'
import { Convert as ConvertRoastData } from '../types/roast'

// INPUT_RESULT_PATHS="" \
// npx ts-node bin/getRoastIdFromSearchResults.ts

const resultPaths = (process.env.INPUT_RESULT_PATHS ?? '').split(',')

;(async () => {
  const start = parseInt(`${Date.now() / 1000}`)
  // TODO fetch search results if no paths provided
  const roastUrlsAndIds = (
    (await Promise.all(
      resultPaths.map(async (path) => {
        const results = ConvertRoastSearchResults.toRoastSearchResults(
          await fs.readFile(path, 'utf-8')
        )
        const hits = results?.hits?.hits ?? []
        const urlsAndIds = hits.map((hit) => {
          return [hit._source?.url, hit._id]
        })
        return urlsAndIds
      })
    )) ?? []
  ).flat()

  console.log('total roasts:', roastUrlsAndIds.length)

  await fs.mkdir('temp', { recursive: true })
  await fs.mkdir(`temp/roasts-${start}`, { recursive: true })

  const roastFetchResults = await roastUrlsAndIds.reduce(
    async (acc, urlAndId): Promise<{ success: string[]; errors: string[] }> => {
      const resultsObject = await acc
      try {
        const roastResponse = await fetch(urlAndId[0] ?? '')
        const json = (await roastResponse.json()) as {}
        const roastData = JSON.stringify(json)
        // const convertedJson = ConvertRoastData.toRoastData(json)
        // const roastData = JSON.stringify(convertedJson)
        await fs.writeFile(
          `temp/roasts-${start}/${urlAndId[1]}.json`,
          roastData,
          'utf-8'
        )
        return {
          ...resultsObject,
          success: [...resultsObject.success, `${roastData.length}`],
        }
      } catch (error) {
        console.log('error', error)
        return {
          ...resultsObject,
          errors: [...resultsObject.errors, error as string],
        }
      }
    },
    Promise.resolve({
      success: [],
      errors: [],
    } as { success: string[]; errors: string[] })
  )
  console.log(roastFetchResults)
})()
