## Lower Level Design

This is the spec for lower level Design for reconnectin proxy

* `Sender`
  This is the configuration if you want to queue data at the proxy and want the
  reconnection to happen from the __proxy side__. One should use this mode.

  class Sender:
    WebSocketServer server
    Map<WebSocket, Array<String>> msgQueue
    Map<WebSocket, Upstream> upstreams
    Map<WebSocket, bool> upstreamWait

  Meaning:
    * upstreamWait -> Map containing that should the message from client to be
    put on hold since upstream is in waiting condition.
    * upstreams -> Map client sockets to upstream websockets
    * msgQueue -> In case of reconnection to upstream we need to queue the
    message for client sockets.

    ------   Queue Messages
    | C1 |---------------          |-------|    Disconnect edge          |--------|
    ------              |--------->|       |<--------------------------->|        |
                                   | Proxy |<--------------------------->| Server |
    ------              |--------->|-------|                             ----------
    | C2 |--------------|
    ------

    In this mode we do not care about enqueue message from upstream and we can
    have different connectin to upstream to isolate the messages on each socket.
    Here the upstream also is unique for each connection.

* `upstream`
  This is the abstraction over the WebSocket to which we connect to Upstream
  URL. This is required since we want to isolate the state of upstream sockets
  from client sockets in server mode. They should not be aware that disconnect
  happened or reconnection is still in progress. They should only handle that if
  proxy is up send the message else queue the message.

  class Upstream:
    String url
    bool retry
    Array<String> headers
    String replayInfo
    Function resolveInfo
    bool terminated
    ID clientID

  Meaning:
    * retry -> Holds the boolean if there is retry enabled or not
    * headers -> Headers for connecting to the upstream websocket url
    * replayInfo -> String information which contains the state information for
    reconnection.
    * terminated -> boolean flag to denote the terminate state of the upstream
    socket. This is useful for saying that the upstream close is a graceful
    close.
    * clientId -> Incoming socket id to which we need to communicate from the
    upstream websocket. In case of disconnect we notify the client and try to
    reconnect to upstream websocket. As soon as the websocket is connected we
    again notify the method by calling the resolve function. This resolves the
    promise for execution.

* `Receiver`
  Use case of this mode is when we need to not monitor the client side
  reconnects. In case disconnects due to some reason and reconnects we should
  proxy the information which is queued till the moment to client again. Here
  the semantics of client id do not hold, so we cannot use the `upstream` object
  here.

  class Receiver:
    WebSocketServer server
    bool clientOnline
    Array<String> upstreamQueue
    WebSocket|null upstream
    Array<String> Queue

  Meaning:
    * clientOnline -> Denotes flag for the upstream messaging queue. If there is
    no client to receive message from upstream. It enqueues the message and
    waits for the first client to get connected.
    * upstreamQueue -> Enqueues the message till the upstream is connected.
    * queue -> Enqueue the message till there is no client to send the
    message.
    * upstream -> Upstream websocket connection to the target.

  --------    Can Break       ---------    Should enqueue messages          ----------
  | Node |------------------->| Proxy |<----------------------------------->| Server |
  --------                    ---------                                     ----------

  Constraint in this mode is for simplicity to be single upstream. If any client
  connects it will be receiving response from single upstream only.

  TODO: We can add a connection id in receiver mode to connect to specific
  upstream socket and can remove the single upstream socket.



=========================================================================================
## V2 Redesign

class IncomingWebSocket:
  string connectionId
  socket connection
  IncomingMessage request
  List queue

class OutgoingWebSocket:
  bool shouldRetry
  socket connection
  Headers headers
  List queue

class Proxy:
  List<Context> contexts
  WebSocketServer server

class Context:
  string sessionId
  IncomingWebSocket incoming
  OutgoingWebSocket outgoing
  Map reconnectData

* If client close then upstream should not be closed immediately and wait for
some time before closing the upstream.
* If upstram is closed retry for certain time and then terminate the client
connection.
* Relay messages from Incoming to Outgoing.
* In case of first message on the outgoing object do not proxy to client and
resolve the promise which acted as a gate to send messages on socket.

If reconnectId is not present then fetch the reconnectId from the first message.
Also push to client if the replayId is present in the request headers.
