const isUndefined = (val) => val === undefined || val === null || val === '';

const isNotUndefined = (val) => !isUndefined(val);

const isString = (val) => isNotUndefined(val) && typeof val === 'string';

const isNotString = (val) => !isString(val);

const isNumber = (val) => isNotUndefined(val) && typeof val === 'number';

const isNotNumber = (val) => !isNumber(val);

const isBoolean = (val) => isNotUndefined(val) && typeof val === 'boolean';

const isNotBoolean = (val) => !isBoolean(val);

module.exports = {
  isUndefined,
  isNotUndefined,
  isString,
  isNotString,
  isNumber,
  isNotNumber,
  isBoolean,
  isNotBoolean,
};
