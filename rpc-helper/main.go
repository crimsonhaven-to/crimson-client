// Command crimson-presence-helper is the little bridge that lets Crimson Haven's
// browser-based Discord Rich Presence actually reach Discord.
//
// The website (https://crimsonhaven.to) already builds SET_ACTIVITY frames and
// dials a Discord RPC WebSocket on the loopback port range — see
// src/discordPresence.js. The *real* Discord desktop client, and arRPC, both
// reject that socket because our origin isn't on their hardcoded allowlist. This
// helper speaks the exact same WebSocket RPC protocol the page expects, but
// trusts our origin, and relays whatever the page sends straight to Discord over
// its local IPC pipe.
//
// It is deliberately tiny and nosy about nothing: it listens only on 127.0.0.1
// and talks only to the Discord pipe on the same machine. Nothing leaves your
// computer.
package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"strings"
)

func main() {
	var extraOrigins string
	flag.StringVar(&extraOrigins, "origin", "",
		"comma-separated extra browser origins to trust, on top of the built-in Crimson Haven + localhost set")
	flag.Parse()

	origins := defaultOrigins()
	for _, o := range strings.Split(extraOrigins, ",") {
		if o = strings.TrimSpace(o); o != "" {
			origins[o] = true
		}
	}

	log.SetFlags(log.Ltime)
	log.Print("🩸 Luminas' bridge stirs awake…")
	log.Printf("   trusting origins: %s (+ any localhost)", originList(origins))

	if err := (&server{allowedOrigins: origins}).run(); err != nil {
		fmt.Fprintln(os.Stderr, "the bridge collapsed:", err)
		os.Exit(1)
	}
}
