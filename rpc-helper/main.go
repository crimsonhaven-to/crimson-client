// Command crimson-presence-helper lets Crimson Haven's browser-based Discord Rich
// Presence reach Discord.
//
// The site dials a Discord RPC WebSocket on the loopback port range
// (src/presence/discordPresence.js), but Discord and arRPC reject it because our origin is
// not on their hardcoded allowlist. This helper speaks the same protocol, trusts
// our origin, and relays to Discord's local IPC pipe. It listens only on
// 127.0.0.1, so nothing leaves the machine.
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

	setupLogging()
	log.SetFlags(log.Ltime)
	log.Print("🩸 Luminas' bridge stirs awake…")
	log.Printf("   trusting origins: %s (+ any localhost)", originList(origins))

	if err := runApp(&server{allowedOrigins: origins}); err != nil {
		fmt.Fprintln(os.Stderr, "the bridge collapsed:", err)
		os.Exit(1)
	}
}
