# Kelimelik Protocol

The mobile Scrabble game [Kelimelik](https://he2apps.com/kelimelik.html) uses a simple unencrypted protocol over TCP for server communication. The official server uses port 443. Every number in this protocol use the Big Endian ordering.

## Packets

```
SS SS SS SS LL LL ... CC ...

S: Packet size
L: Header length
C: Number of objects in packet
```
Each packet starts with a 32-bit number that specifies the size of the packet excluding the size itself, followed by a header (see [String \(Type 7\)](#string-type-7)). The header is followed by the number of objects in the packet and then the objects themselves.

## Objects

```
TT ...

T: Type ID
```
Each object starts with an 8-bit type ID. This type ID specifies what kind of data this object encodes.

### 32-bit number (Type 0)

```
00 VV VV VV VV

V: Value
```

### 8-bit number (Type 1)

```
01 VV

V: Value
```

### Date (Type 3)

```
03 TT TT TT TT TT TT TT TT

T: Timestamp
```
Each date object contains a Unix timestamp (The number of seconds since the midnight of January 1, 1970).

### String (Type 7)

```
07 LL LL ...

L: Length
```
String objects contain the length of the string and then the string itself.

### Array (Type 8)

```
08 LL LL LL LL TT ...

L: Length
T: Type ID
```
Array objects start with a length specifying the number of objects in the array, followed by a type ID specifying the types of objects in the array, followed by the objects themselves. Each array in this protocol can only contain one type of object. Objects in the array do not start with a type ID.

It is technically possible to encode an array containing other arrays, and kelimelik.js is capable of doing it. However, this is never done by the official server.

## Example packet

Data:
```
00 00 00 2C
00 0B H  e  l  l  o  _  W  o  r  l  d
03
07 00 09 K  e  l  i  m  e  l  i  k
03 00 00 00 00 00 00 00 00
08 00 00 00 03 01 01 02 03
```

Decoded:
```javascript
{
  header: "Hello_World",
  data: [
    "Kelimelik",
    new Date(0),
    [1, 2, 3]
  ]
}
```