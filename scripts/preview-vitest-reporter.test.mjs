import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, sanitizeError } from './preview-vitest-reporter.mjs';

test('nested beforeAll error is preserved even when all tests were skipped', () => {
  const error = { message: '[LDJ_PHASE=SESSION_IDENTITY CODE=READ_ONLY_OFF]',
    stack: 'secret postgres://redacted\n at /work/src/server/db/preview-readonly.integration.test.ts:65:9' };
  const testModule = { errors: () => [], children: {
    *allSuites() { yield { errors: () => [error] }; },
    *allTests() { yield { name: 'fixture', result: () => ({ state: 'skipped' }) }; },
  } };
  const report = buildReport([testModule]);
  assert.equal(report.testResults[0].assertionResults[0].status, 'skipped');
  assert.equal(report.testResults[0].diagnosticErrors[0].code, 'READ_ONLY_OFF');
  assert.deepEqual(report.testResults[0].diagnosticErrors[0].frames,
    ['src/server/db/preview-readonly.integration.test.ts:65:9']);
  assert.ok(!JSON.stringify(report).includes('secret'));
  assert.ok(!JSON.stringify(report).includes('postgres://'));
});

test('unhandled syntax or module errors are executor diagnostics', () => {
  assert.equal(sanitizeError({ name: 'SyntaxError', message: 'private text' }).code, 'SYNTAX_ERROR');
  const report = buildReport([], [{ code: 'ERR_MODULE_NOT_FOUND', stack: 'private text' }]);
  assert.equal(report.diagnosticErrors[0].code, 'ERR_MODULE_NOT_FOUND');
  assert.ok(!JSON.stringify(report).includes('private text'));
});
