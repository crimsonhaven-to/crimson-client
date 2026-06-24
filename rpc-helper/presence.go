package main

import (
	"encoding/json"
	"log"
	"net"
	"os"
	"sync"
	"time"
)

const (
	// browserGrace is how long we keep a presence alive after the last browser
	// tab drops. The site's own RPC client reconnects on a ~15s timer (and tabs
	// reload / navigate), so a generous grace bridges those gaps and stops the
	// presence from flickering off and back on.
	browserGrace = 60 * time.Second

	// reassertPeriod is how often we re-push the current activity. This one timer
	// does double duty: it keeps a long-lived presence fresh, and transparently
	// reconnects + restores it if Discord is quit and reopened. Comfortably under
	// Discord's SET_ACTIVITY rate limit (~5 per 20s).
	reassertPeriod = 15 * time.Second
)

// presence owns the single, long-lived link to Discord and the activity to show
// on it. It is shared by every browser connection, so reconnecting tabs reuse
// one Discord pipe instead of each churning their own (which caused both the
// stall and the flicker in the first version).
type presence struct {
	mu       sync.Mutex
	clientID string
	pid      int
	current  any         // transformed activity to display, or nil for "nothing"
	conn     net.Conn    // the Discord IPC pipe, lazily (re)dialed
	browsers int         // how many site tabs are currently attached
	clearTmr *time.Timer // pending retirement once nobody's watching

	onStatus func(string) // optional UI hook (the tray); may be nil
}

func newPresence() *presence {
	p := &presence{
		pid: os.Getpid(),
	}
	go p.loop()
	return p
}

// browserConnected/Disconnected track attached tabs so the presence survives
// brief drops: it's only retired once nobody has been watching for browserGrace.
func (p *presence) browserConnected() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.browsers++
	if p.clearTmr != nil {
		p.clearTmr.Stop()
		p.clearTmr = nil
	}
}

func (p *presence) browserDisconnected() {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.browsers > 0 {
		p.browsers--
	}
	if p.browsers == 0 && p.clearTmr == nil {
		p.clearTmr = time.AfterFunc(browserGrace, p.retire)
	}
}

// update records what the site wants shown and pushes it to Discord. A null
// activity (which the page only sends just before it disconnects) is ignored —
// the grace timer handles retirement, so a reconnect a moment later doesn't blink.
func (p *presence) update(clientID string, activity json.RawMessage) {
	if isNullActivity(activity) {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	p.clientID = clientID
	p.current = transformActivity(activity)
	p.pushLocked()
	p.status("watching")
}

// retire drops the presence once the grace period elapses with no viewers.
func (p *presence) retire() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.clearTmr = nil
	if p.browsers > 0 {
		return // a tab reconnected during the grace window
	}
	if p.current == nil {
		return
	}
	p.current = nil
	p.pushLocked() // clears it on Discord (if we're still linked)
	log.Print("   → presence retired (no viewers)")
	p.status("idle")
}

// loop re-applies the current presence on a steady cadence, which is also our
// reconnect path: if Discord was quit and reopened, the next tick redials and
// restores the activity without the browser having to do anything.
func (p *presence) loop() {
	t := time.NewTicker(reassertPeriod)
	defer t.Stop()
	for range t.C {
		p.mu.Lock()
		if p.current != nil {
			p.pushLocked()
		}
		p.mu.Unlock()
	}
}

// pushLocked sends p.current to Discord, dialing + handshaking first if needed
// and dropping the link on error so the next attempt reconnects cleanly.
// Caller must hold p.mu.
func (p *presence) pushLocked() {
	if p.current == nil && p.conn == nil {
		return // nothing to show and nothing connected — no work to do
	}
	if err := p.ensureLocked(); err != nil {
		// Discord most likely isn't running; stay quiet, the ticker will retry.
		return
	}
	frame := map[string]any{
		"cmd":   "SET_ACTIVITY",
		"nonce": newNonce(),
		"args":  map[string]any{"pid": p.pid, "activity": p.current},
	}
	if err := writeFrame(p.conn, opFrame, frame); err != nil {
		p.dropLocked()
	}
}

// ensureLocked guarantees a handshaken Discord connection. Caller must hold p.mu.
func (p *presence) ensureLocked() error {
	if p.conn != nil {
		return nil
	}
	c, err := dialDiscordPipe()
	if err != nil {
		return err
	}
	if err := writeFrame(c, opHandshake, map[string]any{"v": 1, "client_id": p.clientID}); err != nil {
		c.Close()
		return err
	}
	if _, _, err := readFrame(c); err != nil { // consume the READY dispatch
		c.Close()
		return err
	}
	p.conn = c
	go p.readLoop(c)
	log.Print("🔗 linked to Discord")
	return nil
}

// readLoop drains Discord's replies (so the pipe never backs up) and answers
// PINGs to keep the link alive. On any read error it drops the connection; the
// re-assert ticker then reconnects.
func (p *presence) readLoop(c net.Conn) {
	for {
		op, body, err := readFrame(c)
		if err != nil {
			p.mu.Lock()
			if p.conn == c {
				p.dropLocked()
				log.Print("🔌 Discord link lost — will reconnect")
			}
			p.mu.Unlock()
			return
		}
		switch op {
		case opPing:
			p.mu.Lock()
			if p.conn == c {
				_ = writeFrame(c, opPong, json.RawMessage(body))
			}
			p.mu.Unlock()
		case opClose:
			p.mu.Lock()
			if p.conn == c {
				p.dropLocked()
			}
			p.mu.Unlock()
			return
		}
	}
}

// dropLocked closes and forgets the Discord connection. Caller must hold p.mu.
func (p *presence) dropLocked() {
	if p.conn != nil {
		p.conn.Close()
		p.conn = nil
	}
}

func (p *presence) status(s string) {
	if p.onStatus != nil {
		p.onStatus(s)
	}
}
