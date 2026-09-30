//go:build !windows

package main

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
)

// The sockets are discord-ipc-0 .. -9 in the runtime dir; Flatpak and Snap put
// theirs in well-known subfolders.
func dialDiscordPipe() (net.Conn, error) {
	var lastErr error
	for _, base := range socketDirs() {
		for i := 0; i < 10; i++ {
			path := filepath.Join(base, fmt.Sprintf("discord-ipc-%d", i))
			c, err := net.Dial("unix", path)
			if err == nil {
				return c, nil
			}
			lastErr = err
		}
	}
	return nil, fmt.Errorf("no discord-ipc socket found: %w", lastErr)
}

func socketDirs() []string {
	root := "/tmp"
	for _, env := range []string{"XDG_RUNTIME_DIR", "TMPDIR", "TMP", "TEMP"} {
		if v := os.Getenv(env); v != "" {
			root = v
			break
		}
	}
	return []string{
		root,
		filepath.Join(root, "app", "com.discordapp.Discord"), // Flatpak
		filepath.Join(root, "snap.discord"),                  // Snap
	}
}
