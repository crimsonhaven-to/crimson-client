//go:build windows

package main

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/png"
	"math"
)

// trayIcon is a small crimson sigil, generated at startup so we don't have to
// ship a binary asset. It's a multi-size .ico (16 + 32 px) wrapping PNG images,
// which Windows' icon loader understands.
var trayIcon = buildTrayIcon()

type iconImage struct {
	png  []byte
	w, h int
}

func buildTrayIcon() []byte {
	imgs := make([]iconImage, 0, 2)
	for _, size := range []int{32, 16} {
		var buf bytes.Buffer
		if err := png.Encode(&buf, drawSigil(size)); err != nil {
			continue
		}
		imgs = append(imgs, iconImage{png: buf.Bytes(), w: size, h: size})
	}
	return wrapICO(imgs)
}

// drawSigil paints a filled crimson disc with a darker rim and a soft anti-
// aliased edge — Luminas' mark, scaled to the requested size.
func drawSigil(size int) image.Image {
	img := image.NewRGBA(image.Rect(0, 0, size, size))
	center := float64(size) / 2
	radius := center - float64(size)/16 // a hair of margin so the rim isn't clipped

	crimson := color.RGBA{255, 0, 60, 255}
	rim := color.RGBA{120, 0, 28, 255}

	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			d := math.Hypot(float64(x)+0.5-center, float64(y)+0.5-center)
			switch {
			case d <= radius-1.2:
				img.Set(x, y, crimson)
			case d <= radius:
				img.Set(x, y, rim)
			case d <= radius+0.8:
				a := uint8(255 * (radius + 0.8 - d) / 0.8) // feathered edge
				img.Set(x, y, color.RGBA{rim.R, rim.G, rim.B, a})
			default:
				img.Set(x, y, color.RGBA{}) // transparent
			}
		}
	}
	return img
}

// wrapICO packs the PNG images into a single .ico container.
func wrapICO(imgs []iconImage) []byte {
	var buf bytes.Buffer
	// ICONDIR header: reserved, type (1 = icon), image count.
	_ = binary.Write(&buf, binary.LittleEndian, uint16(0))
	_ = binary.Write(&buf, binary.LittleEndian, uint16(1))
	_ = binary.Write(&buf, binary.LittleEndian, uint16(len(imgs)))

	offset := 6 + 16*len(imgs) // header + one directory entry per image
	for _, im := range imgs {
		dim := func(n int) byte { // 0 encodes 256 in the .ico format
			if n >= 256 {
				return 0
			}
			return byte(n)
		}
		buf.WriteByte(dim(im.w))                                         // width
		buf.WriteByte(dim(im.h))                                         // height
		buf.WriteByte(0)                                                 // palette size (0 = none)
		buf.WriteByte(0)                                                 // reserved
		_ = binary.Write(&buf, binary.LittleEndian, uint16(1))           // color planes
		_ = binary.Write(&buf, binary.LittleEndian, uint16(32))          // bits per pixel
		_ = binary.Write(&buf, binary.LittleEndian, uint32(len(im.png))) // bytes of image data
		_ = binary.Write(&buf, binary.LittleEndian, uint32(offset))      // offset to data
		offset += len(im.png)
	}
	for _, im := range imgs {
		buf.Write(im.png)
	}
	return buf.Bytes()
}
