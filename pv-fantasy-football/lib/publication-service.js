import 'server-only';

import {
  batchUpdateSpreadsheet,
  getSpreadsheetMetadata,
  readSheetRange,
} from './google-sheets';

import {readGameDayTables} from './game-day-status';
import {evaluateGameDayReadiness} from './game-day-readiness.mjs';
import {withGameWriterGate} from './workbook-writer-gate.mjs';
import {publishGameWithDeps} from './publication-service-core.mjs';

const dependencies = {
  batchUpdateSpreadsheet,
  getSpreadsheetMetadata,
  readSheetRange,
  readGameDayTables,
  evaluateReadiness:evaluateGameDayReadiness,
  withGameWriterGate,
};

export async function publishGame(gameId, options = {}) {
  return publishGameWithDeps(gameId, {
    ...options,
    deps:dependencies,
  });
}