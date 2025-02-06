import type { NextApiRequest, NextApiResponse } from 'next'
import { google } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
const SHEET_ID = '1V-mkxRzMPKLOiXUT4AKGdTdseCySB5MDeeR6E2VDVeI'
const RANGE = 'Circ supply!B2:B10'

export async function getAuthClient() {
  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.PROJECT_ID) {
    throw new Error('Missing Google credentials')
  }

  try {
    const auth = new google.auth.GoogleAuth({
      scopes: SCOPES,
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY,
        project_id: process.env.PROJECT_ID
      }
    })
    return auth
  } catch (error) {
    console.error('Error creating auth client:', error)
    throw new Error('Invalid credentials format')
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const auth = await getAuthClient()
    const sheets = google.sheets({ version: 'v4', auth })
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: RANGE,
    })

    if (!response.data.values) {
      throw new Error('No data received from spreadsheet')
    }

    console.log('Spreadsheet response:', response.data.values)

    // Get total supply (first row)
    const totalSupply = response.data.values[0]?.[0]
      ? Number(response.data.values[0][0].replace(/,/g, ''))
      : null

    // Get circulating supply (last row)
    const circulatingSupply = response.data.values[8]?.[0]
      ? Number(response.data.values[8][0].replace(/,/g, ''))
      : null

    if (!totalSupply || !circulatingSupply) {
      throw new Error('Missing required supply values')
    }

    res.status(200).json({
      total_supply: totalSupply,
      circulating_supply: circulatingSupply
    })
  } catch (error) {
    console.error('Error details:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch supply data' })
  }
} 