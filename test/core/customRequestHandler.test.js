const { describe, it, beforeEach, afterEach } = require('mocha');
const { assert } = require('chai');
const CustomRequestHandler = require('../../lib/core/CustomRequestHandler');

describe('CustomRequestHandler', () => {
  let originalInstance;

  // Save the original instance of CustomRequestHandler before each test
  beforeEach(() => {
    originalInstance = CustomRequestHandler.instance;
  });

  // Restore the original instance of CustomRequestHandler after each test
  afterEach(() => {
    CustomRequestHandler.instance = originalInstance;
  });

  describe('Singleton behavior', () => {
    it('should return the same instance when getInstance is called multiple times', () => {
      const instance1 = CustomRequestHandler.getInstance();
      const instance2 = CustomRequestHandler.getInstance();
      assert.strictEqual(instance1, instance2);
    });

    it('should return the same instance when constrcutor is called multiple times', () => {
      const instance1 = new CustomRequestHandler();
      const instance2 = new CustomRequestHandler();
      assert.strictEqual(instance1, instance2);
    });

    it('should return a new instance if getInstance is called after resetting the instance', () => {
      const instance1 = CustomRequestHandler.getInstance();
      CustomRequestHandler.instance = null;
      const instance2 = CustomRequestHandler.getInstance();
      assert.notStrictEqual(instance1, instance2);
    });
  });

  describe('addCustomRequest method', () => {
    it('should add a request to the customRequestList', () => {
      const customRequestHandler = new CustomRequestHandler();
      const requestId = '123';
      customRequestHandler.addCustomRequest(requestId);
      const list = customRequestHandler.getList();
      assert.property(list, requestId);

      // Check if the added request has the expected structure
      const addedRequest = list[requestId];
      assert.containsAllKeys(addedRequest, ['resolve', 'reject', 'promise']);
      assert.isFunction(addedRequest.resolve);
      assert.isFunction(addedRequest.reject);
      assert.instanceOf(addedRequest.promise, Promise);
    });
  });

  describe('getList method', () => {
    it('should return the customRequestList', () => {
      CustomRequestHandler.resetInstance();
      const customRequestHandler = new CustomRequestHandler();
      const list = customRequestHandler.getList();
      assert.isObject(list);
      assert.isEmpty(list);
    });
  });

  describe('#isCustomRequestListEmpty', () => {
    beforeEach(() => {
      CustomRequestHandler.resetInstance();
    });
    it('should return true if the custom request list is empty', () => {
      const customRequestHandler = new CustomRequestHandler();
      const result = customRequestHandler.isCustomRequestListEmpty();
      assert.isTrue(result);
    });

    it('should return false if the custom request list is not empty', () => {
      const customRequestHandler = new CustomRequestHandler();
      customRequestHandler.addCustomRequest('request_1');
      const result = customRequestHandler.isCustomRequestListEmpty();
      assert.isFalse(result);
    });

    it('should handle multiple items in the custom request list', () => {
      const customRequestHandler = new CustomRequestHandler();
      customRequestHandler.addCustomRequest('request_1');
      customRequestHandler.addCustomRequest('request_2');
      const result = customRequestHandler.isCustomRequestListEmpty();
      assert.isFalse(result);
    });

    it('should return true if some properties are directly defined on the object', () => {
      const customRequestHandler = new CustomRequestHandler();
      customRequestHandler.customRequestList = Object.create({
        name: 'inherited',
      });
      const result = customRequestHandler.isCustomRequestListEmpty();
      assert.isTrue(result);
    });
  });
});
