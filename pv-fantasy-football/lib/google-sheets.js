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

export async function readSheetRange(range) {
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

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
    `/values/${encodeURIComponent(range)}?majorDimension=ROWS`;

  const response = await fetch(url, {
    headers: {Authorization: `Bearer ${token.token}`},
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Sheets read failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const data = await response.json();
  return data.values || [];
}
