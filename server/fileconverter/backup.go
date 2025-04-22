package fileconverter

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// BackupOriginalFile copies the original file to a safe backup location.
func BackupOriginalFile(originalPath string) (string, error) {
	backupDir := filepath.Join(os.TempDir(), "collabview_backup")
	if err := os.MkdirAll(backupDir, os.ModePerm); err != nil {
		return "", fmt.Errorf("백업 디렉토리 생성 실패: %w", err)
	}

	backupPath := filepath.Join(backupDir, filepath.Base(originalPath))

	src, err := os.Open(originalPath)
	if err != nil {
		return "", fmt.Errorf("원본 파일 열기 실패: %w", err)
	}
	defer src.Close()

	dst, err := os.Create(backupPath)
	if err != nil {
		return "", fmt.Errorf("백업 파일 생성 실패: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return "", fmt.Errorf("백업 파일 복사 실패: %w", err)
	}

	return backupPath, nil
}

// RestoreOriginalFile copies the backup file back to its original location.
func RestoreOriginalFile(backupPath, originalPath string) error {
	src, err := os.Open(backupPath)
	if err != nil {
		return fmt.Errorf("백업 파일 열기 실패: %w", err)
	}
	defer src.Close()

	if err := os.MkdirAll(filepath.Dir(originalPath), os.ModePerm); err != nil {
		return fmt.Errorf("원본 디렉토리 생성 실패: %w", err)
	}

	dst, err := os.Create(originalPath)
	if err != nil {
		return fmt.Errorf("원본 파일 생성 실패: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return fmt.Errorf("원본 복원 실패: %w", err)
	}

	return nil
}
