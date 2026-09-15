# GPT16 Kermit file-service profile KFS1

This profile deliberately preserves the working G16/1 display handshake.

## Layering

1. RS-232 octet stream
2. G16/1 session/display negotiation (unchanged)
3. Two multiplexed application representations after READY:
   - UTF-16LE conversational text
   - raw Kermit packets beginning with SOH at a UTF-16 code-unit boundary
4. Gateway exposes model function tools (`write_file`, `read_file`)
5. Model never emits or parses `[[A2:...]]`

## Kermit subset

Classic short packets:

`SOH LEN SEQ TYPE DATA CHECK CR`

- `LEN`, `SEQ`, `CHECK` use Kermit's printable `tochar(x)=x+0x20`.
- `LEN = DATA length + 3` (SEQ + TYPE + CHECK).
- Sequence is modulo 64.
- Type-1 checksum:
  `sum = bytes(LEN..DATA) mod 256`
  `check = tochar((sum + ((sum & 0xC0) >> 6)) & 0x3F)`
- Maximum data payload in KFS1: 80 bytes.
- Retry: resend identical packet and sequence, maximum 5 attempts.
- ACK=`Y`, NAK=`N`, ERROR=`E`.

Gateway -> Apple II file write:

`S -> Y, F(name) -> Y, D... -> Y, Z -> Y, B -> Y`

Text mode:
- gateway sends printable 7-bit ASCII plus LF
- Apple II stores DOS high-bit text
- LF is stored as CR
- unsupported Unicode becomes `?` before transfer

Apple II -> gateway file read:
- reciprocal sender uses the same S/F/D/Z/B sequence
- DOS high bit is stripped
- CR is returned as LF

## Multiplexing invariant

Kermit is recognized only when raw byte `0x01` occurs while no UTF-16LE low byte is pending.
Therefore U+0101 or any other UTF-16 code unit containing `0x01` in its high byte cannot accidentally start Kermit.

## G16 capability

Once reciprocal read/write is implemented, add to READY:

`FILES=KERMIT;KFS=1`

This is capability metadata, not a replacement for G16 display negotiation.

## Model-facing contract

The model sees ordinary function tools:
- `write_file(name, content)`
- `read_file(name)`

It does not need Kermit instructions and does not need Apple-II-specific control tokens.
