# kelimelik.js

> Bu dosyanın Türkçe versiyonu için [README.tr.md](README.tr.md) adlı dosyaya bakabilirsiniz.

kelimelik.js is a [Node.js](https://nodejs.org/) library for interacting with the Turkish Scrabble game called [Kelimelik](https://he2apps.com/kelimelik.html). kelimelik.js can be used for various purposes like creating bots or tracking global game statistics.
- Abstractions for most of the game functionality
- Easy-to-use parser and encoder for the game protocol.

## Functionality

Most core functionality such as logging in, creating games and making moves is implemented. However, there is still a lost of functionality missing. Since the library is still in its early stages, new features could have breaking changes.

## Example Usage

Create a guest account, login and print global statistics for the game.

```js
const { Client } = require("kelimelik.js");

(async function() {
  const client = new Client();
  const guest = await client.createGuestAccount();
  await client.authenticate(guest.userID, guest.password);
  const stats = client.globalStats;
  console.log(
    "Online players:", stats.onlinePlayerCount, "\n" +
    " Ongoing games:", stats.ongoingGameCount, "\n" +
    "   Total games:", stats.totalGameCount, "\n" +
    " Total players:", stats.totalPlayerCount
  );
  client.destroyConnection();
})();
```

Login to an existing account and accept all new game invitations as they are created.

```js
const { Client } = require("kelimelik.js");

(async function() {
  const client = new Client();
  await client.authenticate(process.env.EMAIL, process.env.PASSWORD);
  console.log("Waiting for invitations.");
  client.on("newInvitation", async(invitation) => {
    console.log(`Accepting invitation from "${invitation.username}".`);
    await invitation.accept();
  });
})();
```

More examples can be found in the `examples/` folder.

## Game Protocol

Details about the game protocol can be found in [GameProtocol.md](GameProtocol.md).

## Notice

Kelimelik and he2apps are not affiliated with kelimelik.js.