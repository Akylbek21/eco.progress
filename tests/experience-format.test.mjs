import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRussianExperience, validExperienceYears } from '../src/utils/experience.ts';

test('formats valid expert experience with Russian plural rules', () => {
  assert.equal(formatRussianExperience(1), '1 год');
  assert.equal(formatRussianExperience(2), '2 года');
  assert.equal(formatRussianExperience(5), '5 лет');
  assert.equal(formatRussianExperience(11), '11 лет');
  assert.equal(formatRussianExperience(21), '21 год');
  assert.equal(formatRussianExperience(22), '22 года');
  assert.equal(formatRussianExperience(25), '25 лет');
});

test('hides missing or invalid expert experience', () => {
  for (const value of [undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5, '5']) {
    assert.equal(validExperienceYears(value), null);
    assert.equal(formatRussianExperience(value), null);
  }
});
