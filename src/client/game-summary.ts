import { Packet } from "../packet";
import { Move, MoveType } from "./move";
import { ServerConnection } from "./server-connection";

declare interface GameSummary {
	on(event: "gameEnded", listener: () => void): this;
	once(event: "gameEnded", listener: () => void): this;
	emit(event: "gameEnded"): boolean;
}

class GameSummary {
	connection: ServerConnection;
	completed: boolean;
	gameID: number;
	opponentUserID: number;
	opponentName: string;
	winnerName: string;
	winnerUserID: number;
	opponentImageID: string;
	lastMoveDate: Date;
	opponentPoints: number;
	playerPoints: number;
	lastMove: Move;

	/** Creates zero or more game objects from a packet. */
	static from(packet: Packet, connection: ServerConnection): GameSummary[] {
		const result = [];
		if (packet.header == "GameModule_userCompletedGamesList") {
			for (let i=0; i<packet.data[0].length; i++) {
				const game = new GameSummary(connection, true);

				game.gameID = packet.data[0][i];
				game.opponentName = packet.data[1][i];
				game.opponentUserID = packet.data[2][i];
				game.winnerName = packet.data[3][i];
				game.winnerUserID = packet.data[4][i];
				game.opponentImageID = packet.data[5][i];
				game.playerPoints = packet.data[6][i];
				game.opponentPoints = packet.data[7][i];
				game.lastMoveDate = packet.data[8][i];
				
				result.push(game);
			}
		}
		else if (packet.header == "GameModule_userGamesList") {
			for (let i=0; i<packet.data[0].length; i++) {
				const game = new GameSummary(connection, false);

				game.gameID = packet.data[0][i];
				game.opponentName = packet.data[1][i];
				game.opponentUserID = packet.data[2][i];
				game.opponentImageID = packet.data[3][i];
				game.lastMoveDate = new Date(Date.now() - (packet.data[12][i] * 1000));
				game.playerPoints = packet.data[13][i];
				game.opponentPoints = packet.data[14][i];

				const hasOpponentPlayed = !!packet.data[7][i];
				const firstMoveHasBeenPlayed = packet.data[9][i];

				// Last move object
				if (!firstMoveHasBeenPlayed) {
					const lastMove = new Move();
					lastMove.opponentMove = hasOpponentPlayed;
					const word = packet.data[4][i];
					lastMove.pointsEarned = 0;
					switch (word) {
						case "*swap*":
							lastMove.moveType = MoveType.SwapLetters;
							break;
						case "*skip*":
							lastMove.moveType = MoveType.Skip;
							break;
						default:
							lastMove.moveType = MoveType.PlaceWord;
							lastMove.word = word;
							lastMove.pointsEarned = packet.data[5][i];
					}
					game.lastMove = lastMove;
				}
				result.push(game);
			}
		}
		else {
			throw new Error("This packet is not a game list packet.");
		}
		return result;
	}

	async delete() {
		if (!this.completed) {
			throw new Error("You cannot delete incomplete games.");
		}
		await this.connection.sendPacket(new Packet("GameModule_requestDeleteCompletedGameList", [ [ this.gameID ] ]));
	}

	constructor(connection: ServerConnection, completed: boolean);
	constructor(connection: ServerConnection, packet: Packet);
	constructor(connection: ServerConnection);

	constructor(connection: ServerConnection, data?: boolean | Packet) {
		this.connection = connection;
		if (typeof data === 'boolean') {
			this.completed = data;
			if (!data) {
				connection.once("GameModule_gameFinished", (packet) => {
					if (packet.data[0] === this.gameID) {
						this.completed = true;
					}
				});
			}
		}
		else if (data instanceof Packet) {
			const packet: Packet = data;
			if (packet.header !== "GameModule_gameCreated") {
				throw new Error("Unsupported packet header.");
			}
			this.completed = false;
			this.gameID = packet.data[0];
			this.opponentName = packet.data[1];
			this.opponentUserID = packet.data[2];
			this.opponentImageID = packet.data[3];
			this.lastMoveDate = null;
			this.opponentPoints = 0;
			this.playerPoints = 0;
		}
	}
}

export { GameSummary };