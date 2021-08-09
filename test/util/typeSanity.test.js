const {
	isUndefined,
	isNotUndefined,
	isString,
	isNumber,
	isNotNumber,
	isNotString,
} = require('../../lib/util/typeSanity');
const { describe, it } = require('mocha');
const { expect } = require('chai');

describe('typeSanity', () => {
	describe('#isUndefined', () => {
		it('should return true for undefined values', () => {
			expect(isUndefined(undefined)).to.be.equal(true);
		});

		it('should return true for null values', () => {
			expect(isUndefined(null)).to.be.equal(true);
		});

		it('should return true for empty values', () => {
			expect(isUndefined('')).to.be.equal(true);
		});

		it('should return false for valid values', () => {
			expect(isUndefined('value')).to.be.equal(false);
		});
	});

	describe('#isNotUndefined', () => {
		it('should return false for undefined values', () => {
			expect(isNotUndefined(undefined)).to.be.equal(false);
		});

		it('should return false for null values', () => {
			expect(isNotUndefined(null)).to.be.equal(false);
		});

		it('should return false for empty values', () => {
			expect(isNotUndefined('')).to.be.equal(false);
		});

		it('should return true for valid values', () => {
			expect(isNotUndefined('value')).to.be.equal(true);
		});
	});

	describe('#isString', () => {
		it('should return false for undefined values', () => {
			expect(isString(undefined)).to.be.equal(false);
		});

		it('should return true for valid string values', () => {
			expect(isString('value')).to.be.equal(true);
		});
	});

	describe('#isNotString', () => {
		it('should return true for undefined values', () => {
			expect(isNotString(undefined)).to.be.equal(true);
		});

		it('should return false for valid string values', () => {
			expect(isNotString('value')).to.be.equal(false);
		});
	});

	describe('#isNumber', () => {
		it('should return false for undefined values', () => {
			expect(isNumber(undefined)).to.be.equal(false);
		});

		it('should return false for string values', () => {
			expect(isNumber('value')).to.be.equal(false);
		});

		it('should return true for number values', () => {
			expect(isNumber(99)).to.be.equal(true);
		});
	});

	describe('#isNotNumber', () => {
		it('should return false for undefined values', () => {
			expect(isNotNumber(undefined)).to.be.equal(true);
		});

		it('should return true for string values', () => {
			expect(isNotNumber('value')).to.be.equal(true);
		});

		it('should return false for number values', () => {
			expect(isNotNumber(99)).to.be.equal(false);
		});
	});
});
