let metric = {
  newConnectionsCount: 0,
  reconnectionCount: 0,
  closedConnectionCount: 0,
  messagesCount: 0,
  activeConnectionCount: 0,
  errorConnectionCount: 0,
  memoryUsage: {},
};

const incrNewConnect = () => {
  metric.newConnectionsCount += 1;
};

const incrReconnectionCount = () => {
  metric.reconnectionCount += 1;
};

const incrClosedConnectionCount = () => {
  metric.closedConnectionCount += 1;
};

const incrMessagesCount = () => {
  metric.messagesCount += 1;
};

const incrActiveConnectionCount = () => {
  metric.activeConnectionCount += 1;
};

const decrActiveConnectionCount = () => {
  metric.activeConnectionCount -= 1;
};

const incrErrorConnectionCount = () => {
  metric.errorConnectionCount += 1;
};

const setMemoryUsage = () => {
  metric.memoryUsage = process.memoryUsage();
};

const getMetrics = () => {
  setMemoryUsage();
  return metric;
};

const setMetrics = () => {
  metric = {
    newConnectionsCount: 0,
    reconnectionCount: 0,
    closedConnectionCount: 0,
    messagesCount: 0,
    activeConnectionCount: metric.activeConnectionCount,
    errorConnectionCount: 0,
    memoryUsage: {},
  };
};

module.exports = {
  incrNewConnect,
  incrActiveConnectionCount,
  incrClosedConnectionCount,
  incrErrorConnectionCount,
  incrMessagesCount,
  decrActiveConnectionCount,
  incrReconnectionCount,
  getMetrics,
  setMetrics,
};
