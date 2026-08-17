import {GoogleAuth} from 'google-auth-library';

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function privateKey() {
  return required('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n');
}

async function sheetsRequest(path, options = {}) {
  const auth = new GoogleAuth({
    credentials: {
      client_email: required('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
      private_key: privateKey(),
    },
    scopes: [SHEETS_SCOPE],
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const spreadsheetId = required('BACKEND_SPREADSHEET_ID');

  const separator = path.startsWith('?') ? '' : '/';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}${separator}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token.token}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Sheets request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  return response.json();
}

export async function readSheetRange(range, {valueRenderOption = 'FORMATTED_VALUE'} = {}) {
  const data = await sheetsRequest(
    `values/${encodeURIComponent(range)}?majorDimension=ROWS&valueRenderOption=${valueRenderOption}`
  );
  return data.values || [];
}

export async function getSpreadsheetMetadata() {
  return sheetsRequest(
    '?fields=sheets.properties(sheetId,title,gridProperties(rowCount,columnCount))'
  );
}

export async function batchUpdateSpreadsheet(requests) {
  return sheetsRequest('batchUpdate', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({requests}),
  });
}

export async function appendSheetRow(range, row) {
  return sheetsRequest(
    `values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({majorDimension: 'ROWS', values: [row]}),
    }
  );
}

export async function writeSheetRange(range, values) {
  return sheetsRequest(`values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: 'PUT', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({majorDimension:'ROWS', values}),
  });
}
