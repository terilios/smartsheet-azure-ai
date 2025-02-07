export async function initializeSmartsheet(accessToken: string) {
  const client = require('smartsheet');
  const smartsheet = client.createClient({
    accessToken,
    logLevel: 'info'
  });
  return smartsheet;
}

export async function getSheet(smartsheet: any, sheetId: string) {
  try {
    const response = await smartsheet.sheets.getSheet({ id: sheetId });
    return response;
  } catch (error) {
    console.error('Error loading sheet:', error);
    throw error;
  }
}
