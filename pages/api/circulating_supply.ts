import type { NextApiRequest, NextApiResponse } from 'next'
import { google } from 'googleapis'
import { getAuthClient } from './supply'

const SHEET_ID = '1V-mkxRzMPKLOiXUT4AKGdTdseCySB5MDeeR6E2VDVeI'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const auth = await getAuthClient()
    const sheets = google.sheets({ version: 'v4', auth })
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Circ supply!B10',
    })

    const circulatingSupply = response.data.values?.[0]?.[0]
      ? Number(response.data.values[0][0].replace(/,/g, ''))
      : null

    if (!circulatingSupply) {
      throw new Error('Circulating supply value not found')
    }

    // Return plain text as required by CoinGecko
    res.setHeader('Content-Type', 'text/plain')
    res.status(200).send(circulatingSupply.toString())
  } catch (error) {
    console.error('Error details:', error)
    res.status(500).send('0')
  }
} 