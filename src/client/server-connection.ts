import { EventEmitter } from "events";
import { Parser } from "../parser";
import { Packet } from "../packet";
import { LinkedList } from "../utils/linked-list";
import net from "net";

interface ServerOptions {
	host: string,
	port: number
};

interface ExpectedPacket {
	headers: string[];
	resolve: Function;
}

declare interface ServerConnection {
	on(event: string, listener: (packet: Packet) => void): this;
	once(event: string, listener: (packet: Packet) => void): this;
	emit(event: string, packet: Packet): boolean;

	on(event: "packet" | "outgoingPacket", listener: (packet: Packet) => void): this;
	once(event: "packet" | "outgoingPacket", listener: (packet: Packet) => void): this;
	emit(event: "packet" | "outgoingPacket", packet: Packet): boolean;

	on(event: "close", listener: () => void): this;
	once(event: "close", listener: () => void): this;
	emit(event: "close"): boolean;
}

class ServerConnection extends EventEmitter {
	static defaultServerOptions: ServerOptions = {
		host: "kelimelikserver.he2apps.com",
		port: 443
	};

	/** TCP socket for server communication. */
	socket: net.Socket;

	/** Parser for parsing packets from the server. */
	_parser: Parser;

	/** Parser for parsing packets from the server. */
	_awaitingPromises: LinkedList<ExpectedPacket> = new LinkedList();
 
	/** Interval handle for ping packets. */
	_pingInterval: NodeJS.Timeout;

	/** Wait for the next packet that has one of the given headers. */
	waitForPacket(headers: string[] | string): Promise<Packet> {
		if (this.socket.destroyed) {
			//throw new Error("Cannot wait for packet. Connection was closed.");
			return new Promise(() => {});
		}
		if (typeof headers === 'string') {
			headers = [headers];
		}
		let resolve;
		const promise = new Promise<Packet>((_resolve) => { resolve = _resolve; });
		this._awaitingPromises.insert({ headers, resolve });
		return promise;
	}
 
	/** Sends the given packet to the server. */
	sendPacket(packet: Packet): Promise<void> {
		this.emit("outgoingPacket", packet);
		return new Promise<void>((resolve, reject) => {
			this.socket.write(packet.encode(), (error) => {
				if (error == null) resolve();
				else reject(error);
			});
		});
	}

	/**
	 * Closes the connection.
	 */
	destroyConnection(): void {
		this.socket.destroy();
	}

	constructor(socket?: net.Socket);
	constructor(options?: ServerOptions);
	constructor(arg1?: net.Socket | ServerOptions) {
		super();

		if (arg1 == null) {
			arg1 = ServerConnection.defaultServerOptions;
		}

		if (arg1 instanceof net.Socket) {
			this.socket = arg1;
		}
		else {
			if ((typeof arg1.host !== 'string') || (typeof arg1.port !== 'number')) {
				throw new Error("Invalid server options. Missing host address or port.");
			}
			this.socket = net.connect(arg1.port, arg1.host);
		}

		// Parser creation
		this._parser = new Parser();

		// Socket data handlers
		this.socket.on("data", (data) => this._parser.advance(data));
		this._parser.on("packet", (packet) => {
			if (packet.header.startsWith("GameModule_")) {
				this.emit("packet", packet);
				this.emit(packet.header, packet);

				// Call resolve functions for relevant waitForPacket() calls
				let previousNode = this._awaitingPromises.head;
				let node = previousNode.next;
				while (node != null) {
					const object = node.value;
					if (object.headers.includes(packet.header)) {
						this._awaitingPromises.deleteAfter(previousNode);
						node = previousNode.next;
						object.resolve(packet);
					}
					else {
						previousNode = node;
						node = node.next;
					}
				}
			}
		});

		// Pinging
		const pingPacket = new Packet("GameModule_requestPing");
		this._pingInterval = setInterval(() => {
			this.sendPacket(pingPacket);
		}, 60000);

		// Socket event handlers
		this.socket.on("close", () => {
			clearInterval(this._pingInterval);
			if (this._awaitingPromises.head.next != null) {
				console.warn(`[kelimelik.js] Server connection was destroyed with unresolved waitForPacket() promises.`);
			}
			this._awaitingPromises = null;
			this.emit("close");
		});
	}
}

export { ServerConnection, ServerOptions };