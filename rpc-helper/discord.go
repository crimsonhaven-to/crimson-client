package main

import (
	"crypto/rand"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"time"
)

// Discord IPC opcodes (the 4-byte op that prefixes every framed message).
const (
	opHandshake = 0
	opFrame     = 1
	opClose     = 2
	opPing      = 3
	opPong      = 4
)

// writeTimeout caps how long a single frame write may block. Without it, a write
// to a wedged pipe could stall forever while holding the presence lock, which
// would also starve the read loop — so we bound it and let the error path
// reconnect instead.
const writeTimeout = 5 * time.Second

// --- IPC framing ------------------------------------------------------------
// Every Discord IPC message is: int32 opcode (LE) | int32 length (LE) | JSON.

func writeFrame(c net.Conn, op int32, payload any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	buf := make([]byte, 8+len(body))
	binary.LittleEndian.PutUint32(buf[0:4], uint32(op))
	binary.LittleEndian.PutUint32(buf[4:8], uint32(len(body)))
	copy(buf[8:], body)
	_ = c.SetWriteDeadline(time.Now().Add(writeTimeout))
	_, err = c.Write(buf)
	return err
}

func readFrame(c net.Conn) (int32, []byte, error) {
	var header [8]byte
	if _, err := io.ReadFull(c, header[:]); err != nil {
		return 0, nil, err
	}
	op := int32(binary.LittleEndian.Uint32(header[0:4]))
	length := binary.LittleEndian.Uint32(header[4:8])
	body := make([]byte, length)
	if _, err := io.ReadFull(c, body); err != nil {
		return 0, nil, err
	}
	return op, body, nil
}

// transformActivity adapts the browser's activity to what Discord's IPC expects.
// The page sends rich `buttons: [{label,url}]`, which is exactly what Discord's
// local IPC schema validator expects.
// A null/empty activity stays nil (that's how presence is cleared).
func transformActivity(raw json.RawMessage) any {
	if isNullActivity(raw) {
		return nil
	}
	var act map[string]any
	if err := json.Unmarshal(raw, &act); err != nil {
		return nil
	}
	return act
}

func isNullActivity(raw json.RawMessage) bool {
	return len(raw) == 0 || string(raw) == "null"
}

// newNonce returns a UUID-ish string; Discord only echoes it back to pair
// replies with requests, so it just needs to be unique per frame.
func newNonce() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
