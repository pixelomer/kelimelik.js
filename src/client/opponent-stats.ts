import { Packet } from "../packet";
import { ServerConnection } from "./server-connection";

class OpponentStats {
	connection: ServerConnection;
	userID: number;
	wonGameCount: number;
	finishedGameCount: number;
	winPercentage: number;

	/** Creates zero or more opponent stats objects from a packet. */
	static from(packet: Packet, connection: ServerConnection): Map<number, OpponentStats> {
		const result = new Map();
		for (let i=0; i<packet.data[0].length; i++) {
			const stats = new OpponentStats(connection);
			stats.userID = packet.data[0][i];
			stats.finishedGameCount = packet.data[5][i];
			stats.winPercentage = packet.data[6][i];
			stats.wonGameCount = packet.data[1][i];
			result.set(stats.userID, stats);
		}
		return result;
	}

	constructor(connection: ServerConnection) {
		this.connection = connection;
	}
}

export { OpponentStats };