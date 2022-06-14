import { Client, GameType } from "./client";
import readline from "readline";
import colors from "colors";

async function shellMain() {
	const reader = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: true
	});
	
	interface Command {
		description: string;
		args?: string;
		execute: Function;
		conditions?: Function[];
		argTypes?: number[];
	}

	let disconnected: boolean;
	let client: Client;
	let verbose = false;
	let failed = false;
	let shouldContinue = true;
	let interruptCommand: () => void = null;
	
	function ask(question: string): Promise<string> {
		return new Promise((resolve, reject) => {
			reader.question(question, (answer) => {
				resolve(answer);
			});
		});
	}

	reader.on("SIGINT", () => {
		if (interruptCommand != null) {
			interruptCommand();
		}
	});

	function resetClient() {
		if (client != null) {
			client.destroyConnection();
		}
		client = new Client();
		disconnected = false;
		client.on("close", () => {
			disconnected = true;
		});
		client.on("packet", (packet) => {
			if (verbose) {
				console.log(packet.header, packet.data);
			}
		});
	}

	resetClient();
	
	async function isConnected() {
		if (disconnected) {
			throw new Error("The client is not connected to the server.");
		}
	}
	
	async function isLoggedIn() {
		await isConnected();
		if (!client.loggedIn) {
			throw new Error("The client isn't logged in.");
		}
	}
	
	const commands: { [command: string]: Command } = {
		"help": {
			description: "Shows the command list.",
			args: "[commands...]",
			async execute() {
				function describe(command: string) {
					const object = commands[command] ?? { args: null, description: "(Unrecognized command)"};
					console.log(` ${command} ${object.args ?? ""}\n  ${object.description}`);
				}
				if (arguments.length > 0) {
					for (let i=0; i<arguments.length; i++) {
						describe(arguments[i]);
					}
				}
				else {
					Object.keys(commands).forEach((key) => {
						describe(key);
					})
				}
			}
		},
		"toggle-verbose": {
			description: "Disables or enables packet logging.",
			async execute() {
				verbose = !verbose;
				console.log(`${verbose ? "Enabled" : "Disabled"} verbose logging.`);
			}
		},
		"exit": {
			description: "Exits the kelimelik.js shell.",
			async execute() {
				shouldContinue = false;
			}
		},
		"clear": {
			description: "Clears the terminal.",
			async execute() {
				console.clear();
			}
		},
		"login": {
			description: "Logs into a Kelimelik account.",
			args: "<user> <password>",
			argTypes: [ 0, 0 ],
			conditions: [ isConnected ],
			async execute(rawUser: string, password: string) {
				if (client.loggedIn) {
					throw new Error("You are already logged in. Use \"reset\" to log out and reset the client.");
				}
				const username: number | string = rawUser.match(/^[0-9]+$/) ? parseInt(rawUser) : rawUser;
				if ((typeof username === 'number') && (username > 0x7FFFFFFF)) {
					throw new Error("Invalid user ID.");
				}
				const user = await client.authenticate(username, password);
				console.log(`Logged in as "${user.username}".`);
			}
		},
		"games": {
			description: "Lists all games.",
			conditions: [ isLoggedIn ],
			async execute() {
				client.gameSummaries.forEach((game) => {
					console.log(`[${game.gameID}] Against "${game.opponentName}", ${game.completed ? "completed" : "ongoing"}`);
				});
			}
		},
		"invitations": {
			description: "Lists all invitations.",
			conditions: [ isLoggedIn ],
			async execute() {
				client.gameInvitations.forEach((invitation) => {
					console.log(`[${invitation.userID}] Against "${invitation.username}", ${GameType[invitation.gameType]}`);
				});
			}
		},
		"reset": {
			description: "Disconnects and resets the client.",
			async execute() {
				resetClient();
			}
		},
		"accept": {
			description: "Accepts invitation.",
			conditions: [ isLoggedIn ],
			args: "<userID>",
			argTypes: [ 1 ],
			async execute(userID: number) {
				const invitation = client.gameInvitations.get(userID);
				if (invitation == null) {
					throw new Error("No such invitation.");
				}
				await invitation.accept();
			}
		},
		"eval": {
			description: "Executes JavaScript.",
			args: "<code...>",
			async execute() {
				const code = Array.from(arguments).join(" ");
				console.log(await eval(code));
			}
		},
		"reject": {
			description: "Rejects invitation.",
			conditions: [ isLoggedIn ],
			args: "<userID>",
			argTypes: [ 1 ],
			async execute(userID: number) {
				const invitation = client.gameInvitations.get(userID);
				if (invitation == null) {
					throw new Error("No such invitation.");
				}
				await invitation.reject();
			}
		},
		"move": {
			description: "Plays a move.",
			conditions: [ isLoggedIn ],
			args: "<gameID> <x> <y> <vertical> <letters>",
			argTypes: [ 1, 1, 1, 1, 0 ],
			async execute(gameID: number, x: number, y: number, vertical: number, letters: string) {
				console.log("Submitting move...");
				const game = await client.fetchGame(gameID);
				await game.submitMove(letters, x, y, vertical ? true : false);
				console.log("The move was accepted.");
			}
		},
		"invite": {
			description: "Invites a user.",
			conditions: [ isLoggedIn ],
			args: "<username> <72h|24h|5m|2h>",
			argTypes: [ 0, 0 ],
			async execute(username, mode) {
				const map = {
					"72h": GameType.SlowGame,
					"12h": GameType.FastGame,
					"5m": GameType.RapidGame5Minutes,
					"2m": GameType.RapidGame2Minutes
				};
				const gameType = map[mode];
				if (gameType == null) {
					throw new Error("Unrecognized game type.");
				}
				await client.inviteUserToGame(username, gameType);
			}
		},
		"create-guest": {
			description: "Creates a guest account.",
			conditions: [ isConnected ],
			async execute() {
				const credentials = await client.createGuestAccount();
				console.log(`User ID:  ${credentials.userID}`);
				console.log(`Password: ${credentials.password}`);
			}
		},
		"swap": {
			description: "Swaps letters.",
			conditions: [ isLoggedIn ],
			args: "<gameID> <letters>",
			argTypes: [ 1, 0 ],
			async execute(gameID, letters) {
				const game = await client.fetchGame(gameID);
				await game.swapLetters(letters);
			}
		},
		"messages": {
			description: "Shows messages for a game.",
			args: "<gameID>",
			argTypes: [ 1 ],
			conditions: [ isLoggedIn ],
			async execute(gameID: number) {
				const game = await client.fetchGame(gameID);
				let messages = await game.fetchMessages();
				messages = messages.sort((a, b) => a.date > b.date ? 1 : -1);
				for (const message of messages) {
					console.log(`${colors.bold(`[${message.date.toLocaleString()}] <${message.senderUserID === client.user.userID ? "You" : "Opponent"}>`)} ${message.message}`);
				}
			}
		},
		"delete-messages": {
			description: "Deletes all messages for a given game.",
			args: "<gameID>",
			argTypes: [ 1 ],
			conditions: [ isLoggedIn ],
			async execute(gameID: number) {
				const game = await client.fetchGame(gameID);
				await game.deleteMessages();
			}
		},
		"send": {
			description: "Sends a message.",
			args: "<gameID> [message...]",
			argTypes: [ 1, -1 ],
			async execute(gameID: number, message: string) {
				const game = await client.fetchGame(gameID);
				await game.sendMessage(message);
			}
		},
		"show": {
			description: "Shows the details of a game.",
			args: "<gameID>",
			argTypes: [ 1 ],
			conditions: [ isLoggedIn ],
			async execute(gameID: number) {
				const game = await client.fetchGame(gameID);
				console.log(game.map.join("\n") + "\n");
				const summary = client.gameSummaries.get(game.gameID);
				if (summary.completed) {
					console.log(`This game was completed at ${summary.lastMoveDate}`);
				}
				else {
					console.log(`Remaining letter count: ${game.remainingLetterCount}`);
					console.log(`Deck: ${game.letters}`);
					console.log(`My turn: ${game.waitingForOpponent ? "no" : "yes"}`);
				}
			}
		}
	}
	
	while (shouldContinue) {
		const prompt = colors.bold(`${failed ? "⛔️" : "✅"}${colors.underline("kelimelik.js")}> `);
		const rawCommand = (await ask(prompt)).trim();
		if (!rawCommand) {
			continue;
		}
		const argv: any[] = rawCommand.split(' ');
		const command = commands[argv[0]];
		if (command == null) {
			console.log(`Unknown command: ${argv[0]}`);
			failed = true;
			continue;
		}
		argv.splice(0, 1);
		if (command.argTypes != null) {
			failed = false;
			if (
				(command.argTypes[command.argTypes.length - 1] === -1) ?
				(argv.length < command.argTypes.length) :
				(argv.length !== command.argTypes.length)
			) {
				console.log("Invalid arguments.");
				failed = true;
				continue;
			}
			for (let i=0; i<command.argTypes.length; i++) {
				switch (command.argTypes[i]) {
					case 0:
						break;
					case 1:
						const arg: string = argv[i];
						if (arg.match(/^[0-9]+$/) == null) {
							console.log("Invalid arguments.");
							failed = true;
							break;
						}
						argv[i] = parseInt(argv[i]);
						if (!Number.isSafeInteger(argv[i])) {
							console.log("Integer too big.");
							failed = true;
							break;
						}
						break;
					case -1:
						argv[i] = argv.splice(i).join(" ");
						break;
				}
			}
			if (failed) continue;
		}
		const interruptPromise = new Promise<any>((resolve, reject) => {
			interruptCommand = reject.bind(undefined, new Error("Interrupted."));
		});
		try {
			if (command.conditions != null) {
				for (const condition of command.conditions) {
					await condition.call(command);
				}
			}
			await Promise.race([interruptPromise, command.execute(...argv)]);
			failed = false;
		}
		catch (error) {
			failed = true;
			if (error instanceof Error) {
				console.log(error.message);
			}
			else {
				console.log(error);
			}
		}
		interruptCommand = null;
	}

	if (client != null) {
		client.destroyConnection();
	}
	reader.close();
}

export { shellMain };