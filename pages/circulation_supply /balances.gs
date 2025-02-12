function updateTokenBalances() {
  // Get the active spreadsheet and sheet
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('All NEXT_CLEAR wallets');
  
  // Get all data from the sheet
  const data = sheet.getDataRange().getValues();
  
  // Start from row 2 (skip headers)
  for (let i = 1; i < data.length; i++) {
    const walletAddress = data[i][2];  // Column C - wallet address
    const tokenName = data[i][3];      // Column D - token name
    
    if (!walletAddress || !tokenName) continue;
    
    try {
      // Get the correct token contract based on name
      const tokenContract = TOKENS[tokenName.trim().toUpperCase()];
      if (!tokenContract) {
        throw new Error(`Unknown token: ${tokenName}`);
      }
      
      // Call Etherscan API to get token balance
      const balance = getTokenBalance(walletAddress, tokenContract);
      
      // Convert balance from wei to tokens (assuming 18 decimals)
      const formattedBalance = balance / Math.pow(10, 18);
      
      // Update the F column with the balance
      sheet.getRange(i + 1, 6).setValue(formattedBalance);
      
      // Add small delay to avoid hitting API rate limits
      Utilities.sleep(200);
      
    } catch (error) {
      Logger.log(`Error processing address ${walletAddress}: ${error}`);
      sheet.getRange(i + 1, 6).setValue('ERROR');
    }
  }
}

function getTokenBalance(address, tokenContract) {
  const url = `https://api.etherscan.io/api` +
    `?module=account` +
    `&action=tokenbalance` +
    `&contractaddress=${tokenContract}` +
    `&address=${address}` +
    `&tag=latest` +
    `&apikey=${ETHERSCAN_API_KEY}`;
    
  const options = {
    muteHttpExceptions: true
  };
    
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  if (responseCode !== 200) {
    Logger.log(`Full URL: ${url}`); // This will help debug the API call
    Logger.log(`Full Response: ${responseText}`);
    throw new Error(`HTTP Error ${responseCode}: ${responseText}`);
  }
  
  const data = JSON.parse(responseText);
  
  if (data.status !== '1' || !data.result) {
    throw new Error(`API Error: ${JSON.stringify(data)}`);
  }
  
  return data.result;
}

// Add a menu item to run the script
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Token Balance')
    .addItem('Update Balances', 'updateTokenBalances')
    .addToUi();
} 