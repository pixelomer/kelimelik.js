# kelimelik.js

kelimelik.js, Türkçe bir mobil Scrabble oyunu olan [Kelimelik](https://he2apps.com/kelimelik.html) oyununa bağlanmak için bir [Node.js](https://nodejs.org/) kütüphanesidir. kelimelik.js, bot yazmak ve oyun içi istatistik takibi yapmak gibi birçok amaçla kullanılabilir.

## Özellikler

Kelimelik'e giriş yapma, oyun oluşturma ve hamle yapma gibi temel özellikler desteklenmektedir ancak daha tamamlanmamış birçok özellik bulunmaktadır. Kütüphane hala geliştirme aşamasında olduğu için yeni özellikler eklendikçe daha önceden kelimelik.js ile yazılmış olan programların güncellenmesi gerekebilir.

## Örnek Kullanım

Bir misafir hesabı oluşturma, giriş yapma ve oyun-içi istatistikleri yazdırma:

```js
const { Client } = require("kelimelik.js");

(async function() {
  const client = new Client();
  const guest = await client.createGuestAccount();
  await client.authenticate(guest.userID, guest.password);
  const stats = client.globalStats;
  console.log(
    "Online kullanıcı sayısı:", stats.onlinePlayerCount, "\n" +
    " Devam eden oyun sayısı:", stats.ongoingGameCount, "\n" +
    "     Toplam oyun sayısı:", stats.totalGameCount, "\n" +
    " Total kullanıcı sayısı:", stats.totalPlayerCount
  );
  client.destroyConnection();
})();
```

Var olan bir hesaba giriş yapıp davet geldikçe bu davetleri otomatik olarak kabul etme:

```js
const { Client } = require("kelimelik.js");

(async function() {
  const client = new Client();
  await client.authenticate(process.env.EMAIL, process.env.PASSWORD);
  console.log("Yeni davetler bekleniyor.");
  client.on("newInvitation", async(invitation) => {
    console.log(`"${invitation.username}" adlı kullanıcının daveti kabul ediliyor...`);
    await invitation.accept();
  });
})();
```

Daha fazla örnek için `examples/` klasörüne bakabilirsiniz.

## Oyun Protokolü

Oyun protokolü hakkında detaylı bilgi için [GameProtocol.md](GameProtocol.md) dosyasına bakabilirsiniz.

---

Kelimelik ve he2apps, hiçbir şekilde kelimelik.js ile bağlantılı değildir.