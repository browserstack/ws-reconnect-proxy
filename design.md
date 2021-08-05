# High Level Design

WebSocket reconnect proxy as the name suggest it as a mediator between two client & server. The proxy receives the message from client and sends message to server.

To get clear understanding lets define following entities -

1. Client - Who sends data to proxy via websocket connection.
2. Proxy - Who receives the data from client & sends the message to upstream.
3. Server - Who receives data sent by the proxy over websocket connection.

```
|-----------|     |-----------|     |-----------|
|  CLIENT   |<--->|   PROXY   |<--->|  SERVER   |
|-----------|     |-----------|     |-----------|
```

# Low Level Design

As we know, proxy sits between client & the server. Proxy job is to deliver messages back & forth to both of the parties.

## Constraints -

1. It should send and receive messages from client & server.
2. It should handle disconnects & retry / reconnect.

## Scenarios -

### 1. Client & Server connect

When client is connected it registers itself and proxy connects to the server. Once connection are established successfully client is ready to send messages as well as server is ready to send message.

> Connection between client and the proxy aka `IncomingSocket`<br>
> Connection between proxy and the server aka `OutgoingSocket`

```
|-----------|(IncomingSocket)|-----------|(OutgoingSocket)|-----------|
|  CLIENT   |<-------------->|   PROXY   |<-------------->|  SERVER   |
|-----------|                |-----------|                |-----------|
```

### 2. Server Disconnect

Lets consider if server disconnects due to abrupt close / deploys on server. Proxy job is to retry connecting to server with `t` interval & retry `n` times connecting to server.

```
|------------|     |-----------|     |-----------|
| CLIENT(C1) |<--->|   PROXY   |<-X->|  SERVER   |
|------------|     |-----------|     |-----------|
```

Now, as the server is in disconnected state & if client sends the message Proxy jobs is to queue the client messages aka `IncomingQueue`.

```
|------------|     |-----------|     |-----------|
| CLIENT(C1) |<--->|   PROXY   |<-X->|  SERVER   |
|------------|     |-----------|     |-----------|
                  [ M1 | M2 | M3 ]
```

Once, the server is connected all the messages from `IncomingQueue` is drained by Proxy & sent to server.

```
|------------|     |-----------|     |-----------|
| CLIENT(C1) |<--->|   PROXY   |<--->|  SERVER   |
|------------|     |-----------|     |-----------|
                                    [ M1 | M2 | M3 ]
```

### 3. Client Disconnect

Now, as the client is connected for some reason client disconnects. Proxy also breaks the connection between server after `t` interval.

```
|------------|     |-----------|     |----------|
| CLIENT(C1) |<-X->|   PROXY   |<--->|  SERVER  |
|------------|     |-----------|     |----------|
```

As we know, client has disconnected and after `t` interval proxy closes the connection between server. And within this time frame if server sends message to client. The messages starts queued up aka `OutgoingQueue`

```
|------------|     |-----------|     |-----------|
| CLIENT(C1) |<-X->|   PROXY   |<--->|  SERVER   |
|------------|     |-----------|     |-----------|
                   [ M1 | M2 | M3 ]
```

Once the client reconnects with same `connectionId` i.e `C1` as the first time connection was established. Proxy then drains the messages from `OutgoingQueue` & sends to client `(C1)`.

```
|------------|     |-----------|     |-----------|
| CLIENT(C1) |<--->|   PROXY   |<--->|  SERVER   |
|------------|     |-----------|     |-----------|
[ M1 | M2 | M3 ]
```

## Class Level Structure

```
class Proxy:
  WebSocketServer server
  Map<Context> contexts

class Context:
  String connectionId
  IncomingWebSocket incomingSocket
  OutgoingWebSocket outgoingSocket
  boolean incomingLock
  boolean outgoingLock

class IncomingWebSocket:
  WebSocket connection
  Object request
  List queue //IncomingQueue

class OutgoingWebSocket:
  String url
  Object headers
  String connectionId
  boolean shouldRetry
  WebSocket connection
  Object reconnectInfo
  Integer retryCount
  List queue //OutgoingQueue
```

- `Proxy` holds the map of contexts for which connection is established.
- `Context` should hold the `IncomingSocket` & `OutgoingSocket` data.
- If the server is disconnected `incomingLock` is set to `true` & therefore messages coming from client is queued. Additionally, if `OutgoingSocket` is closed retry `n` times, post retries done then terminate the `IncomingSocket`.
- If the client is disconnected `outgoingLock` is set to `true` & therefore messages coming from upstream is queued. Additionally, if `IncomingSocket` is closed then `OutgoingSocket` not be closed immediately and wait for `t` interval before closing the `OutgoingSocket`.

- If the server is reconnected then drain the messages from `IncomingQueue` & send those messages to `OutgoingSocket`.

- If the client reconnects with same `connectionId` drain the messages from `OutgoingQueue` & send those messages to `IncomingSocket`.
