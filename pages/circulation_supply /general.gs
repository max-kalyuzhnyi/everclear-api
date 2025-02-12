function updateFirst114Rows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Timelocks');
  const data = sheet.getDataRange().getValues();
  
  // Process first 15 rows (skip header)
  for (let i = 1; i < 114; i++) {
    const contractAddress = data[i][2].split('#')[0]; // Remove any #tokentxns
    Logger.log(`Processing row ${i + 1}, address: ${contractAddress}`);
    
    if (!contractAddress) {
      Logger.log(`Empty address in row ${i + 1}, skipping`);
      continue;
    }
    
    try {
      const implAddress = getImplementationAddress(contractAddress);
      const address = implAddress || contractAddress;
      Utilities.sleep(300);

      // Special handling for first two rows
      if (i <= 2) {
        const totalAmount = getContractData(address, 'TOTAL_AMOUNT');
        const unlockStart = getContractData(address, 'UNLOCK_START');
        const unlockEnd = getContractData(address, 'UNLOCK_END');
        
        const formattedTotal = Number(totalAmount) / (10 ** 18);
        
        sheet.getRange(i + 1, 6).setValue(formattedTotal);     // Column F - TOTAL_AMOUNT
        sheet.getRange(i + 1, 8).setValue(Number(String(unlockStart).slice(0, 8))); // Column H - UNLOCK_START
        sheet.getRange(i + 1, 9).setValue(Number(String(unlockEnd).slice(0, 8)));  // Column I - UNLOCK_END
        
        continue;
      }

      // For other rows, try initialBalance first
      try {
        const initialBalance = getContractData(address, 'initialBalance');
        if (initialBalance && Number(initialBalance) > 0) {
          // If initialBalance exists and > 0, use it for column G
          const formattedInitial = Number(initialBalance) / (10 ** 18);
          sheet.getRange(i + 1, 7).setValue(formattedInitial);  // Column G - initialBalance
        } else {
          // Only if initialBalance is 0 or doesn't exist, try totalToken
          const totalToken = getContractData(address, 'totalToken');
          if (totalToken && Number(totalToken) > 0) {
            const formattedTotal = Number(totalToken) / (10 ** 18);
            sheet.getRange(i + 1, 6).setValue(formattedTotal);  // Column F - totalToken
          }
        }
      } catch (error) {
        Logger.log(`Error getting balance for row ${i + 1}: ${error}`);
      }

      // For non-first-2 rows, get remainingTime
      try {
        const remainingTime = getContractData(address, 'remainingTime');
        const formattedRemaining = String(Number(remainingTime)).slice(0, 8);
        sheet.getRange(i + 1, 8).setValue(Number(formattedRemaining));  // Column H - remainingTime
      } catch (timeError) {
        Logger.log(`Could not get remainingTime for row ${i + 1}: ${timeError}`);
      }
      
    } catch (error) {
      Logger.log(`Error processing row ${i + 1}: ${error}`);
      continue;
    }
  }
}

function getContractData(address, functionName) {
  const METHODS = {
    'TOTAL_AMOUNT': [{
      selector: '0x1a39d8ef000000000000000000000000000000000000000000000000000000000000000000',
      name: 'TOTAL_AMOUNT'
    }],
    'UNLOCK_START': [{
      selector: '0x22a6423c000000000000000000000000000000000000000000000000000000000000000000',
      name: 'UNLOCK_START'
    }],
    'UNLOCK_END': [{
      selector: '0x1f86c9b7000000000000000000000000000000000000000000000000000000000000000000',
      name: 'UNLOCK_END'
    }],
    'initialBalance': [{
      selector: '0x118c4633000000000000000000000000000000000000000000000000000000000000000000',
      name: 'initialBalance'
    }],
    'totalToken': [{
      selector: '0x626be567000000000000000000000000000000000000000000000000000000000000000000',
      name: 'totalToken'
    }],
    'remainingTime': [
      {
        selector: '0xacc4bd08000000000000000000000000000000000000000000000000000000000000000000',
        name: 'remainingTime'
      },
      {
        selector: '0x01c30162000000000000000000000000000000000000000000000000000000000000000000',
        name: 'remainingTime'
      },
      {
        selector: '0x7fd9c148000000000000000000000000000000000000000000000000000000000000000000',
        name: 'remainingTime'
      },
      {
        selector: '0xc1a287e2000000000000000000000000000000000000000000000000000000000000000000',
        name: 'remainingTime'
      },
      {
        selector: '0x5e27c56f000000000000000000000000000000000000000000000000000000000000000000',
        name: 'remainingTime'
      },
      {
        selector: '0xae8ab773000000000000000000000000000000000000000000000000000000000000000000',
        name: 'remainingTime'
      },
      {
        selector: '0xfBd3AF6F000000000000000000000000000000000000000000000000000000000000000000',
        name: 'remainingTime'
      }
    ]
  };

  // Try each method until one works
  for (const method of METHODS[functionName]) {
    try {
      const url = encodeURI(`https://api.etherscan.io/api` +
        `?module=proxy` +
        `&action=eth_call` +
        `&to=${address}` +
        `&data=${method.selector}` +
        `&tag=latest` +
        `&apikey=${ETHERSCAN_API_KEY}`);
        
      const options = {
        method: 'GET',
        muteHttpExceptions: true,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'User-Agent': 'Mozilla/5.0'
        }
      };
        
      const response = UrlFetchApp.fetch(url, options);
      const responseText = response.getContentText();
      
      // Handle HTML response and rate limits
      if (responseText.trim().startsWith('<') || responseText.includes('rate limit')) {
        Logger.log(`Rate limit or HTML response for ${method.name}, waiting...`);
        Utilities.sleep(3000);
        continue;
      }
      
      const result = JSON.parse(responseText);
      
      if (result.result && !result.error) {
        const value = BigInt(result.result).toString();
        Logger.log(`Success with method ${method.name} for ${address}`);
        Utilities.sleep(300);
        return value;
      }
      
      Logger.log(`Method ${method.name} failed for ${address}: ${JSON.stringify(result)}`);
      Utilities.sleep(300);
    } catch (error) {
      if (error.toString().includes('rate limit')) {
        Logger.log(`Rate limit hit for ${method.name}, waiting...`);
        Utilities.sleep(3000);
        continue;
      }
      Logger.log(`Error trying ${method.name} for ${address}: ${error}`);
      Utilities.sleep(300);
      continue;
    }
  }
  
  Utilities.sleep(3000);
  throw new Error(`All methods failed for ${functionName} on ${address}`);
}

// Add menu item
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Timelock Data Vol2')
    .addItem('Update First 15 Rows', 'updateFirst15Rows')
    .addToUi();
} 