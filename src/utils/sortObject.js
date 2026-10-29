/**
 * Sorts an object recursively
 *
 * @param {object} unordered
 * @returns {object}
 */
export function sortObject(unordered) {
  const keys = Object.keys(unordered).sort();

  return keys.reduce((object, key) => {
    const value = unordered[key];
    object[key] = value !== null && typeof value === 'object' ? sortObject(value) : value;

    return object;
  }, {});
}
