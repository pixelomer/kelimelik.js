import { Packet } from "../packet";
import { ServerConnection } from "./server-connection";

class GlobalStats {
	connection: ServerConnection;
	totalPlayerCount: number;
	ongoingGameCount: number;
	totalGameCount: number;
	onlinePlayerCount: number;

	constructor(connection: ServerConnection) {
		this.connection = connection;
		connection.on("GameModule_loginAccepted", (packet) => {
			this.onlinePlayerCount = packet.data[5];
		});
		connection.on("GameModule_playerStats", (packet) => {
			this.totalPlayerCount = packet.data[12];
			this.ongoingGameCount = packet.data[13];
			this.totalGameCount = packet.data[14];
		});
	}
}

export { GlobalStats };