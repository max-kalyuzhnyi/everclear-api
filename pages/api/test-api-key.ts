import type { NextApiRequest, NextApiResponse } from 'next'
import { testApiKey } from '../../lib/spreadsheet/etherscan'  // Need to export the function first

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const result = await testApiKey()
    res.status(200).json(result)
  } catch (error) {
    res.status(500).json({ error: 'Failed to test API key' })
  }
} 