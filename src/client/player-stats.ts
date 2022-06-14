import { ServerConnection } from "./server-connection";

interface BestMove {
	word: string,
	score: number
};

class PlayerStats {
	connection: ServerConnection;

	/** The number of games the player has won. */
	wonGameCount: number;

	/** The number of games the player has lost. */
	lostGameCount: number;

	/** The number of games that ended in a draw. */
	drawGameCount: number;

	/** The number of games the player surrendered from. */
	surrenderedGameCount: number;

	/** The highest game score. */
	highestGameScore: number;

	/** The highest move score. */
	highestMoveScore: number;

	/** The longest word. */
	longestWord: number;

	/** The best move the player made. */
	bestMove: BestMove;

	/** The number of valid words the player used in games. */
	totalMoveCount: number;

	/** Player's total score. */
	totalScore: number;

	constructor(connection: ServerConnection) {
		this.connection = connection;
		connection.on("GameModule_playerStats", (packet) => {
			this.wonGameCount = packet.data[0];
			this.lostGameCount = packet.data[1];
			this.drawGameCount = packet.data[2];
			this.surrenderedGameCount = packet.data[3];
			this.highestGameScore = packet.data[5];
			this.highestMoveScore = packet.data[6];
			this.bestMove = {
				word: packet.data[7],
				score: packet.data[8]
			};
			this.longestWord = packet.data[9];
			this.totalMoveCount = packet.data[10];
			this.totalScore = packet.data[11];
		});
	}
}

export { PlayerStats };