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
	// The site's RPC client reconnects on a ~15s timer and tabs reload or
	// navigate, so the grace bridges those gaps instead of flickering presence.
	browserGrace = 60 * time.Second

	// Also the reconnect path when Discord is quit and reopened. Well under
	// Discord's SET_ACTIVITY rate limit (~5 per 20s).
	reassertPeriod = 15 * time.Second
)

// One presence is shared by every browser connection, so reconnecting tabs reuse
// one Discord pipe instead of each churning their own.
type presence struct {
	mu       sync.Mutex
	clientID string
	pid      int
	current  any // nil means show nothing
	conn     net.Conn
	browsers int
	clearTmr *time.Timer

	onStatus func(string) // may be nil
}

func newPresence() *presence {
	p := &presence{
		pid: os.Getpid(),
	}
	go p.loop()
	return p
}

// Presence is only retired once no tab has been attached for browserGrace.
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

// The page only sends a null activity just before it disconnects. It is ignored
// so the grace timer handles retirement and a quick reconnect doesn't blink.
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
	p.pushLocked()
	log.Print("   → presence retired (no viewers)")
	p.status("idle")
}

// If Discord was quit and reopened, the next tick redials and restores the
// activity without the browser doing anything.
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

// Drops the link on error so the next attempt reconnects cleanly. Caller must
// hold p.mu.
func (p *presence) pushLocked() {
	if p.current == nil && p.conn == nil {
		return
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

// Caller must hold p.mu.
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

// Replies must be drained so the pipe never backs up. On a read error the link
// is dropped and the re-assert ticker reconnects.
func (p *presence) readLoop(c net.Conn) {
	for {
		op, body, err := readFrame(c)
		if err != nil {
			p.mu.Lock()
			if p.conn == c {
				p.dropLocked()
				log.Print("🔌 Discord link lost, will reconnect")
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

// Caller must hold p.mu.
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
