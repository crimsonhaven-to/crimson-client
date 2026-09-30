//go:build windows

package main

import (
	"fmt"
	"net"
	"time"

	winio "github.com/Microsoft/go-winio"
)

// Discord exposes \\.\pipe\discord-ipc-0 .. -9. Later indices appear when
// several installs (stable, PTB, Canary) run side by side.
func dialDiscordPipe() (net.Conn, error) {
	var lastErr error
	for i := 0; i < 10; i++ {
		path := fmt.Sprintf(`\\.\pipe\discord-ipc-%d`, i)
		timeout := 2 * time.Second
		c, err := winio.DialPipe(path, &timeout)
		if err == nil {
			return c, nil
		}
		lastErr = err
	}
	return nil, fmt.Errorf("no discord-ipc pipe answered: %w", lastErr)
}
