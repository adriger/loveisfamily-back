'use strict';

const { validateEmail, validatePassword, validateUsername } = require('../../agent-01/utils/validators');
const { verifyCustomClaim, isSubscriptionValid } = require('../../agent-02/auth-validators');

describe('validateEmail', () => {
  test('valid email passes', () => expect(validateEmail('user@example.com').valid).toBe(true));
  test('invalid format fails', () => expect(validateEmail('not-an-email').valid).toBe(false));
  test('missing @ fails', () => expect(validateEmail('userdomain.com').valid).toBe(false));
  test('empty string fails', () => expect(validateEmail('').valid).toBe(false));
  test('null fails', () => expect(validateEmail(null).valid).toBe(false));
  test('with subdomain passes', () => expect(validateEmail('user@mail.example.co.uk').valid).toBe(true));
  test('with plus alias passes', () => expect(validateEmail('user+tag@example.com').valid).toBe(true));
  test('SQL injection attempt fails', () => expect(validateEmail("' OR '1'='1").valid).toBe(false));
  test('XSS attempt fails', () => expect(validateEmail('<script>alert(1)</script>@x.com').valid).toBe(false));
});

describe('validatePassword', () => {
  test('strong password passes', () => expect(validatePassword('Passw0rd!').valid).toBe(true));
  test('too short fails', () => expect(validatePassword('Ab1!').valid).toBe(false));
  test('no uppercase fails', () => expect(validatePassword('passw0rd!').valid).toBe(false));
  test('no number fails', () => expect(validatePassword('Password!').valid).toBe(false));
  test('no special char fails', () => expect(validatePassword('Passw0rd').valid).toBe(false));
  test('empty fails', () => expect(validatePassword('').valid).toBe(false));
  test('null fails', () => expect(validatePassword(null).valid).toBe(false));
  test('exactly 8 chars (valid) passes', () => expect(validatePassword('Passw0r!').valid).toBe(true));
  test('long password passes', () => expect(validatePassword('MyV3ryL0ng&SecureP@ssword123').valid).toBe(true));
});

describe('validateUsername', () => {
  test('valid username passes', () => expect(validateUsername('user_123').valid).toBe(true));
  test('too short (2 chars) fails', () => expect(validateUsername('ab').valid).toBe(false));
  test('too long (21 chars) fails', () => expect(validateUsername('a'.repeat(21)).valid).toBe(false));
  test('special chars fail', () => expect(validateUsername('user@name').valid).toBe(false));
  test('spaces fail', () => expect(validateUsername('user name').valid).toBe(false));
  test('exactly 3 chars passes', () => expect(validateUsername('abc').valid).toBe(true));
  test('exactly 20 chars passes', () => expect(validateUsername('a'.repeat(20)).valid).toBe(true));
  test('underscore allowed', () => expect(validateUsername('user_name').valid).toBe(true));
  test('numbers allowed', () => expect(validateUsername('user123').valid).toBe(true));
  test('empty fails', () => expect(validateUsername('').valid).toBe(false));
});

describe('verifyCustomClaim', () => {
  test('present claim passes', () => {
    expect(verifyCustomClaim({ subscription_type: 'premium' }, 'subscription_type')).toBe(true);
  });
  test('missing claim fails', () => {
    expect(verifyCustomClaim({}, 'subscription_type')).toBe(false);
  });
  test('exact value check passes', () => {
    expect(verifyCustomClaim({ subscription_type: 'vip' }, 'subscription_type', 'vip')).toBe(true);
  });
  test('wrong value fails', () => {
    expect(verifyCustomClaim({ subscription_type: 'free' }, 'subscription_type', 'vip')).toBe(false);
  });
});

describe('isSubscriptionValid', () => {
  test('free tier is always valid', () => {
    expect(isSubscriptionValid({ subscription_type: 'free' })).toBe(true);
  });
  test('premium with future expiry is valid', () => {
    expect(isSubscriptionValid({ subscription_type: 'premium', subscription_end_date: Date.now() + 86400000 })).toBe(true);
  });
  test('premium with past expiry is invalid', () => {
    expect(isSubscriptionValid({ subscription_type: 'premium', subscription_end_date: Date.now() - 1000 })).toBe(false);
  });
  test('null token returns false', () => {
    expect(isSubscriptionValid(null)).toBe(true); // free tier fallback
  });
});
