# ⚠️ REPLACED by BroadcastWS ⚠️
>Repository at https://github.com/JanCraft/broadcast-ws.
> <br>
> (public server at <ins>**wss://relay.jdev.com.es/**</ins>)

# gNET protocol #
*jDev gNET* is built on top of WebSockets, it uses the JSON format when communicating.

The server-client architecture is a *kind of Peer-to-peer* tunnel through our servers.

* When refering to a *server*, it refers to the instance someone created.
* When refering to the *host*, it refers to the first person that connected to a server.
* When refering to the *client*, it refers to the users connected to a server.

### Connection stages: ###
 - **Handshake** - when connecting to our servers, you use the following URL ![ws://jdev-gameserver.herokuapp/gnet/server](img/url.png) **https:// is wrong, ws:// is corrrect**
 - **User ID** - after connection, the client provides it's ID to the server
 - **Mode select** - then the server tells the client if it is host or not
 - **Finished** - now the host/clients can communicate

If the host disconnects, gNET will assing a new host and re-send the **Mode select** packet.

Since this system is *kinda* peer-to-peer, all the internal host states need to be synced with all clients so when a new host is assigned, they have all the old host's internal data.

### Data packets: ###
 - **Server-to-host** - When the server sends to the host, it provides a ```source``` parameter with the ID of the client that issued the packet.
 - **Host-to-server** - The host must send a ```destination``` parameter to the server to redirect the packet. The ```destination``` parameter can be `"[{broadcast}]"` to redirect the packet to all clients.
 - **Client-to-server** - No special parameters are provided. This will be redirected to the host in a **Server-to-host** packet.
 - **Server-to-client** - No special parameters are provided, this is the result of a **Host-to-server** packet.

With this, any coder can use our servers to run their games inside for free, the server source code is **Open Source** and the protocol messages are explained below.

### Pricing: ###
 jDev has always provided their services for free to everyone and gNET is no exception. You can use the gNET servers forever and free-of-charge. However, if your concurrent connections exceed 50, we recommend to make your own "version" of jDev gNET in your own servers. There is a section below on how to run gNET in your servers.

### Bandwidth ###
 We have successfully brute-force tested our servers and ended up with this conclusions:
  - There is an unknown hard limit of concurrent connections, *it seems to be 500, but there's no proof*.
  - There is a soft limit of 200 concurrent connections, *the handshake slows down so much that barely more connections get processed*.
  - The latency is low enough to play realtime FPS games in Europe without lag.
  - Trying to reduce the amount of *packets per second* (pps) and *size per packet* (spp) will allow you to have more concurrent connections.

### Demo ###
 The demo HTML file is a simple realtime chat with random usernames that works using gNET in the ```__demo__``` server. Please do not use this server on your own projects as it can disturb the workflow of the original demo.

 The demo shows how to use the ```gNET.on()``` function to run code when a packet is received. This function can also be used to parse `control/connection` and `control/disconnection`.
 
 The `gNET` object contains a `send` function *(works with and without destination)*, a `broadcast` function, a `connect` function and the `on` function.

### Your own server ###
 If you need to scale gNET to up to 200 concurrent connections, you should run it in your own servers. Since the code is Open Source, you can easily download ```server.js``` and use this in your main server file to host gNET for yourself.

 **Note: Using gNET requires you to know how to implement the following code into your current server, if you have one. This server runs as-is in Heroku**
 ```js
const { gnetServer } = require('./gnet/server.js');

const port = process.env.PORT || 5000;
const server = http.createServer(app)
server.listen(port, () => {
    console.log('Server running on ' + port);
});

server.on('upgrade', (request, socket, head) => {
    if (request.url.startsWith("/gnet/")) {
        gnetServer.handleUpgrade(request, socket, head, socket => {
            gnetServer.emit('connection', socket, request);
        });
    }
});
```

### Packet types ###
 - `control/handshake` - Server-to-client, validates the targeted server to the client.
 ```json
 {
    "type": "control/handshake",
    "data": {
        "targetServer": "<target server in URL>"
    }
 }
 ```
 - `control/userid` - Client-to-server, indicates the wanted userID.
 ```json
 {
     "type": "control/userid",
     "data": {
         "userID": "<userID selected by the client>"
     }
 }
 ```
 - `control/userid` - Server-to-client, validates the wanted userID.
 ```json
 {
     "type": "control/userid",
     "data": {
         "valid": true/false,
         "userID": "<userID sent by the client>"
     }
 }
 ```
 - `control/mode` - Server-to-client, indicates if the client is host or not.
 ```json
 {
     "type": "control/mode",
     "data": {
         "host": true/false
     }
 }
 ```
 - `control/connection` - Server-to-host, indicates a new client connected.
 ```json
 {
     "type": "control/connection",
     "data": {
         "userID": "<new client userID>"
     }
 }
 ```
  - `control/disconnection` - Server-to-host, indicates a client disconnected.
 ```json
 {
     "type": "control/disconnection",
     "data": {
         "userID": "<disconnected client userID>"
     }
 }
 ```
 - `host/packet` - Host-to-client, a packet.
```json
{
    "type": "host/packet",
    "data": any
}
```
 - `client/packet` - Server-to-host, a packet issued from a client.
```json
{
    "type": "client/packet",
    "source": "<source client userID>",
    "data": any
}
```
 - `any` - Any packet Client-to-server, will be transformed into a `client/packer`
