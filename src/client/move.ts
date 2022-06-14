import { Packet } from "../packet";

enum MoveType {
	PlaceWord = "*word*",
	Skip = "*skip*",
	SwapLetters = "*swap*"
};

class Move {
	/** Move type. */
	moveType: MoveType;

	/** Points earned from the move. */
	pointsEarned: number;

	/** Whether the move was played by the opponent or not. */
	opponentMove: boolean;

	/** Played word. `null` if `moveType` isn't `MoveType.PlaceWord`. */
	word: string;

	constructor(packet?: Packet) {
		if (packet != null) {
			let rawWord: string;
			switch (packet.header) {
				case "GameModule_gameInfo":
					rawWord = packet.data[5];
					this.word = rawWord.length
						? rawWord.split(':').map((val) => val.charAt(0)).join('')
						: null;
					this.pointsEarned = packet.data[3];
					this.opponentMove = (packet.data[2] === 1);
					break;
				case "GameModule_wordSubmitAccepted":
					rawWord = packet.data[2];
					this.word = rawWord;
					this.opponentMove = null;
					this.pointsEarned = packet.data[6];
					break;
			}
			switch (rawWord) {
				case MoveType.Skip:
				case MoveType.SwapLetters:
					this.moveType = rawWord;
					this.pointsEarned = null;
					this.word = null;
					break;
				default:
					this.moveType = MoveType.PlaceWord;
			}
		}
	}
}

export { MoveType, Move };