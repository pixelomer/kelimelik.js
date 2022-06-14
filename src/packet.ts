const ObjectTypes = {
	String: 7,
	Int8: 1,
	Int32: 0,
	Array: 8,
	Date: 3
};

class Packet {
	/** Packet header such as "GameModule_requestLogin". */
	header: string;

	/** Data in the packet. */
	data: any[];

	constructor(header: string, data: any[] = null) {
		this.header = header;
		this.data = data || [];
	}

	/** Creates a Kelimelik packet buffer from the packet object. */
	encode(): Buffer {
		if (this.data.length > 0xFF) {
			throw new Error("A packet cannot contain more than 255 root objects.");
		}

		const chunkSize = 512;
		let buffer = Buffer.allocUnsafe(chunkSize);
		let dataSize = 4;
		let head = 4;

		_encodeString(this.header);
		_extendBuffer(1);
		buffer.writeUInt8(this.data.length, head);

		function _subtypeByteForArray(array: any[]): number {
			if (array.length == 0) {
				return ObjectTypes.Int32;
			}
			let typeByte = _typeByteForObject(array[0]);
			if (typeByte == null) {
				return null;
			}
			return array.some((object) => {
				return (_typeByteForObject(object) != typeByte);
			}) ? null : typeByte;
		}
		
		function _typeByteForObject(object: any): number {
			if (typeof object === 'string') {
				return ObjectTypes.String;
			}
			else if ((typeof object === 'number') || (typeof object === 'boolean')) {
				// Encoder does not support Int8 objects (1).
				return ObjectTypes.Int32;
			}
			else if (Array.isArray(object)) {
				// Subtype will be determined elsewhere.
				return ObjectTypes.Array;
			}
			else if ((object instanceof Date) || (typeof object === 'bigint')) {
				// Both dates and bigints are stored as UInt64 objects.
				return ObjectTypes.Date;
			}
			else {
				// This object cannot be encoded.
				return null;
			}
		}

		function _extendBuffer(size: number) {
			head = dataSize;
			dataSize += size;
			if (dataSize > buffer.length) {
				const newBuffer = Buffer.allocUnsafe(buffer.length + (chunkSize * Math.ceil(size / chunkSize)));
				buffer.copy(newBuffer, 0, 0, buffer.length);
				buffer = newBuffer;
			}
		}

		function _encodeString(string: string) {
			const stringBuffer = Buffer.from(string, 'utf-8');
			_extendBuffer(stringBuffer.length + 2);
			buffer.writeUInt16BE(stringBuffer.length, head);
			stringBuffer.copy(buffer, head + 2, 0, stringBuffer.length);
		}

		/**
		 * @param object Object to encode.
		 * @param type Type to assume. When this parameter is specified, the object will be assumed to be an array element and its type byte will not be written to the buffer.
		 */
		function _encodeElement(object: any, type: number = null) {
			if (type == null) {
				type = _typeByteForObject(object);
				if (type == null) {
					throw new Error(`Attempted to encode unrecognized object: ${object}`);
				}
				_extendBuffer(1);
				buffer.writeUInt8(type, head);
			}
			else if (type !== _typeByteForObject(object)) {
				throw new Error(`Type mismatch. Expected type ${type} for object: ${object}`);
			}
			switch (type) {
				case ObjectTypes.Int32:
					_extendBuffer(4);
					buffer.writeInt32BE(+object, head);
					break;
				case ObjectTypes.Int8:
					_extendBuffer(1);
					buffer.writeInt8(object, head);
					break;
				case ObjectTypes.Date:
					if (object instanceof Date) {
						object = Math.floor(object.getTime() / 1000);
					}
					_extendBuffer(8);
					buffer.writeBigInt64BE(BigInt(object), head);
					break;
				case ObjectTypes.String:
					_encodeString(object);
					break;
				case ObjectTypes.Array:
					const subtype = _subtypeByteForArray(object);
					if (subtype == null) {
						throw new Error(`Failed to get subtype for array, make sure all elements in the array are of the same type: ${object}`);
					}
					_extendBuffer(5);
					buffer.writeUInt32BE(object.length, head);
					buffer.writeUInt8(subtype, head + 4);
					object.forEach((element) => {
						_encodeElement(element, subtype);
					});
			}
		}

		this.data.forEach((object) => _encodeElement(object));
		buffer.writeUInt32BE(dataSize-4, 0);
		return buffer.slice(0, dataSize);
	}

	/**
	 * Creates a packet object using a Kelimelik packet buffer.
	 * @param buffer
	 * @returns Packet object.
	 */
	static from(buffer: Buffer): Packet {
		let head = 0;

		/**
		 * @returns {string} The string (16-bit size followed by data) at the parser head.
		 */
		function _parsestring(): string {
			const stringLength = buffer.readUInt16BE(head);
			head += 2;
			const stringBuffer = buffer.slice(head, head + stringLength);
			const string = stringBuffer.toString('utf-8');
			head += stringLength;
			return string;
		}
		
		/**
		 * @param type Specify this parameter to assume a specific type. A type byte will not be read when this is specified.
		 * @returns JavaScript object for this element.
		 */
		function _parseElement(type: number = null): any {
			if (type == null) {
				type = buffer.readUInt8(head++);
			}
			let value = null;
			switch (type) {
				case ObjectTypes.Int32:
					value = buffer.readInt32BE(head);
					head += 4;
					break;
				case ObjectTypes.Int8:
					value = buffer.readInt8(head++);
					break;
				case ObjectTypes.Date:
					value = new Date(Number(buffer.readBigInt64BE(head)) * 1000);
					head += 8;
					break;
				case ObjectTypes.String:
					value = _parsestring();
					break;
				case ObjectTypes.Array:
					value = new Array();
					const count = buffer.readInt32BE(head);
					head += 4;
					const subType = buffer.readUInt8(head++);
					for (let i=0; i<count; i++) {
						value.push(_parseElement(subType));
					}
					break;
			}
			return value;
		}

		// Verify size
		const size = buffer.readUInt32BE(head);
		head += 4;
		if ((buffer.length - 4) != size) {
			throw new Error("Size verification failed. Packet size is different from the size in the packet.");
		}

		// Read header
		const packet = new Packet(_parsestring());

		// Read object count
		const count = buffer.readUInt8(head++);

		// Parse
		for (let i=0; i<count; i++) {
			packet.data.push(_parseElement());
		}

		// Return packet
		return packet;
	}
}

export { Packet };