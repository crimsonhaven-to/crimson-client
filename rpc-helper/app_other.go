//go:build !windows

package main

// On macOS/Linux the helper runs as a plain foreground process that logs to the
// console — the tray + autostart conveniences are Windows-only for now (that's
// where nearly all viewers, and Discord's desktop client, live).

func setupLogging() {} // default log output (stderr) is fine

func runApp(s *server) error { return s.run() }
