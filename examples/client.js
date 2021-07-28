const WebSocket = require('ws');
const ws = new WebSocket("ws://localhost:9124");
ws.onopen = () => {
  // const data1 = {
  //   connectionId: "TEST123"
  // }
  // data = `RECONNECT ${JSON.stringify(data1)}`
  // ws.send(data);
  // console.log(data);
}
ws.onmessage = (msg) => {
  console.log(msg.data);
}


let count = 0;
setInterval(() => {
  count++;
  ws.send(`Hello ${count}`)
}, 3000);