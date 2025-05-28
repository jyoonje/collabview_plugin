package main

import (
	"path/filepath"
	"strings"
)

var imageExtensions = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".png":  true,
}

// IsImageExtension returns true if the given file name has an image extension.
func IsImageExtension(fileName string) bool {
	ext := strings.ToLower(filepath.Ext(fileName))
	return imageExtensions[ext]
}
