'use strict';

const {
  validateEmail,
  validatePassword,
  validateUsername,
  validateAge,
  validateInterests,
  validateText,
  validateLocation,
  validateAttachments,
  validateRequired,
} = require('../../agent-01/utils/validators');

describe('validateAge', () => {
  test('18 passes (minimum)', () => expect(validateAge(18).valid).toBe(true));
  test('17 fails (underage)', () => expect(validateAge(17).valid).toBe(false));
  test('120 passes (maximum)', () => expect(validateAge(120).valid).toBe(true));
  test('121 fails', () => expect(validateAge(121).valid).toBe(false));
  test('null fails', () => expect(validateAge(null).valid).toBe(false));
  test('string fails', () => expect(validateAge('28').valid).toBe(false));
  test('float fails', () => expect(validateAge(28.5).valid).toBe(false));
  test('negative fails', () => expect(validateAge(-1).valid).toBe(false));
});

describe('validateInterests', () => {
  test('empty array passes', () => expect(validateInterests([]).valid).toBe(true));
  test('array with strings passes', () => expect(validateInterests(['sports', 'cooking']).valid).toBe(true));
  test('20 items passes (limit)', () => expect(validateInterests(Array(20).fill('x')).valid).toBe(true));
  test('21 items fails', () => expect(validateInterests(Array(21).fill('x')).valid).toBe(false));
  test('non-array fails', () => expect(validateInterests('sports').valid).toBe(false));
  test('item > 50 chars fails', () => expect(validateInterests(['x'.repeat(51)]).valid).toBe(false));
});

describe('validateText', () => {
  test('valid text passes', () => expect(validateText('Hello world').valid).toBe(true));
  test('empty string fails', () => expect(validateText('').valid).toBe(false));
  test('null fails', () => expect(validateText(null).valid).toBe(false));
  test('text at max length passes', () => expect(validateText('a'.repeat(2000)).valid).toBe(true));
  test('text over max length fails', () => expect(validateText('a'.repeat(2001)).valid).toBe(false));
  test('only whitespace fails', () => expect(validateText('   ').valid).toBe(false));
  test('emoji passes', () => expect(validateText('Hello 😊').valid).toBe(true));
});

describe('validateLocation', () => {
  test('valid location passes', () => expect(validateLocation({ latitude: 40.7, longitude: -74.0 }).valid).toBe(true));
  test('null fails', () => expect(validateLocation(null).valid).toBe(false));
  test('latitude > 90 fails', () => expect(validateLocation({ latitude: 91, longitude: 0 }).valid).toBe(false));
  test('latitude < -90 fails', () => expect(validateLocation({ latitude: -91, longitude: 0 }).valid).toBe(false));
  test('longitude > 180 fails', () => expect(validateLocation({ latitude: 0, longitude: 181 }).valid).toBe(false));
  test('longitude < -180 fails', () => expect(validateLocation({ latitude: 0, longitude: -181 }).valid).toBe(false));
  test('equator/prime meridian passes', () => expect(validateLocation({ latitude: 0, longitude: 0 }).valid).toBe(true));
  test('poles pass', () => {
    expect(validateLocation({ latitude: 90, longitude: 0 }).valid).toBe(true);
    expect(validateLocation({ latitude: -90, longitude: 0 }).valid).toBe(true);
  });
});

describe('validateAttachments', () => {
  test('empty array passes', () => expect(validateAttachments([]).valid).toBe(true));
  test('10 items passes', () => {
    const atts = Array(10).fill({ type: 'image', url: 'https://x.com/img.jpg' });
    expect(validateAttachments(atts).valid).toBe(true);
  });
  test('11 items fails', () => {
    const atts = Array(11).fill({ type: 'image', url: 'https://x.com/img.jpg' });
    expect(validateAttachments(atts).valid).toBe(false);
  });
  test('attachment over 10MB fails', () => {
    expect(validateAttachments([{ type: 'file', url: 'x', size: 11 * 1024 * 1024 }]).valid).toBe(false);
  });
  test('missing url fails', () => {
    expect(validateAttachments([{ type: 'image' }]).valid).toBe(false);
  });
});

describe('validateRequired', () => {
  test('all required fields present passes', () => {
    expect(validateRequired({ name: 'a', email: 'b' }, ['name', 'email']).valid).toBe(true);
  });
  test('missing field fails', () => {
    expect(validateRequired({ name: 'a' }, ['name', 'email']).valid).toBe(false);
  });
  test('empty string fails', () => {
    expect(validateRequired({ name: '' }, ['name']).valid).toBe(false);
  });
  test('null value fails', () => {
    expect(validateRequired({ name: null }, ['name']).valid).toBe(false);
  });
});
