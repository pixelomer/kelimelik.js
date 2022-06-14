import { Packet } from "../packet";
import { ServerConnection } from "./server-connection";
import { GameType } from "./game";

class GameInvitation {
	connection: ServerConnection;
	gameType: GameType;
	userID: number;
	username: string;
	profilePictureID: string;
	date: Date;
	accepted: boolean | null;

	async accept() {
		await this.connection.sendPacket(new Packet("GameModule_requestAcceptInvitation", [this.userID]));
		this.accepted = true;
	}

	async reject() {
		await this.connection.sendPacket(new Packet("GameModule_requestRejectInvitation", [this.userID]));
		this.accepted = false;
	}

	static from(packet: Packet, connection: ServerConnection): GameInvitation[] {
		const result = [];
		for (let i=0; i<packet.data[0].length; i++) {
			const invitation = new GameInvitation(connection);

			invitation.userID = packet.data[0][i];
			invitation.username = packet.data[1][i];
			invitation.profilePictureID = packet.data[2][i];
			invitation.date = packet.data[3][i];
			invitation.gameType = packet.data[4][i];

			result.push(invitation);
		}
		return result;
	}

	constructor(connection: ServerConnection, packet?: Packet) {
		this.connection = connection;
		if (packet != null) {
			this.username = packet.data[0];
			this.userID = packet.data[1];
			this.profilePictureID = packet.data[2];
			this.date = packet.data[3];
			this.gameType = packet.data[5];
		}
	}
}

export { GameInvitation };