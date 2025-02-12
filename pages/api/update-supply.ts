import type { NextApiRequest, NextApiResponse } from 'next'
import { updateSpreadsheet } from '../../lib/spreadsheet/update'
import { testApiKey } from '../../lib/spreadsheet/etherscan'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Test API key first
    await testApiKey()
    // Then proceed with update
    await updateSpreadsheet()
    res.status(200).json({ success: true })
  } catch (error) {
    console.error('Update error:', error)
    res.status(500).json({ error: 'Failed to update supply data' })
  }
} 