'use strict';

const logger = require('../util/loggerFactory');

class CustomRequestHandler {
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
  // Static method to get the single instance of the class
  static getInstance() {
    if (!CustomRequestHandler.instance) {
      // Create a new instance if it doesn't exist
      CustomRequestHandler.instance = new CustomRequestHandler();
    }
    // Return the existing instance
    return CustomRequestHandler.instance;
  }
  // Method to add an item to the list
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
      promise: promise
    }
    logger.info(`Added request '${request_id}' to the customRequestList.`);
  }
  // Method to get the list items
  getList() {
    return this.customRequestList;
  }
}
module.exports = CustomRequestHandler;
