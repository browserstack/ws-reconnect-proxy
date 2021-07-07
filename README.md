# ws-reconnect-proxy
Proxy Server that is between a ws server and a ws client. In case of either server / client disconnects graceful or otherwise - initiates/ supports reconnection . 

## Modes of execution

1. Sender Mode
Inside Sender Mode proxy will wait for the upstream to reconnect in case of
disconnection. There will be unique upstream socket for each connection.

2. Receiver Mode
Inside this all the client sockets will be communicating to the single upstream.
Reply from the upstream will be relayed to all the clients.
