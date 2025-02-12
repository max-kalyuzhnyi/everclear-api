import axios from 'axios'
import { CONFIG } from './config'
import pThrottle from 'p-throttle'
import { ethers } from 'ethers'
import { providers, Contract } from 'ethers'

interface EtherscanResponse {
  status: string
  message: string
  result: string
}

interface EtherscanABIResponse {
  status: string
  message: string
  result: string  // ABI string
}

interface ContractMethod {
  name: string
  inputs: { type: string }[]
  outputs: { type: string }[]
  stateMutability: string
}

// More conservative throttling
const throttle = pThrottle({
  limit: 2,  // Reduced from 4 to 2
  interval: 2000,  // Increased from 1200 to 2000ms
  strict: true
})

export const throttledApiCall = throttle(async (url: string, options?: { headers?: Record<string, string> }) => {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
        ...options?.headers
      },
      timeout: 10000
    })
    await new Promise(resolve => setTimeout(resolve, 500))
    return response
  } catch (error: any) {
    if (error?.response) {
      console.error('API call failed:', error.response.data || error.message)
    } else if (error instanceof Error) {
      console.error('API call failed:', error.message)
    } else {
      console.error('API call failed with unknown error:', error)
    }
    throw error
  }
})

export async function testApiKey() {
  const url = `https://api.etherscan.io/api?module=account&action=balance&address=0x0000000000000000000000000000000000000000&tag=latest&apikey=${CONFIG.ETHERSCAN_API_KEY}`
  
  try {
    const response = await axios.get(url)
    console.log('API Key Test Response:', response.data)
    return response.data
  } catch (error: any) {
    if (error?.response) {
      console.error('API Key Test Error:', error.response.data || error.message)
    } else if (error instanceof Error) {
      console.error('API Key Test Error:', error.message)
    } else {
      console.error('API Key Test Error:', error)
    }
    throw error
  }
}

export async function getWalletBalance(address: string): Promise<string> {
  const url = `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${CONFIG.ETHERSCAN_API_KEY}`
  
  const response = await axios.get<EtherscanResponse>(url)
  if (response.data.status !== '1') {
    throw new Error(`Etherscan API error: ${response.data.message}`)
  }
  
  return response.data.result
}

async function getContractABI(address: string): Promise<string> {
  const url = `https://api.etherscan.io/api?module=contract&action=getabi&address=${address}&apikey=${CONFIG.ETHERSCAN_API_KEY}`
  const response = await throttledApiCall(url)

  // Type assertion for response data
  const data = response.data as EtherscanABIResponse

  if (data.status === '1' && data.result) {
    return data.result
  }
  throw new Error(`Failed to get ABI for ${address}: ${data.message}`)
}

export async function getContractData(address: string, methodName: string, params: any[] = []): Promise<string> {
  try {
    // Get contract ABI
    const abiString = await getContractABI(address)
    const abi = JSON.parse(abiString)
    
    // Create provider
    const provider = new providers.JsonRpcProvider(CONFIG.RPC_URL)
    
    // Create contract instance
    const contract = new Contract(address, abi, provider)
    
    // Call the method
    console.log(`Calling ${methodName} for ${address}`)
    
    // Check if method exists
    if (typeof contract.functions[methodName] !== 'function') {
      console.error(`Method ${methodName} not found in contract`)
      return '0'
    }

    // Call the method with proper parameters
    const result = await contract.functions[methodName](...params)
    
    // Result is usually returned as an array from functions
    const value = Array.isArray(result) ? result[0] : result
    console.log(`Got result for ${methodName}: ${value.toString()}`)
    return value.toString()
  } catch (error: any) {
    console.error(`Error calling ${methodName} for ${address}:`, error?.message || error)
    return '0'
  }
}

export async function getTokenBalance(walletAddress: string, tokenAddress: string): Promise<number | null> {
  try {
    const response = await throttledApiCall(`https://etherscan.io/token/${tokenAddress}?a=${walletAddress}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html',
        'Cache-Control': 'no-cache'
      }
    })

    const content = response.data as string
    const balanceMatch = 
      content.match(/Balance:\s*([\d,]+\.?\d*)\s/) ||
      content.match(/Balance\s*<[^>]*>\s*([\d,]+\.?\d*)\s/) ||
      content.match(/quantity">\s*([\d,]+\.?\d*)\s/);
    
    if (balanceMatch && balanceMatch[1]) {
      const balance = Number(balanceMatch[1].replace(/,/g, ''))
      console.log(`Found balance ${balance} for wallet ${walletAddress} token ${tokenAddress}`)
      return balance
    }
    
    console.log(`No balance match found in content for wallet ${walletAddress} token ${tokenAddress}`)
    return null
  } catch (error: any) {
    console.error(`Error fetching token balance for ${walletAddress}:`, error?.message || error)
    return null
  }
}

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))