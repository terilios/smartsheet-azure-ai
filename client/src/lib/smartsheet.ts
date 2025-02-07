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

export async function addColumn(smartsheet: any, sheetId: string, columnTitle: string, columnType = 'TEXT_NUMBER') {
  try {
    const column = {
      title: columnTitle,
      type: columnType,
      index: 0
    };
    const response = await smartsheet.sheets.addColumn({ sheetId, body: column });
    return response;
  } catch (error) {
    console.error('Error adding column:', error);
    throw error;
  }
}

export async function updateCell(smartsheet: any, sheetId: string, rowId: number, columnId: number, value: any) {
  try {
    const row = {
      id: rowId,
      cells: [{
        columnId: columnId,
        value: value
      }]
    };
    const response = await smartsheet.sheets.updateRow({ sheetId, body: row });
    return response;
  } catch (error) {
    console.error('Error updating cell:', error);
    throw error;
  }
}

export async function addRow(smartsheet: any, sheetId: string, cells: { columnId: number, value: any }[]) {
  try {
    const row = { cells };
    const response = await smartsheet.sheets.addRow({ sheetId, body: row });
    return response;
  } catch (error) {
    console.error('Error adding row:', error);
    throw error;
  }
}