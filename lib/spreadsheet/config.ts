export const CONFIG = {
  ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY || '',
  SHEET_ID: process.env.SHEET_ID || '',
  RPC_URL: process.env.RPC_URL || 'https://eth.llamarpc.com',
  RANGES: {
    TIMELOCKS: 'Timelocks!A2:Q200',
    WALLETS: 'Wallets!A2:E200'
  },
}

export type WalletData = {
  entity: string
  name: string
  address: string
  balance: number
}

export type TimelockData = {
  address: string
  amount: number
  unlockTime: number
  status: string
} 