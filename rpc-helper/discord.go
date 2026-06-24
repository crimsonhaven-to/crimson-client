package main

import (
	"crypto/rand"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"sync"
)

// Discord IPC opcodes (the 4-byte op that prefixes every framed message).
const (
	opHandshake = 0
	opFrame     = 1
	opClose     = 2
	opPing      = 3
	opPong      = 4
)

// discordClient is a lazily-dialed connection to the local Discord IPC pipe for
// a single browser connection. It (re)connects on demand so the page can be
// toggled on before Discord is even running, and recovers if Discord is later
// quit and reopened.
type discordClient struct {
	clientID string

	mu   sync.Mutex
	conn net.Conn
}

// ensure returns a handshaken connection, dialing + handshaking if needed.
func (d *discordClient) ensure() (net.Conn, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.conn != nil {
		return d.conn, nil
	}

	c, err := dialDiscordPipe()
	if err != nil {
		return nil, err
	}
	// Handshake announces which application's name + art the card should wear.
	if err := writeFrame(c, opHandshake, map[string]any{"v": 1, "client_id": d.clientID}); err != nil {
		c.Close()
		return nil, err
	}
	// Discord replies with a DISPATCH/READY frame; consume it (and confirm the
	// pipe is healthy and the client_id was accepted).
	if _, _, err := readFrame(c); err != nil {
		c.Close()
		return nil, err
	}
	d.conn = c
	go d.readLoop(c)
	return c, nil
}

// write sends one framed message, (re)connecting first and dropping the
// connection on any write error so the next call starts clean.
func (d *discordClient) write(op int32, payload any) error {
	if _, err := d.ensure(); err != nil {
		return err
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.conn == nil {
		return fmt.Errorf("discord connection closed")
	}
	if err := writeFrame(d.conn, op, payload); err != nil {
		d.dropLocked()
		return err
	}
	return nil
}

// readLoop drains Discord's replies so the pipe never backs up, and answers
// PINGs with PONGs to keep the connection alive over long viewing sessions.
func (d *discordClient) readLoop(c net.Conn) {
	for {
		op, body, err := readFrame(c)
		if err != nil {
			d.mu.Lock()
			if d.conn == c {
				d.dropLocked()
			}
			d.mu.Unlock()
			return
		}
		switch op {
		case opPing:
			d.mu.Lock()
			if d.conn == c {
				_ = writeFrame(c, opPong, json.RawMessage(body))
			}
			d.mu.Unlock()
		case opClose:
			d.mu.Lock()
			if d.conn == c {
				d.dropLocked()
			}
			d.mu.Unlock()
			return
		}
	}
}

func (d *discordClient) setActivity(pid int, activity json.RawMessage) error {
	return d.write(opFrame, map[string]any{
		"cmd":   "SET_ACTIVITY",
		"nonce": newNonce(),
		"args": map[string]any{
			"pid":      pid,
			"activity": transformActivity(activity),
		},
	})
}

// clearActivity wipes the presence, but only if we're already connected — we
// don't want to dial Discord purely to clear something that was never set.
// (Dropping the pipe also clears presence, so this is belt-and-braces.)
func (d *discordClient) clearActivity() {
	d.mu.Lock()
	connected := d.conn != nil
	d.mu.Unlock()
	if !connected {
		return
	}
	_ = d.write(opFrame, map[string]any{
		"cmd":   "SET_ACTIVITY",
		"nonce": newNonce(),
		"args":  map[string]any{"pid": 0, "activity": nil},
	})
}

func (d *discordClient) Close() {
	d.mu.Lock()
	d.dropLocked()
	d.mu.Unlock()
}

// dropLocked closes and forgets the connection. Caller must hold d.mu.
func (d *discordClient) dropLocked() {
	if d.conn != nil {
		d.conn.Close()
		d.conn = nil
	}
}

// transformActivity adapts the browser's activity to what Discord's IPC expects.
// The page sends rich `buttons: [{label,url}]`, but over IPC Discord wants the
// labels as a string array with the URLs split out into metadata.button_urls.
// A null/empty activity stays null (that's how presence is cleared).
func transformActivity(raw json.RawMessage) any {
	if isNullActivity(raw) {
		return nil
	}
	var act map[string]any
	if err := json.Unmarshal(raw, &act); err != nil {
		return nil
	}

	if btns, ok := act["buttons"].([]any); ok && len(btns) > 0 {
		labels := make([]string, 0, len(btns))
		urls := make([]string, 0, len(btns))
		for _, b := range btns {
			bm, ok := b.(map[string]any)
			if !ok {
				continue
			}
			if l, ok := bm["label"].(string); ok {
				labels = append(labels, l)
			}
			if u, ok := bm["url"].(string); ok {
				urls = append(urls, u)
			}
		}
		act["buttons"] = labels
		meta, _ := act["metadata"].(map[string]any)
		if meta == nil {
			meta = map[string]any{}
		}
		meta["button_urls"] = urls
		act["metadata"] = meta
	}
	return act
}

func isNullActivity(raw json.RawMessage) bool {
	s := string(raw)
	return len(raw) == 0 || s == "null"
}

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

// newNonce returns a UUID-ish string; Discord only echoes it back to pair
// replies with requests, so it just needs to be unique per frame.
func newNonce() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
