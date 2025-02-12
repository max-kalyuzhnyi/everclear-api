function updateTokenHoldings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Timelocks');
  const data = sheet.getDataRange().getValues();
  
  // Start from row 114
  for (let i = 114; i < data.length; i++) {
    const contractAddress = data[i][2].split('#')[0]; // Column C, remove #tokentxns
    
    if (!contractAddress) {
      Logger.log(`Empty address in row ${i + 1}, skipping`);
      continue;
    }

    try {
      const balance = getTokenBalance(contractAddress);
      if (balance) {
        // Write to column F
        sheet.getRange(i + 1, 6).setValue(balance);
        Logger.log(`Updated balance for ${contractAddress}: ${balance}`);
      }
      
      // Sleep to avoid rate limits
      Utilities.sleep(300);
      
    } catch (error) {
      Logger.log(`Error processing row ${i + 1}: ${error}`);
      continue;
    }
  }
}

function getTokenBalance(address) {
  const TOKEN_CONTRACT = '0x58b9cb810a68a7f3e1e4f8cb45d1b9b3c79705e8';
  const url = `https://etherscan.io/token/${TOKEN_CONTRACT}?a=${address}`;
  
  try {
    const options = {
      method: 'GET',
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html',
        'Cache-Control': 'no-cache'
      }
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const content = response.getContentText();
    
    // Log the content around "BALANCE" for debugging
    const debugMatch = content.match(/BALANCE[\s\S]{0,100}/i);
    Logger.log(`Content around BALANCE for ${address}: ${debugMatch ? debugMatch[0] : 'not found'}`);
    
    // Try different patterns to match balance
    let balanceMatch = content.match(/Balance<\/h6>\s*([\d,]+\.[\d]+)\s*CLEAR/);
    if (!balanceMatch) {
      balanceMatch = content.match(/BALANCE[\s\S]*?(\d[\d,]*(?:\.[\d]+)?)\s*CLEAR/i);  // More flexible pattern
    }
    if (!balanceMatch) {
      balanceMatch = content.match(/Balance[\s\S]{0,10}([\d,]+\.[\d]+)\s*CLEAR/);
    }
    if (!balanceMatch) {
      balanceMatch = content.match(/Balance\s*([\d,]+(?:\.[\d]+)?)\s*CLEAR/);
    }
    if (!balanceMatch) {
      // Try finding just numbers followed by CLEAR
      balanceMatch = content.match(/(\d[\d,]*(?:\.[\d]+)?)\s*CLEAR/);
    }
    
    if (balanceMatch && balanceMatch[1]) {
      // Remove commas and convert to number
      const balance = Number(balanceMatch[1].replace(/,/g, ''));
      Logger.log(`Found balance for ${address}: ${balance}`);
      return balance;
    }
    
    Logger.log(`No balance found for ${address}`);
    return null;
    
  } catch (error) {
    Logger.log(`Error fetching balance for ${address}: ${error}`);
    throw error;
  }
}

// Add menu item
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('Token Holdings');
  menu.addItem('Update Token Holdings', 'updateTokenHoldings');
  menu.addToUi();
} 