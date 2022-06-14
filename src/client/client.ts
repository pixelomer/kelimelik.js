import { Packet } from "../packet";
import { User } from "./user";
import { OpponentStats } from "./opponent-stats";
import { GameSummary } from "./game-summary";
import { GlobalStats } from "./global-stats";
import { ServerConnection, ServerOptions } from "./server-connection";
import { GameInvitation } from "./game-invitation";
import { Game, GameType } from "./game";
import net from "net";

interface UserCredentials {
	username: string;
	password: string;
	userID: string;
}

interface SystemMessage {
	message: string;
	important: boolean;
}

declare interface Client {
	on(event: string, listener: (packet: Packet) => void): this;
	once(event: string, listener: (packet: Packet) => void): this;
	emit(event: string, packet: Packet): boolean;

	on(event: "close", listener: () => void): this;
	once(event: "close", listener: () => void): this;
	emit(event: "close"): boolean;

	on(event: "login", listener: () => void): this;
	once(event: "login", listener: () => void): this;
	emit(event: "login"): boolean;

	on(event: "systemMessage", listener: (message: SystemMessage) => void): this;
	once(event: "systemMessage", listener: (message: SystemMessage) => void): this;
	emit(event: "systemMessage", message: SystemMessage): boolean;

	on(event: "newInvitation", listener: (invitation: GameInvitation) => void): this;
	once(event: "newInvitation", listener: (invitation: GameInvitation) => void): this;
	emit(event: "newInvitation", invitation: GameInvitation): boolean;

	on(event: "gameCreated", listener: (invitation: GameSummary) => void): this;
	once(event: "gameCreated", listener: (invitation: GameSummary) => void): this;
	emit(event: "gameCreated", invitation: GameSummary): boolean;
}

class Client extends ServerConnection {
	/** The currently logged in user. */
	user: User;

	/** Online player count or `null` if not authenticated. */
	onlinePlayerCount: number;

	/** Stats about the entire game. */
	globalStats: GlobalStats;

	/** Invitations for the logged in user or `null` if not authenticated. */
	gameInvitations: Map<number, GameInvitation>;

	/** Ongoing and completed game summaries. */
	gameSummaries: Map<number, GameSummary> = new Map<number, GameSummary>();

	/** Fetched games. */
	games: Map<number, Game> = new Map<number, Game>();

	/** Opponent stats for the logged in user or `null` if not authenticated. */
	opponentStats: Map<number, OpponentStats>;

	/** Whether the client authenticated or not. */
	loggedIn: boolean;

	/** Fetch player stats and global stats. */
	async updateStats(): Promise<void> {
		this.sendPacket(new Packet("GameModule_requestPlayerStats"));
		await this.waitForPacket("GameModule_playerStats");
	}

	/** Create a guest account. */
	async createGuestAccount(): Promise<UserCredentials> {
		await this.sendPacket(new Packet("GameModule_requestCreateGuestAccount"));
		return this._waitForCreateAccountResponse(false);
	}

	/** Wait for an account creation response. */
	async _waitForCreateAccountResponse(shouldAccountExist: boolean): Promise<UserCredentials> {
		if (typeof shouldAccountExist !== 'boolean') {
			throw new Error("shouldAccountExist parameter must be a boolean.");
		}
		const packet = await this.waitForPacket("GameModule_createAccountResponse");
		switch (packet.data[0]) {
			case 0: 
				if (!shouldAccountExist) return null;
				throw new Error("This email address is not in use.");
			case 1: return {
				userID: packet.data[1],
				username: packet.data[2],
				password: packet.data[4]
			};
			case 3:
				if (shouldAccountExist) return null;
				throw new Error("This email address is in use.");
			case 5:
				throw new Error("Incorrect password.");
			case 8:
				throw new Error("Malformed email address.");
			default:
				throw new Error("Unknown authentication error (" + packet.data[0] + ").");
		}
	}

	/** Register a new account with an email address. */
	async registerAccount(email: string, username: string): Promise<UserCredentials> {
		// Email
		await this.sendPacket(new Packet("GameModule_requestCreateAccountSubmitEmail", [email]));
		await this._waitForCreateAccountResponse(false);

		// Username
		await this.sendPacket(new Packet("GameModule_requestCreateAccountSubmitUsername", [username]));
		return this._waitForCreateAccountResponse(false);
	}

	/** Retrieves the user ID of a user with an email address and password. */
	async retrieveUser(email: string, password: string): Promise<UserCredentials> {
		// Email
		await this.sendPacket(new Packet("GameModule_requestCreateAccountSubmitEmail", [email]));
		await this._waitForCreateAccountResponse(true);

		// Email and password
		await this.sendPacket(new Packet("GameModule_requestRetrieveAccount", [email, password]));
		return await this._waitForCreateAccountResponse(true);
	}

	/** Authenticate with the game server. */
	async authenticate(user: number | string, password: string, version: number = 341): Promise<User> {
		// Get the user ID for the user if an email address was specified.
		if (typeof user === 'string') {
			if (user.match(/^[0-9]+$/)) {
				user = parseInt(user);
			}
			else {
				const userData = await this.retrieveUser(user, password);
				user = userData.userID;
			}
		}

		// Try logging in.
		await this.sendPacket(new Packet("GameModule_requestLogin", [ user, password, version ]));
		const packet = await this.waitForPacket(["GameModule_loginAccepted", "GameModule_loginRefused"]);
		if (packet.header == "GameModule_loginRefused") {
			throw new Error("Login refused.");
		}

		// Wait for the last login response packet.
		// The user object should be complete after this packet is received.
		//
		// Player stats aren't normally sent as part of the login packets,
		// instead the client requests them right after receiving the
		// purchase data packet.
		await this.waitForPacket("GameModule_playerStats");

		// Return the user object.
		return this.user;
	}

	constructor(socket?: net.Socket);
	constructor(options?: ServerOptions);
	constructor(arg1?: net.Socket | ServerOptions) {
		//@ts-ignore
		super(arg1);

		this.setMaxListeners(0);
		this.user = new User(this);
		this.globalStats = new GlobalStats(this);

		this.once("GameModule_loginAccepted", (packet) => {
			this.loggedIn = true;
		});

		this.once("GameModule_playerStats", () => {
			this.emit("login");
		});

		const gamesListHandler = (packet: Packet) => {
			GameSummary.from(packet, this).forEach((summary) => {
				this.gameSummaries.set(summary.gameID, summary);
			});
		};
		this.once("GameModule_userCompletedGamesList", gamesListHandler);
		this.once("GameModule_userGamesList", gamesListHandler);

		this.once("GameModule_opponentStats", (packet) => {
			this.opponentStats = OpponentStats.from(packet, this);
		});

		this.once("GameModule_userPurchaseData", (packet) => {
			this.updateStats();
		});

		this.once("GameModule_userInvitations", (packet) => {
			this.gameInvitations = new Map(GameInvitation.from(packet, this).map(val => [val.userID, val]));
		});

		this.on("GameModule_newInvitation", (packet) => {
			const invitation = new GameInvitation(this, packet);
			this.gameInvitations.set(invitation.userID, invitation);
			this.emit("newInvitation", invitation);
		});

		this.on("GameModule_gameCreated", (packet) => {
			const summary = new GameSummary(this, packet);
			this.gameSummaries.set(summary.gameID, summary);
			this.emit("gameCreated", summary);
		});

		this.on("GameModule_showMessage", (packet) => {
			this.emit("systemMessage", {
				message: packet.data[0],
				important: (packet.data[1] == 1)
			});
		});

		this.on("GameModule_gameInfo", (packet) => {
			const game = new Game(this, packet);
			if (!this.games.has(game.gameID)) {
				this.games.set(game.gameID, game);
			}
		});

		this.on("outgoingPacket", (packet) => {
			if (packet.header === "GameModule_requestDeleteCompletedGameList") {
				const IDs = packet.data[0];
				if (Array.isArray(IDs) && (typeof IDs[0] === 'number')) {
					for (const ID of IDs) {
						this.gameSummaries.delete(ID);
						this.games.delete(ID);
					}
				}
			}
		});
	}

	async deleteCompletedGames(IDs: number[]): Promise<void> {
		await this.sendPacket(new Packet("GameModule_requestDeleteCompletedGameList", [IDs]));
	}

	/** Fetches a game by game ID. */
	async fetchGame(gameID: number): Promise<Game> {
		if (typeof gameID !== 'number') {
			throw new TypeError("Game ID must be a number.");
		}
		if (this.games.has(gameID)) {
			return this.games.get(gameID);
		}
		await this.sendPacket(new Packet("GameModule_requestGameInfo", [gameID]));
		while (true) {
			const response = await this.waitForPacket(["GameModule_gameInfo", "GameModule_generalError"]);
			if (response.header === "GameModule_generalError") {
				throw new Error("No such game.");
			}
			if (response.data[0] === gameID) break;
		}
		return this.games.get(gameID);
	}

	/** Invites a user. */
	async inviteUserToGame(username: string, gameType: GameType): Promise<void> {
		const request = new Packet("GameModule_requestGameInvitationToUserEx", [username, gameType]);
		await this.sendPacket(request);
		const response = await this.waitForPacket("GameModule_invitationResponse");
		switch (response.data[0]) {
			case 0:
				return;
			case 1:
				throw new Error("You already invited this person.");
			case 3:
				throw new Error("You can only be in 20 active games at a time.")
			case 4:
				throw new Error("No such player: " + response.data[1]);
			case 5:
				throw new Error("You were blocked by this person.");
			default:
				throw new Error(`An unknown error occurred (${response.data[0]})`);
		}
	}
}

// Exports
export { Client };