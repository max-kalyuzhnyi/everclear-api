import type { NextApiRequest, NextApiResponse } from 'next'
import { updateSpreadsheet } from '../../../lib/spreadsheet/update'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify the request is from Vercel Cron
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    await updateSpreadsheet()
    res.status(200).json({ success: true })
  } catch (error) {
    console.error('Cron update error:', error)
    res.status(500).json({ error: 'Failed to update supply data' })
  }
} 