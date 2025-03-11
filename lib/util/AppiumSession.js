const wd = require('wd');

// Define build name
const BUILD_NAME = 'PW iOS - POC';

// Configure capabilities
const capabilities = {
  'browserName': 'Safari',
  'device': 'iPhone 14',
  'os_version': '16',
  'real_mobile': 'true',
  'build': BUILD_NAME,
  'project': 'iOS Safari Test',
  'browserstack.debug': 'true',
  'browserstack.console': 'info',
  'browserstack.interactiveDebugging': 'true',
  'appium:automationName': 'XCUITest',
  'appium:safariInitialUrl': "about:blank",
  'appium:nativeWebTap': true,
  'appium:autoAcceptAlerts': true,
  'appium:safariAllowPopups': true
};


// Create a new browser instance
const driver = wd.promiseChainRemote({
  host: 'hub.browserstack.com',
  port: 80,
  user: "rutvikchandla_2MEern",
  pwd: "3PpCxycsXsg1DzMFauGe"
});

// Start the session and navigate to a URL
async function initialiseDriver() {
  try {
    // Initialize the session
    await driver.init(capabilities);
    console.log('Session started');

  } catch (error) {
    console.error('Error:', error);
    // Make sure to end the session even if there's an error
    try {
      await driver.quit();
    } catch (quitError) {
      console.error('Error ending session:', quitError);
    }
  }
}

module.exports = initialiseDriver;


