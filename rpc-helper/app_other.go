//go:build !windows

package main

// The tray and autostart are Windows-only because that is where nearly all
// viewers, and Discord's desktop client, live. Elsewhere the helper is a plain
// foreground process logging to stderr.

func setupLogging() {}

func runApp(s *server) error { return s.run() }
