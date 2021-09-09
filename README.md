# ws-reconnect-proxy

Proxy Server that is between a ws server and a ws client. In case of either server / client disconnects graceful or otherwise - initiates/ supports reconnection.

Read more about [📝 design](docs/design.md)

### README Contents:

- [How to contribute](#how-to-contribute)
- [Development Internals](#development-internals)

### ✨ How to contribute

We are very happy to receive and merge your contributions into this repository!

To contribute via pull request, follow these steps:

1. Create an issue describing the feature you want to work on (or
   have a look at the [issues](https://github.com/browserstack/ws-reconnect-proxy/issues))
2. Write your code, tests and format them with `npm run format`
3. Create a pull request describing your changes

Your pull request will be reviewed by a maintainer, who will get
back to you about any necessary changes or questions.

## ⚡️ Development Internals

### 🔨 Installing Dependencies

To install dependencies

```bash
npm install
```

### ✅ Running the Tests

In order to run the tests, make sure that you have installed dependencies:

```bash
npm run test
```

### 🎨 Formatting

To reformat files execute

```bash
npm run format
```

### 🚀 Run proxy

🔧 Before, executing proxy create the `config.json` by running the following command:

```bash
cp lib/config/config.json.sample lib/config/config.json
```

Additionally, you can configuration your proxy based on your needs. Refer here - [config.json.sample](lib/config/config.json.sample)

Then execute proxy by running the following command:

```bash
npm run start
```

_NOTE: By default it runs in `dev` environment you can configure your env by the following command:_

```bash
NODE_ENV=<env> node cluster.js
```
