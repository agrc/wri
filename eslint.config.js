import { browser } from '@ugrc/eslint-config';

browser[0].ignores = [
  '.firebase',
  'emulator_data/*',
  'firebase-export-*/*',
  'functions/lib/**/*',
  'functions/generated/**/*',
  '.github/*',
  'data/*',
  'forklift/*',
  'maps/*',
  'mockups/*',
  'scripts/*',
  '!.storybook',
].concat(browser[0].ignores);

export default browser;
