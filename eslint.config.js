import { browser } from '@ugrc/eslint-config';

browser[0].ignores = [
  '.firebase',
  'emulator_data/*',
  'firebase-export-*/*',
  'functions/lib/**/*',
  'functions/generated/**/*',
  '.github/*',
  'data/*',
  'maps/*',
  'mockups/*',
  'scripts/*',
  '!.storybook',
  'storybook-static/*',
].concat(browser[0].ignores);

export default browser;
