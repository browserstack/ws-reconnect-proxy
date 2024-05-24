'use strict';

const logger = require('../util/loggerFactory');

/**
 * Handles the custom requests made to existing playwright connection.
 * This class is implemented as a Singleton to maintain a map of commands for which
 * responses can be resolved once received from the Playwright server.
 * @class
 */
class CustomRequestHandler {
  /**
   * Creates an instance of CustomRequestHandler.
   * @constructor
   */
  constructor() {
    if (!CustomRequestHandler.instance) {
      // Initialize the instance if it doesn't exist
      CustomRequestHandler.instance = this;
      // Initialize the map {} as part of the instance
      this.customRequestList = {};
    }
    // Return the existing instance if it already exists
    return CustomRequestHandler.instance;
  }

  /**
   * Static method to get the single instance of the class.
   * @returns {CustomRequestHandler} The single instance of the CustomRequestHandler class.
   */
  static getInstance() {
    if (!CustomRequestHandler.instance) {
      // Create a new instance if it doesn't exist
      CustomRequestHandler.instance = new CustomRequestHandler();
    }
    // Return the existing instance
    return CustomRequestHandler.instance;
  }

  /**
   * Checks if the custom request list is empty.
   * @returns {boolean} Returns true if the custom request list is empty, otherwise false.
   */
  isCustomRequestListEmpty() {
    for (const prop in this.customRequestList) {
      if (this.customRequestList.hasOwnProperty(prop)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Adds an item to the custom request list.
   * @param {string} request_id - The ID of the request to be added.
   */
  addCustomRequest(request_id) {
    let resolveFunc;
    let rejectFunc;
    let promise = new Promise((resolve, reject) => {
      resolveFunc = resolve;
      rejectFunc = reject;
    });
    this.customRequestList[request_id] = {
      resolve: resolveFunc,
      reject: rejectFunc,
      promise: promise,
    };
    logger.info(`Added request '${request_id}' to the customRequestList.`);
  }

  /**
   * Gets the items in the custom request list.
   * @returns {Object} The custom request list.
   */
  getList() {
    return this.customRequestList;
  }

  /**
   * Resets the instance of the CustomRequestHandler class.
   * Only for testing purposes. Do not use it in production code.
   * @static
   */
  static resetInstance() {
    CustomRequestHandler.instance = null;
  }
}

module.exports = CustomRequestHandler;
