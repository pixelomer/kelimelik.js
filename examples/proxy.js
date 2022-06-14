const net = require('net');
const { Parser, Packet } = require("..");

const server = net.createServer((localSocket) => {
	console.log("New connection:", localSocket.localAddress);
	const realSocket = net.connect(443, "kelimelikserver.he2apps.com");
	const realSocketParser = new Parser();
	const localSocketParser = new Parser();
	
	realSocket.on("data", (data) => realSocketParser.advance(data));
	localSocket.on("data", (data) => localSocketParser.advance(data));

	// Packets are not sent as-is. They are decoded and re-encoded.
	// This is used to test the packet parser/encoder and see if it
	// has any issues.
	//
	// Int8 objects (type 1) will be converted to Int32 objects
	// (type 0) after re-encoding.
	realSocketParser.on("packet", (packet) => {
		console.log("[Remote]", packet);
		if (packet.header === "GameModule_userPurchaseData") {
			packet.data[0] = 1;
			packet.data[1] = 1;
			packet.data[2] = 1;
			packet.data[3] = 1;
			packet.data[4] = 1;
			packet.data[5] = 1;
			packet.data[6] = 1;
		}
		localSocket.write(packet.encode());
	});
	let blockPackets = false;
	localSocketParser.on("packet", (packet) => {
		console.log("[Local]", packet);
		if (packet.header === "GameModule_requestEnterChatScene") {
			// Ignore request
			return;
		}
		if (!blockPackets) {
			realSocket.write(packet.encode());
		}
	});
	//setTimeout(() => { blockPackets = true; console.log("[Remote] Packets blocked.") }, 5000);

	realSocket.on("close", () => localSocket.destroy());
	localSocket.on("close", () => realSocket.destroy());
});

// The game uses port 443 for the game protocol
// ...even though the game protocol is unencrypted
server.listen(443, () => {
	console.log("Proxy server listening on port 443");
});