package config

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetConvertedFilePath(t *testing.T) {
	originalCfg := cfg
	defer func() { cfg = originalCfg }()

	cfg = &Config{
		MattermostOutput: "/output/root",
	}

	tests := []struct {
		name     string
		postID   string
		filename string
		expected string
	}{
		{
			name:     "기본 케이스",
			postID:   "abc123",
			filename: "image.jpg",
			expected: filepath.Join("/output/root", "abc123", "image.esob"),
		},
		{
			name:     "대문자 확장자",
			postID:   "xyz456",
			filename: "test.PNG",
			expected: filepath.Join("/output/root", "xyz456", "test.esob"),
		},
		{
			name:     "파일명에 점이 여러 개",
			postID:   "p1",
			filename: "a_file.with.dots.png",
			expected: filepath.Join("/output/root", "p1", "a_file.with.dots.esob"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := GetConvertedFilePath(tt.postID, tt.filename)
			assert.Equal(t, tt.expected, actual)
		})
	}

	t.Run("cfg가 nil일 경우", func(t *testing.T) {
		cfg = nil
		result := GetConvertedFilePath("anyid", "anyfile.png")
		assert.Equal(t, "", result)
	})
}
