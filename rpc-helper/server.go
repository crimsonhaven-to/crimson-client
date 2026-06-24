package main

import (
	"encoding/json"
	"log"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/gorilla/websocket"
)

// Discord's RPC server binds the first free port in this range, and the browser
// probes them in order until one answers (src/discordPresence.js). So we grab
// the first port Discord left free: if Discord is running it sits on 6463 and
// rejects the page's origin, the page moves on, and lands on us one port over.
var rpcPorts = []int{6463, 6464, 6465, 6466, 6467, 6468, 6469, 6470, 6471, 6472}

type server struct {
	allowedOrigins map[string]bool
}

func defaultOrigins() map[string]bool {
	return map[string]bool{
		"https://crimsonhaven.to":     true,
		"https://www.crimsonhaven.to": true,
	}
}

func originList(m map[string]bool) string {
	out := make([]string, 0, len(m))
	for o := range m {
		out = append(out, o)
	}
	return strings.Join(out, ", ")
}

// originAllowed trusts the configured Crimson Haven origins plus any localhost
// origin, so the site keeps working when developed against `vite dev`.
func (s *server) originAllowed(origin string) bool {
	if origin == "" {
		return false
	}
	if s.allowedOrigins[origin] {
		return true
	}
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	switch u.Hostname() {
	case "localhost", "127.0.0.1", "::1":
		return true
	}
	return false
}

func (s *server) run() error {
	ln, port, err := listenLoopback()
	if err != nil {
		return err
	}
	log.Printf("👂 listening on ws://127.0.0.1:%d — open Crimson Haven and flip on Discord Presence", port)

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			if !s.originAllowed(origin) {
				log.Printf("✋ refused a stranger's origin: %q", origin)
				return false
			}
			return true
		},
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		clientID := r.URL.Query().Get("client_id")
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			// Upgrade already wrote the rejection (bad origin, not a WS, …).
			return
		}
		s.handle(conn, clientID)
	})

	return (&http.Server{Handler: mux}).Serve(ln)
}

// listenLoopback binds the first free port in the Discord RPC range on 127.0.0.1.
func listenLoopback() (net.Listener, int, error) {
	var lastErr error
	for _, p := range rpcPorts {
		ln, err := net.Listen("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(p)))
		if err == nil {
			return ln, p, nil
		}
		lastErr = err
	}
	return nil, 0, lastErr
}

// handle serves one browser connection: greet it as Discord would, then forward
// every SET_ACTIVITY it sends on to the real Discord client over its IPC pipe.
func (s *server) handle(conn *websocket.Conn, clientID string) {
	defer conn.Close()
	peer := conn.RemoteAddr().String()
	log.Printf("🌹 a viewer connected (%s)", peer)

	// The page's state machine only advances once it sees a DISPATCH/READY frame.
	// Discord isn't dialed yet — we connect to it lazily on the first activity —
	// so send READY straight away rather than flapping the socket while Discord
	// boots, which would just spam the page's console.
	if err := conn.WriteJSON(readyFrame()); err != nil {
		return
	}

	dc := &discordClient{clientID: clientID}
	defer dc.Close()

	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			log.Printf("👋 viewer left (%s)", peer)
			dc.clearActivity() // don't leave a ghost presence lingering on their profile
			return
		}

		var frame struct {
			Cmd  string `json:"cmd"`
			Args struct {
				Pid      int             `json:"pid"`
				Activity json.RawMessage `json:"activity"`
			} `json:"args"`
		}
		if err := json.Unmarshal(data, &frame); err != nil || frame.Cmd != "SET_ACTIVITY" {
			continue
		}

		if err := dc.setActivity(frame.Args.Pid, frame.Args.Activity); err != nil {
			log.Printf("⚠️  couldn't reach Discord (%v) — is the desktop client running?", err)
			continue
		}
		if isNullActivity(frame.Args.Activity) {
			log.Print("   → presence cleared")
		} else {
			log.Print("   → presence whispered to Discord")
		}
	}
}

// readyFrame mimics the greeting the real Discord RPC server sends on connect.
// The page only checks cmd == DISPATCH && evt == READY, but we fill in a
// plausible config block so anything stricter is satisfied too.
func readyFrame() map[string]any {
	return map[string]any{
		"cmd": "DISPATCH",
		"evt": "READY",
		"data": map[string]any{
			"v": 1,
			"config": map[string]any{
				"cdn_host":     "cdn.discordapp.com",
				"api_endpoint": "//discord.com/api",
				"environment":  "production",
			},
		},
	}
}
