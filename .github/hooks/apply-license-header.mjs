// Copyright (C) 2026 State of Utah
// Licensed under Expat / MIT. This program is distributed on an “AS IS” BASIS, WITHOUT ANY WARRANTY OR CONDITIONS OF ANY KIND, either express or implied. See the Expat / MIT for more details.

import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = process.cwd();
const templatePath = path.join(workspaceRoot, '.github', 'hooks', 'license-header-template.txt');

const singleLineCommentStyles = new Map([
  ['.cjs', '//'],
  ['.cts', '//'],
  ['.js', '//'],
  ['.jsx', '//'],
  ['.mjs', '//'],
  ['.mts', '//'],
  ['.ts', '//'],
  ['.tsx', '//'],
  ['.java', '//'],
  ['.kt', '//'],
  ['.kts', '//'],
  ['.scala', '//'],
  ['.go', '//'],
  ['.rs', '//'],
  ['.swift', '//'],
  ['.php', '//'],
  ['.css', '/*'],
  ['.scss', '/*'],
  ['.sass', '/*'],
  ['.less', '/*'],
  ['.html', '<!--'],
  ['.htm', '<!--'],
  ['.xml', '<!--'],
  ['.svg', '<!--'],
  ['.py', '#'],
  ['.rb', '#'],
  ['.sh', '#'],
  ['.bash', '#'],
  ['.zsh', '#'],
  ['.yml', '#'],
  ['.yaml', '#'],
  ['.sql', '--'],
]);

const multiLineCommentStyles = new Map([
  ['.css', ['/*', ' *', ' */']],
  ['.scss', ['/*', ' *', ' */']],
  ['.sass', ['/*', ' *', ' */']],
  ['.less', ['/*', ' *', ' */']],
  ['.html', ['<!--', '  ', '-->']],
  ['.htm', ['<!--', '  ', '-->']],
  ['.xml', ['<!--', '  ', '-->']],
  ['.svg', ['<!--', '  ', '-->']],
]);

function main() {
  const payload = readPayload();
  if (!payload || payload.hookEventName !== 'PostToolUse') {
    return;
  }

  const template = readTemplate();
  const filePaths = collectCreatedFilePaths(payload);

  for (const filePath of filePaths) {
    applyHeaderIfNeeded(filePath, template);
  }
}

function readPayload() {
  try {
    const input = fs.readFileSync(0, 'utf8').trim();
    return input ? JSON.parse(input) : null;
  } catch {
    return null;
  }
}

function readTemplate() {
  const year = new Date().getFullYear().toString();
  const template = fs
    .readFileSync(templatePath, 'utf8')
    .replace(/@YEAR@/g, year)
    .trimEnd();
  return template;
}

function collectCreatedFilePaths(payload) {
  const candidates = new Set();
  const toolName = payload.tool_name;
  const toolInput = payload.tool_input ?? {};

  if (toolName === 'create_file' && typeof toolInput.filePath === 'string') {
    candidates.add(toolInput.filePath);
  }

  if (toolName === 'apply_patch' && typeof toolInput.input === 'string') {
    for (const match of toolInput.input.matchAll(/^\*\*\* Add File: (.+)$/gm)) {
      candidates.add(match[1].trim());
    }
  }

  return [...candidates]
    .map((filePath) => path.resolve(filePath))
    .filter((filePath) => filePath.startsWith(workspaceRoot + path.sep));
}

function applyHeaderIfNeeded(filePath, template) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  if (!singleLineCommentStyles.has(extension)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('\0')) {
    return;
  }

  if (hasHeader(content)) {
    return;
  }

  const header = formatHeader(extension, template);
  const insertionOffset = content.startsWith('#!') ? content.indexOf('\n') + 1 : 0;
  const prefix = content.slice(0, insertionOffset);
  const suffix = content.slice(insertionOffset);

  fs.writeFileSync(filePath, `${prefix}${header}${suffix}`, 'utf8');
}

function hasHeader(content) {
  const normalized = content.replace(/^#!.*\n/, '').trimStart();
  return (
    normalized.startsWith('// Copyright (C)') ||
    normalized.startsWith('# Copyright (C)') ||
    normalized.startsWith('/*\n * Copyright (C)') ||
    normalized.startsWith('<!--\n  Copyright (C)')
  );
}

function formatHeader(extension, template) {
  const lines = template.split(/\r?\n/);
  const multiLineStyle = multiLineCommentStyles.get(extension);

  if (multiLineStyle) {
    const [start, middle, end] = multiLineStyle;
    const body = lines.map((line) => `${middle} ${line}`.trimEnd()).join('\n');
    return `${start}\n${body}\n${end}\n\n`;
  }

  const token = singleLineCommentStyles.get(extension);
  return `${lines.map((line) => `${token} ${line}`).join('\n')}\n\n`;
}

main();
