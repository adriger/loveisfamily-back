'use strict';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

/**
 * Validates email format.
 * @param {string} email
 * @returns {{ valid: boolean, error?: string }}
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') return { valid: false, error: 'Email is required' };
  if (!EMAIL_REGEX.test(email.trim())) return { valid: false, error: 'Invalid email format' };
  return { valid: true };
}

/**
 * Validates password complexity.
 * @param {string} password
 * @returns {{ valid: boolean, error?: string }}
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') return { valid: false, error: 'Password is required' };
  if (password.length < 8) return { valid: false, error: 'Password must be at least 8 characters' };
  if (!PASSWORD_REGEX.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter, one number, and one special character' };
  }
  return { valid: true };
}

/**
 * Validates username format (3-20 alphanumeric + underscore).
 * @param {string} username
 * @returns {{ valid: boolean, error?: string }}
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') return { valid: false, error: 'Username is required' };
  if (!USERNAME_REGEX.test(username)) {
    return { valid: false, error: 'Username must be 3-20 characters, alphanumeric and underscores only' };
  }
  return { valid: true };
}

/**
 * Validates URL format.
 * @param {string} url
 * @returns {{ valid: boolean, error?: string }}
 */
function validateUrl(url) {
  if (!url || typeof url !== 'string') return { valid: false, error: 'URL is required' };
  if (!URL_REGEX.test(url)) return { valid: false, error: 'Invalid URL format' };
  return { valid: true };
}

/**
 * Validates age (must be 18+).
 * @param {number} age
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAge(age) {
  if (age === undefined || age === null) return { valid: false, error: 'Age is required' };
  if (typeof age !== 'number' || !Number.isInteger(age)) return { valid: false, error: 'Age must be an integer' };
  if (age < 18) return { valid: false, error: 'Must be 18 or older' };
  if (age > 120) return { valid: false, error: 'Invalid age value' };
  return { valid: true };
}

/**
 * Validates interests array.
 * @param {string[]} interests
 * @returns {{ valid: boolean, error?: string }}
 */
function validateInterests(interests) {
  if (!Array.isArray(interests)) return { valid: false, error: 'Interests must be an array' };
  if (interests.length > 20) return { valid: false, error: 'Maximum 20 interests allowed' };
  for (const interest of interests) {
    if (typeof interest !== 'string' || interest.length > 50) {
      return { valid: false, error: 'Each interest must be a string of max 50 characters' };
    }
  }
  return { valid: true };
}

/**
 * Validates post text content.
 * @param {string} text
 * @param {number} maxLength
 * @returns {{ valid: boolean, error?: string }}
 */
function validateText(text, maxLength = 2000) {
  if (!text || typeof text !== 'string') return { valid: false, error: 'Text is required' };
  const trimmed = text.trim();
  if (trimmed.length === 0) return { valid: false, error: 'Text cannot be empty' };
  if (trimmed.length > maxLength) return { valid: false, error: `Text exceeds maximum length of ${maxLength}` };
  return { valid: true };
}

/**
 * Validates geo-point location.
 * @param {{ latitude: number, longitude: number }} location
 * @returns {{ valid: boolean, error?: string }}
 */
function validateLocation(location) {
  if (!location || typeof location !== 'object') return { valid: false, error: 'Location must be an object' };
  const { latitude, longitude } = location;
  if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
    return { valid: false, error: 'Latitude must be a number between -90 and 90' };
  }
  if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
    return { valid: false, error: 'Longitude must be a number between -180 and 180' };
  }
  return { valid: true };
}

/**
 * Validates attachment array (max 10, each max 10MB).
 * @param {Array} attachments
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAttachments(attachments) {
  if (!Array.isArray(attachments)) return { valid: false, error: 'Attachments must be an array' };
  if (attachments.length > 10) return { valid: false, error: 'Maximum 10 attachments allowed' };
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  for (const att of attachments) {
    if (!att.type || !att.url) return { valid: false, error: 'Each attachment must have type and url' };
    if (att.size && att.size > MAX_SIZE) return { valid: false, error: 'Attachment exceeds 10MB limit' };
  }
  return { valid: true };
}

/**
 * Validates required fields are present and non-empty.
 * @param {object} data
 * @param {string[]} requiredFields
 * @returns {{ valid: boolean, error?: string }}
 */
function validateRequired(data, requiredFields) {
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      return { valid: false, error: `Field '${field}' is required` };
    }
  }
  return { valid: true };
}

module.exports = {
  validateEmail,
  validatePassword,
  validateUsername,
  validateUrl,
  validateAge,
  validateInterests,
  validateText,
  validateLocation,
  validateAttachments,
  validateRequired,
};
