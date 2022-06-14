const kelimelik = require('../dist/kelimelik');

if (process.argv.length < 4) {
	console.error("Usage:\n  login.js <email> <password>\n  login.js <userID> <password>");
	process.exit(1);
}

async function main() {
	const client = new kelimelik.Client();

	// Authenticate
	const user = await client.authenticate(process.argv[2], process.argv[3]);
	console.log(`
Username ......... ${user.username}
Password ......... ${user.password}
User ID .......... ${user.userID}
Email ............ ${user.emailAddress || "(not set)"}
Coins ............ ${user.purchaseData.coinAmount}
Completed Games .. ${user.playerStats.wonGameCount + user.playerStats.lostGameCount}
Won .............. ${user.playerStats.wonGameCount}
Lost ............. ${user.playerStats.lostGameCount}
Draw ............. ${user.playerStats.drawGameCount}
Surrender ........ ${user.playerStats.surrenderedGameCount}
Best Game ........ ${user.playerStats.highestGameScore} points
Best Move ........ "${user.playerStats.bestMove.word}", ${user.playerStats.bestMove.score} points
Longest Word ..... "${user.playerStats.longestWord}"
Total Moves ...... ${user.playerStats.totalMoveCount} moves
Total Score ...... ${user.playerStats.totalScore} points

${client.globalStats.onlinePlayerCount} players online
`);

	client.destroyConnection();

	return 0;
}

main().then((status) => process.exit(status));