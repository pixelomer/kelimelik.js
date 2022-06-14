import { Packet } from "../packet";
import { ServerConnection } from "./server-connection";

class PurchaseData {
	connection: ServerConnection;
	
	/** The number of coins the user has. */
	coinAmount: number;

	constructor(connection: ServerConnection) {
		this.connection = connection;
		connection.once("GameModule_userPurchaseData", (packet) => {
			this.coinAmount = packet.data[7];
		});
	}
}

export { PurchaseData };