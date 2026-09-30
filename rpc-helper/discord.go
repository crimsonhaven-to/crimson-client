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

// Every Discord IPC message is: int32 opcode (LE) | int32 length (LE) | JSON.
const (
	opHandshake = 0
	opFrame     = 1
	opClose     = 2
	opPing      = 3
	opPong      = 4
)

// A write to a wedged pipe would otherwise block forever while holding the
// presence lock and starve the read loop. Timing out lets the error path reconnect.
const writeTimeout = 5 * time.Second

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

// The page's `buttons: [{label,url}]` already match Discord's IPC schema, so the
// activity passes through as is. A null activity stays nil, which clears presence.
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

// Discord only echoes the nonce back to pair replies with requests, so it just
// needs to be unique per frame.
func newNonce() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
