const readline = require('readline');
const kelimelik = require('..');

const reader = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

function ask(question) {
	return new Promise((resolve, reject) => {
		reader.question(question, (answer) => {
			resolve(answer);
		});
	});
}

async function main() {
	// Ask for user
	const targetUser = await ask("User to invite: ");

	// Create client
	const client = new kelimelik.Client();
	const guestCreds = await client.createGuestAccount();
	await client.authenticate(guestCreds.userID, guestCreds.password);

	// Invite
	await client.inviteUserToGame(targetUser, kelimelik.GameType.SlowGame);

	return 0;
}

main().then((status) => process.exit(status));