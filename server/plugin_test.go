package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestServeHTTP(t *testing.T) {
	assert := assert.New(t)
	plugin := Plugin{}
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/v1/hello", nil)
	r.Header.Set("Mattermost-User-ID", "test-user-id")

	plugin.ServeHTTP(nil, w, r)

	result := w.Result()
	assert.NotNil(result)
	defer result.Body.Close()
	bodyBytes, err := io.ReadAll(result.Body)
	assert.Nil(err)
	bodyString := string(bodyBytes)

	assert.Equal("Hello, world!", bodyString)
}

func TestCopyFile(t *testing.T) {
	srcDir := "testdata"
	srcFile := filepath.Join(srcDir, "source.txt")
	dstFile := filepath.Join(srcDir, "dest.txt")

	err := os.MkdirAll(srcDir, os.ModePerm)
	if err != nil {
		t.Fatalf("디렉토리 생성 실패: %v", err)
	}
	defer os.RemoveAll(srcDir)

	content := []byte("unit test content")
	err = os.WriteFile(srcFile, content, 0600)
	if err != nil {
		t.Fatalf("테스트 파일 생성 실패: %v", err)
	}

	err = copyFile(srcFile, dstFile)
	if err != nil {
		t.Errorf("copyFile 실패: %v", err)
	}

	result, err := os.ReadFile(dstFile)
	if err != nil {
		t.Errorf("결과 파일 읽기 실패: %v", err)
	}

	assert.Equal(t, content, result, "복사된 파일 내용이 원본과 다름")
}
