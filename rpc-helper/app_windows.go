//go:build windows

package main

import (
	"log"
	"os"
	"os/exec"
	"path/filepath"

	"fyne.io/systray"
	"golang.org/x/sys/windows/registry"
)

const (
	appName  = "CrimsonPresenceHelper" // registry value + log folder name
	appTitle = "Crimson Presence"
	siteURL  = "https://crimsonhaven.to"
	runKey   = `Software\Microsoft\Windows\CurrentVersion\Run`
)

// setupLogging redirects logs to a file under %LOCALAPPDATA%, because the binary
// is linked as a GUI app (no console window) so there's nowhere to print. The
// file is truncated each launch so it never grows without bound.
func setupLogging() {
	dir := filepath.Join(os.Getenv("LOCALAPPDATA"), appName)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return
	}
	f, err := os.OpenFile(filepath.Join(dir, "helper.log"),
		os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644)
	if err == nil {
		log.SetOutput(f)
	}
}

// runApp serves the bridge in the background and lives in the system tray.
func runApp(s *server) error {
	go func() {
		if err := s.run(); err != nil {
			log.Printf("bridge stopped: %v", err)
		}
	}()
	systray.Run(func() { onTrayReady(s) }, func() {})
	return nil
}

func onTrayReady(s *server) {
	systray.SetIcon(trayIcon)
	systray.SetTitle("")
	systray.SetTooltip(appTitle + " · idle")

	status := systray.AddMenuItem("Idle", "")
	status.Disable()
	systray.AddSeparator()
	open := systray.AddMenuItem("Open Crimson Haven", "Open the site in your browser")
	startup := systray.AddMenuItemCheckbox(
		"Start with Windows", "Launch automatically when you log in", autostartEnabled())
	systray.AddSeparator()
	quit := systray.AddMenuItem("Quit", "Stop the presence bridge")

	// Mirror the bridge's state into the tray label + tooltip.
	s.presence.onStatus = func(st string) {
		label, tip := "Idle", appTitle+" · idle"
		if st == "watching" {
			label, tip = "Sharing your watch", appTitle+" · sharing your watch"
		}
		status.SetTitle(label)
		systray.SetTooltip(tip)
	}

	go func() {
		for {
			select {
			case <-open.ClickedCh:
				openBrowser(siteURL)
			case <-startup.ClickedCh:
				toggleAutostart(startup)
			case <-quit.ClickedCh:
				systray.Quit()
				return
			}
		}
	}()
}

func openBrowser(url string) {
	// rundll32 avoids spawning a visible shell window.
	_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
}

func toggleAutostart(item *systray.MenuItem) {
	if item.Checked() {
		if err := setAutostart(false); err != nil {
			log.Printf("couldn't disable autostart: %v", err)
			return
		}
		item.Uncheck()
		return
	}
	if err := setAutostart(true); err != nil {
		log.Printf("couldn't enable autostart: %v", err)
		return
	}
	item.Check()
}

func exePath() string {
	p, err := os.Executable()
	if err != nil {
		return ""
	}
	if abs, err := filepath.Abs(p); err == nil {
		return abs
	}
	return p
}

// autostartEnabled reports whether our HKCU Run entry is present. HKCU means
// per-user, so no administrator rights are ever needed.
func autostartEnabled() bool {
	k, err := registry.OpenKey(registry.CURRENT_USER, runKey, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer k.Close()
	v, _, err := k.GetStringValue(appName)
	return err == nil && v != ""
}

func setAutostart(on bool) error {
	k, _, err := registry.CreateKey(registry.CURRENT_USER, runKey, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	if on {
		// Wrap in literal double quotes so a Program Files-style space can't split
		// the command. (Not %q — that would escape the path's backslashes.)
		return k.SetStringValue(appName, `"`+exePath()+`"`)
	}
	if err := k.DeleteValue(appName); err != nil && err != registry.ErrNotExist {
		return err
	}
	return nil
}
