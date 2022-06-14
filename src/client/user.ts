import { PurchaseData } from "./purchase-data";
import { Packet } from "../packet";
import { PlayerStats } from "./player-stats";
import { ServerConnection } from "./server-connection";

class User {
	connection: ServerConnection;

	/** Purchase data for this user. */
	purchaseData: PurchaseData;

	/** Username. */
	username: string;

	/** Password. */
	password: string;

	/** User ID. */
	userID: number;

	/** Stats for this user. */
	playerStats: PlayerStats;

	/** Email address. */
	emailAddress: string;

	/** Profile picture ID. */
	profilePictureID: string;

	async _waitForChangeResponse(): Promise<void> {
		const response = await this.connection.waitForPacket("GameModule_changeCredentialsResponse");
		switch (response.data[0]) {
			case 0:
				return;
			case 2:
				throw new Error("This username is already in use.");
			case 4:
				throw new Error("This email address is in use.");
			default:
				throw new Error(`An unknown error occurred (${response.data[0]})`)
		}
	}

	async changeEmail(email: string): Promise<void> {
		await this.connection.sendPacket(new Packet("GameModule_requestChangeEmail", [email]));
		await this._waitForChangeResponse();
	}

	/** Changes the username. */
	async changeUsername(username: string): Promise<void> {
		await this.connection.sendPacket(new Packet("GameModule_requestChangeUsername", [username]));
		await this._waitForChangeResponse();
	}

	/** Changes the password. */
	async changePassword(newPassword: string): Promise<void> {
		await this.connection.sendPacket(new Packet("GameModule_requestChangePassword", [newPassword]));
		await this._waitForChangeResponse();
	}

	constructor(connection: ServerConnection) {
		this.connection = connection;
		this.playerStats = new PlayerStats(connection);
		this.purchaseData = new PurchaseData(connection);
		connection.on("GameModule_loginAccepted", (packet) => {
			this.userID = packet.data[0];
			this.username = packet.data[1];
			this.profilePictureID = packet.data[2] || null;
			this.emailAddress = packet.data[3] || null;
			this.password = packet.data[4];
		});
		connection.on("GameModule_changeCredentialsResponse", (packet) => {
			this.username = packet.data[1];
			this.emailAddress = packet.data[2];
			this.password = packet.data[3];
		});
	}
}

export { User };