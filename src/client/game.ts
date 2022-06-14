import { EventEmitter } from "events";
import { Packet } from "../packet";
import { ServerConnection } from "./server-connection";

enum GameType {
	SlowGame = 0,
	FastGame = 1,
	RapidGame5Minutes = 2,
	RapidGame2Minutes = 3
};

interface GameMessage {
	gameID: number,
	senderUserID: number,
	message: string,
	date: Date
};

declare interface Game {
	on(event: "newTurn" | "gameEnded", listener: () => void): this;
	once(event: "newTurn" | "gameEnded", listener: () => void): this;
	emit(event: "newTurn" | "gameEnded"): boolean;
	
	on(event: "newMessage", listener: () => void): this;
	once(event: "newMessage", listener: () => void): this;
	emit(event: "newMessage", message: GameMessage): boolean;
}

class Game extends EventEmitter {
	connection: ServerConnection;
	gameID: number;
	opponentUserID: number;
	winnerUserID: number;
	letters: string;
	remainingLetterCount: number;
	map: string[]; // [y][x]
	bonusX: number;
	bonusY: number;
	waitingForOpponent: boolean;

	/** How long game lasted in seconds. */
	howLongGameLasted: number;

	constructor(connection: ServerConnection, packet: Packet) {
		super();
		this.connection = connection;
		this.gameID = packet.data[0];
		this.opponentUserID = packet.data[1];
		this.remainingLetterCount = packet.data[6];
		this.letters = packet.data[7];
		this.map = packet.data[8].replace(/#/g, '').match(/.{15}/g);
		this.howLongGameLasted = packet.data[9];

		const bonusLocation = packet.data[10] - 1;
		this.bonusX = bonusLocation % 15;
		this.bonusY = Math.floor(bonusLocation / 15);
		
		const wordSubmitAccepted = (packet: Packet) => {
			if (packet.data[0] !== this.gameID) {
				return;
			}
			const rawWord: string = packet.data[2];
			let word: string = rawWord.replace(/#./g, (substring) => substring.substr(1, 1));
			if (packet.data[1] !== this.opponentUserID) {
				word.split('').forEach((letter) => {
					this.letters = this.letters.replace(new RegExp(letter), '');
				});
			}
			if (word.startsWith('*')) {
				return;
			}
			let x: number = packet.data[4];
			let y: number = packet.data[3];
			while (word.length) {
				let str = this.map[y];
				if (str[x] === '.') {
					str = str.slice(0, x) + word[0] + str.slice(x + 1);
					this.map[y] = str;
					word = word.slice(1);
				}
				if (packet.data[5]) y++;
				else x++;
			}
		};
		connection.on("GameModule_wordSubmitAccepted", wordSubmitAccepted);

		const spawnNewLetters = (packet: Packet) => {
			if (packet.data[0] !== this.gameID) {
				return;
			}
			this.letters += packet.data[1] || "";
		};
		connection.on("GameModule_spawnNewLetters", spawnNewLetters);

		const newTurn = (packet: Packet) => {
			if (packet.data[0] !== this.gameID) {
				return;
			}
			this.waitingForOpponent = (packet.data[1] === this.opponentUserID);
			this.remainingLetterCount = packet.data[2];
			this.emit("newTurn");
		};
		connection.on("GameModule_newTurn", newTurn);

		const newMessage = (packet: Packet) => {
			if (packet.data[0] !== this.gameID) {
				return;
			}
			const message: GameMessage = {
				gameID: this.gameID,
				senderUserID: packet.data[1],
				message: packet.data[2],
				date: packet.data[3],
			};
			this.emit("newMessage", message);
		}
		connection.on("GameModule_userChat", newMessage);

		connection.once("GameModule_gameFinished", (packet) => {
			if (packet.data[0] !== this.gameID) {
				return;
			}
			this.winnerUserID = packet.data[1];
			this.howLongGameLasted = packet.data[3];
			this.remainingLetterCount = 0;
			this.waitingForOpponent = null;
			this.connection.removeListener("GameModule_newTurn", newTurn);
			this.connection.removeListener("GameModule_spawnNewLetters", spawnNewLetters);
			this.connection.removeListener("GameModule_wordSubmitAccepted", wordSubmitAccepted);
			this.emit("gameEnded");
		});
	}

	async surrender() {
		const packet = new Packet("GameModule_requestSurrender", [ this.gameID ]);
		await this.connection.sendPacket(packet);
	}

	async swapLetters(letters: string) {
		const packet = new Packet("GameModule_requestSwap", [ this.gameID, letters ]);
		await this.connection.sendPacket(packet);
	}

	async skipMove() {
		const packet = new Packet("GameModule_requestSkipMove", [ this.gameID ]);
		await this.connection.sendPacket(packet);
	}

	async submitMove(letters: string, x: number, y: number, vertical: boolean): Promise<void> {
		const packet = new Packet("GameModule_requestSubmitLetters", [
			this.gameID,
			letters,
			y,
			x,
			+vertical
		]);
		await this.connection.sendPacket(packet);
		const successPromise = new Promise<void>(async(resolve) => {
			while (true) {
				const response = await this.connection.waitForPacket("GameModule_wordSubmitAccepted");
				if (response.data[0] === this.gameID) resolve();
			}
		});
		const timeoutPromise = new Promise<void>((resolve, reject) => {
			setTimeout(() => {
				reject(new Error("Move submission timed out. The move might have been invalid."))
			}, 5000);
		});
		await Promise.race([successPromise, timeoutPromise]);
	}

	async fetchMessages(): Promise<GameMessage[]> {
		await this.connection.sendPacket(new Packet("GameModule_requestGameMessages", [
			this.gameID
		]));
		let response: Packet;
		do {
			response = await this.connection.waitForPacket("GameModule_gameMessages");
		}
		while (response.data[0] !== this.gameID);
		const messages: GameMessage[] = [];
		for (let i=0; i<response.data[1].length; i++) {
			messages.push({
				gameID: this.gameID,
				senderUserID: response.data[1][i],
				message: response.data[2][i],
				date: response.data[3][i]
			});
		}
		return messages;
	}

	async deleteMessages(): Promise<void> {
		await this.connection.sendPacket(new Packet("GameModule_requestDeleteMessages", [
			this.gameID
		]));
	}

	async sendMessage(message: string): Promise<void> {
		await this.connection.sendPacket(new Packet("GameModule_requestSendMessage", [
			this.gameID,
			message
		]));
	}

	async markAllMessagesAsRead() {
		await this.connection.sendPacket(new Packet("GameModule_requestEnterChatScene", [
			this.gameID
		]));
		await this.connection.sendPacket(new Packet("GameModule_requestLeaveChatScene", [
			this.gameID
		]));
	}
}

export { Game, GameType };