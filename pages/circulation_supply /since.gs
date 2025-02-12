function updateTimeSinceStart() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Timelocks');
  const data = sheet.getDataRange().getValues();
  
  // Process first 15 rows (skip header)
  for (let i = 3; i < 114; i++) {
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

      // Skip first two rows
      if (i <= 2) continue;

      try {
        const timeSinceStart = getContractData(address, 'timeSinceStart'); 
        if (timeSinceStart === '0') {
          sheet.getRange(i + 1, 9).setValue('');
        } else {
          sheet.getRange(i + 1, 9).setValue(timeSinceStart);
        }
      } catch (timeError) {
        Logger.log(`Could not get timeSinceStart for row ${i + 1}: ${timeError}`);
      }
      
    } catch (error) {
      Logger.log(`Error processing row ${i + 1}: ${error}`);
      continue;
    }
  }
}

function getContractData(address, functionName) {
  const METHODS = {
    'timeSinceStart': [
      {
        selector: '0x67fc6dea000000000000000000000000000000000000000000000000000000000000000000',  // F17 in contract
        name: 'timeSinceStart'
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

function getImplementationAddress(address) {
  const IMPLEMENTATION_METHODS = [
    {
      selector: '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
      name: 'implementation'
    },
    {
      selector: '0x19CA1d2600000000000000000000000000000000000000000000000000000000',
      name: 'implementation'
    }
  ];

  for (const method of IMPLEMENTATION_METHODS) {
    try {
      const url = encodeURI(`https://api.etherscan.io/api` +
        `?module=proxy` +
        `&action=eth_getStorageAt` +
        `&address=${address}` +
        `&position=${method.selector}` +
        `&tag=latest` +
        `&apikey=${ETHERSCAN_API_KEY}`);
        
      const options = {
        method: 'GET',
        muteHttpExceptions: true
      };
        
      const response = UrlFetchApp.fetch(url, options);
      const result = JSON.parse(response.getContentText());
      
      if (result.result && result.result !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        const implAddress = '0x' + result.result.slice(-40);
        Logger.log(`Found implementation address ${implAddress} for ${address}`);
        Utilities.sleep(300);
        return implAddress;
      }
      
      Utilities.sleep(300);
    } catch (error) {
      Logger.log(`Error getting implementation for ${address}: ${error}`);
      Utilities.sleep(300);
    }
  }
  
  return null;
}

// Add menu item
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Time Since Start')
    .addItem('Update TimeSinceStart', 'updateTimeSinceStart')
    .addToUi();
} 