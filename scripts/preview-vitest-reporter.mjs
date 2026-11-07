import { writeSync } from 'node:fs';

const phases = new Set(['SETUP', 'SESSION_IDENTITY', 'HOMEPAGE', 'AGENT_DATA', 'MATCH_TEAM', 'PREDICTIONS']);
const nodeCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'CONNECT_TIMEOUT',
  'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN',
  'ERR_TLS_CERT_ALTNAME_INVALID', 'ENOENT', 'ERR_MODULE_NOT_FOUND', 'EACCES', 'EPERM']);

export function sanitizeError(error) {
  const text = `${typeof error?.message === 'string' ? error.message : ''}\n${typeof error?.stack === 'string' ? error.stack : ''}`;
  const marker = text.match(/\[LDJ_PHASE=(\w+) CODE=([A-Z0-9_]{1,64})\]/);
  const diagnostic = { phase: 'TEST_PROCESS', code: 'UNCLASSIFIED_SETUP_ERROR', frames: [] };
  if (marker && phases.has(marker[1])) {
    diagnostic.phase = marker[1];
    diagnostic.code = marker[2];
  } else if (typeof error?.code === 'string' && (nodeCodes.has(error.code) || /^[0-9A-Z]{5}$/.test(error.code))) {
    diagnostic.code = error.code;
  } else if (error?.name === 'SyntaxError') diagnostic.code = 'SYNTAX_ERROR';
  else if (error?.name === 'AssertionError') diagnostic.code = 'ASSERTION_FAILED';
  // Keep only source locations in this known test, never arbitrary stack text.
  const frames = text.match(/src\/server\/db\/preview-readonly\.integration\.test\.ts:\d+:\d+/g) ?? [];
  diagnostic.frames = [...new Set(frames)].slice(0, 6);
  return diagnostic;
}

export function buildReport(modules, unhandledErrors = []) {
  const globalErrors = unhandledErrors.map(sanitizeError);
  const testResults = modules.map(module => {
    // Unlike Vitest's built-in JSON reporter, collect nested beforeAll errors.
    const errors = [...module.errors()];
    for (const suite of module.children.allSuites()) errors.push(...suite.errors());
    const diagnosticErrors = errors.map(sanitizeError);
    return {
      message: '', diagnosticErrors,
      assertionResults: [...module.children.allTests()].map(test => {
        const result = test.result();
        return { title: test.name, status: result.state, failureMessages: [],
          diagnosticErrors: (result.errors ?? []).map(sanitizeError) };
      }),
    };
  });
  return { testResults, diagnosticErrors: globalErrors };
}

export default class PreviewReporter {
  onTestRunEnd(modules, unhandledErrors) {
    const fd = process.env.LDJ_VITEST_REPORT_FD;
    if (!/^\d+$/.test(fd ?? '')) throw new Error('PREVIEW_REPORT_DESCRIPTOR_REQUIRED');
    writeSync(Number(fd), JSON.stringify(buildReport(modules, unhandledErrors)));
  }
}
