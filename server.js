const ws = require('ws');
const uuid = require('uuid');

Array.prototype.remove = function() {
    var what, a = arguments, L = a.length, ax;
    while (L && this.length) {
        what = a[--L];
        while ((ax = this.indexOf(what)) !== -1) {
            this.splice(ax, 1);
        }
    }
    return this;
};
function containsUser(ws) {
    if (!gnetServer.servers[ws.targetServer]) return false;
    let retval = false;
    gnetServer.servers[ws.targetServer].forEach(user => {
        if (retval) return;
        if (user.userID == ws.userID) retval = true;
    });
    return retval;
}
function addServer(srv) {
    if (gnetServer.servers[srv]) return;
    gnetServer.servers[srv] = [];
    gnetServer.servers[srv].host = () => {
        for (const client of gnetServer.servers[srv]) {
            if (client.host) return client;
        }
        return undefined;
    };
    gnetServer.servers[srv].findClient = (userID) => {
        for (const client of gnetServer.servers[srv]) {
            if (client.userID == userID) return client;
        }
        return undefined;
    };
}

const gnetServer = new ws.Server({ noServer: true });
gnetServer.servers = {};
gnetServer.on('connection', (ws, req) => {
    ws.packet=(p)=>{ws.send(JSON.stringify(p))}
    ws.on('message', (msg) => {
        let packet = JSON.parse(msg);

        if (packet.type == 'control/userid') { // When the client responds with a userID control packet
            if (ws.userID || ws.connected) return;

            ws.userID = packet.data.userID;
            if ((gnetServer.servers[ws.targetServer] && containsUser(ws)) || ws.userID == "[{broadcast}]") { // If the userID is already in use or it is broadcast
                return ws.packet({ // we notify the client with a {valid: false} parameter
                    type: 'control/userid', data: {
                        valid: false,
                        userID: ws.userID
                    }
                });
            }

            ws.connected = true; // We connect the client and add them to the server
            addServer(ws.targetServer);
            ws.host = gnetServer.servers[ws.targetServer].length <= 0;
            if (!ws.host) {
                // Notify the host about the new connection
                gnetServer.servers[ws.targetServer].host().packet({
                    type: 'control/connection',
                    data: {
                        userID: ws.userID
                    }
                });
            }
            gnetServer.servers[ws.targetServer].push(ws);
            ws.packet({ // Validate the handshake
                type: 'control/userid', data: {
                    valid: true,
                    userID: ws.userID
                }
            });
            ws.packet({ // Send the mode select packet
                type: 'control/mode', data: {
                    host: ws.host
                }
            });
        } else {
            if (ws.host && packet.destination) {
                if (packet.destination == "[{broadcast}]") { // broadcast the packet to all clients
                    gnetServer.servers[ws.targetServer].forEach(client => client.packet({
                        type: 'host/packet',
                        data: packet.data
                    }));
                } else {
                    try { // try to send the packet to the destination client
                        gnetServer.servers[ws.targetServer].findClient(packet.destination).packet({
                            type: 'host/packet',
                            data: packet.data
                        });
                    } catch (e) {}
                }
            } else {
                // Client sending data to host
                gnetServer.servers[ws.targetServer].host().packet({
                    type: 'client/packet',
                    source: ws.userID,
                    data: packet
                });
            }
        }
    });
    ws.on('close', (code, reason) => {
        if (!ws.connected) return;
        gnetServer.servers[ws.targetServer].remove(ws); // Remove the client from the server
        if (ws.host && gnetServer.servers[ws.targetServer].length > 0) {
            // If the user is a host we need to select a new host and notify them
            gnetServer.servers[ws.targetServer][0].host = true;
            gnetServer.servers[ws.targetServer][0].packet({ // Send the mode select packet again
                type: 'control/mode', data: {
                    host: true
                }
            });
        }

        // Notify the host about the disconnection
        if (gnetServer.servers[ws.targetServer].length > 0)
            gnetServer.servers[ws.targetServer].host().packet({
                type: 'control/disconnection',
                data: {
                    userID: ws.userID
                }
            });

        // Delete the server if empty
        if (gnetServer.servers[ws.targetServer].length <= 0) delete gnetServer.servers[ws.targetServer];
    });

    ws.targetServer = req.url.split("/")[2]; // We grab the server from the URL
    ws.packet({ type: 'control/handshake', data: { // Start the handshake
        target: ws.targetServer
    } });
});

module.exports = {
    gnetServer: gnetServer
};