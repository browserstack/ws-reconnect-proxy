const WebSocket = require('ws');
const ws = new WebSocket.Server({ port: 9125 });
ws.onopen = () => {
  // const data1 = {
  //   connectionId: "TEST123"
  // }
  // data = `RECONNECT ${JSON.stringify(data1)}`
  // console.log(data);
}
let count1 = 1
ws.on('connection', (w) => {

  w.on('message', msg => {
    if (msg === `Hello ${count1 * 4}`) {
      count1++;
      w.close(1001, 'Service Restart');
    }
    if (msg === `Hello ${count1 * 6}`) {
      count1++;
      const data1 = {
        connectionId: "TEST123"
      }
      data = `RECONNECT ${JSON.stringify(data1)}`
    }
    console.log(msg);
  });

  // w.on('close', () => {
  //   w.send('Service Restart');
  // });
  let count = 0;
  setInterval(() => {
    count++;
    w.send(`Hello from server ${count}`)
  }, 2500);
});

