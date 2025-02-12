import { google } from 'googleapis'
import { CONFIG } from './config'
import { getContractData, getTokenBalance, throttledApiCall } from './etherscan'

type SheetRow = [
  entity: string,        // Column A - Entity (e.g., "Routers", "KOLs", "Sybil")
  name: string,         // Column B - Wallet Name
  address: string,      // Column C - Timelock address
  totalToken: string,   // Column F - Total Token
  initBalance: string,  // Column G - Initial balance
  until: string,        // Column H - Until
  since: string,        // Column I - Since
  locked: string,       // Column Q - Locked (calculated)
  ...string[]          // Other columns
]

export async function updateSpreadsheet() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY,
      project_id: process.env.PROJECT_ID
    }
  })

  const sheets = google.sheets({ version: 'v4', auth })

  // First update Timelocks
  await updateTimelocks(sheets)
  
  // Then update Wallets
  await updateWallets(sheets)
}

async function updateWallets(sheets: any) {
  console.log('Starting Wallets update...')
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: CONFIG.SHEET_ID,
    range: 'Wallets!A1:F',
  })

  const rows = response.data.values
  if (!rows || rows.length === 0) {
    console.error('No data found in Wallets sheet')
    return
  }

  console.log(`Found ${rows.length} rows in Wallets sheet`)

  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row[2] || !row[4]) {
      console.log(`Skipping row ${i + 1}: insufficient data`, row)
      continue
    }

    const walletAddress = row[2].toString().trim()
    const tokenAddress = row[4].toString().trim()
    console.log(`Processing row ${i + 1}: wallet ${walletAddress} for token ${tokenAddress}`)

    try {
      const balance = await getTokenBalance(walletAddress, tokenAddress)
      console.log(`Got balance for ${walletAddress}: ${balance}`)
      if (balance !== null) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: CONFIG.SHEET_ID,
          range: `Wallets!F${i + 1}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[balance]]
          }
        })
      }
    } catch (error) {
      console.error(`Error processing wallet ${walletAddress}:`, error)
    }
  }
}

async function updateTimelocks(sheets: any) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: CONFIG.SHEET_ID,
    range: CONFIG.RANGES.TIMELOCKS,
  })

  const rows = response.data.values
  if (!rows || rows.length === 0) {
    console.error('No data found in sheet')
    return
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row[2]) {
      console.log(`Skipping row ${i + 2}: no address`)
      continue
    }
    
    const contractAddress = row[3]?.toString().split('#')[0]
    const contractType = Number(row[2])
    const tokenAddress = row[5]?.toString().trim()
    if (!contractAddress || !tokenAddress) continue

    try {
      console.log(`Processing row ${i + 2}: type ${contractType}, address ${contractAddress}, token ${tokenAddress}`)
      switch (contractType) {
        case 1: // New type (TOTAL_AMOUNT + vestedAmount)
          console.log(`Processing type 1 contract at ${contractAddress}`)
          const totalAmount = await getContractData(contractAddress, 'TOTAL_AMOUNT')
          const currentTime = Math.floor(Date.now() / 1000)
          const vestedAmount = await getContractData(contractAddress, 'vestedAmount', [currentTime])
          
          await sheets.spreadsheets.values.update({
            spreadsheetId: CONFIG.SHEET_ID,
            range: `Timelocks!G${i + 2}:H${i + 2}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[
                Number(totalAmount) / 1e18,
                Number(vestedAmount) / 1e18
              ]]
            }
          })
          break

        case 2: // Timelock with methods
          console.log(`Processing type 2 contract at ${contractAddress}`)
          const initialBalance = await getContractData(contractAddress, 'initialBalance')
          const totalToken = await getContractData(contractAddress, 'totalToken')
          const remainingTime = await getContractData(contractAddress, 'remainingTime')
          const timeSinceStart = await getContractData(contractAddress, 'timeSinceStart')
          
          await sheets.spreadsheets.values.update({
            spreadsheetId: CONFIG.SHEET_ID,
            range: `Timelocks!G${i + 2}:J${i + 2}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[
                Number(totalToken) / 1e18,
                Number(initialBalance) / 1e18,
                Number(remainingTime),
                Number(timeSinceStart)
              ]]
            }
          })
          break

        case 3: // Regular token holding contract
          console.log(`Processing type 3 contract at ${contractAddress}`)
          const balance = await getTokenBalance(contractAddress, tokenAddress)
          if (balance !== null) {
            await sheets.spreadsheets.values.update({
              spreadsheetId: CONFIG.SHEET_ID,
              range: `Timelocks!G${i + 2}`,
              valueInputOption: 'USER_ENTERED',
              requestBody: {
                values: [[balance]]
              }
            })
          }
          break

        default:
          console.log(`Unknown contract type ${contractType} for ${contractAddress}`)
      }
    } catch (error) {
      console.error(`Error processing contract ${contractAddress} in row ${i + 2}:`, error)
    }
  }
} 