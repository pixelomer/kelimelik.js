import { EventEmitter } from "events";
import { Packet } from "./packet";

declare interface Parser {
	on(event: "packet", listener: (packet: Packet) => void): this;
	once(event: "packet", listener: (packet: Packet) => void): this;
	emit(event: "packet", packet: Packet): boolean;
}

class Parser extends EventEmitter {
	/** Buffer for temporarily storing raw packet data. */
	_buffer: Buffer;

	/**
	 * The number of bytes that are needed before the parser either resets or
	 * starts receiving packet contents.
	 */
	_remainingBytes: number;

	/** The next index to write to in _buffer. */
	_head: number;

	constructor() {
		super();
		this._buffer = Buffer.allocUnsafe(4);
		this._remainingBytes = 4;
		this._head = 0;
	}

	/** Advance the parser with new data. */
	advance(data: number | Buffer) {
		if (typeof data == 'number') {
			if ((data < 0) || (data > 255)) {
				throw new TypeError("Data must be in the range [0..255] when it's a number.");
			}
			const buffer = Buffer.allocUnsafe(1);
			buffer.writeUInt8(data, 0);
			data = buffer;
		}
		if (!(data instanceof Buffer)) return; // to make typescript happy
		while (data.length) {
			const copiedLen = Math.min(this._remainingBytes, data.length);
			data.copy(this._buffer, this._head, 0, copiedLen);
			this._head += copiedLen;
			this._remainingBytes -= copiedLen;
			if (this._remainingBytes == 0) {
				if (this._head == 4) {
					if ((this._remainingBytes = this._buffer.readInt32BE(0))) {
						const newBuffer = Buffer.allocUnsafe(this._remainingBytes + 4);
						this._buffer.copy(newBuffer, 0, 0, 4);
						this._buffer = newBuffer;
					}
				}
				else {
					const packet = Packet.from(this._buffer);
					this.emit("packet", packet);
				}
				if (this._remainingBytes == 0) {
					this._buffer = Buffer.allocUnsafe(4);
					this._head = 0;
					this._remainingBytes = 4;
				}
			}
			data = data.slice(copiedLen, data.length);
		}
	}
}

export { Parser };