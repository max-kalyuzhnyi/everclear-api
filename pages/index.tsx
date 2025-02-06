import { useEffect, useState } from 'react'

export default function Home() {
  const [data, setData] = useState<{total_supply: number, circulating_supply: number} | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/supply')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch data')
        return res.json()
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  if (!data) return <div>No data available</div>

  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">Token Supply Data</h1>
      <div className="space-y-2">
        <p>Total Supply: {data.total_supply?.toLocaleString() ?? 'N/A'}</p>
        <p>Circulating Supply: {data.circulating_supply?.toLocaleString() ?? 'N/A'}</p>
      </div>
    </div>
  )
} 