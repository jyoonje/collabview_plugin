package fileconverter

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// ConvertToEsob converts the input file using convert.py script and stores it based on the outputHash.
func ConvertToEsob(inputPath string, outputHash string) error {
	publicRoot := os.Getenv("COLLABVIEW_PUBLIC_ROOT")
	python := os.Getenv("PYTHON_PATH")

	if publicRoot == "" {
		return fmt.Errorf("환경변수 COLLABVIEW_PUBLIC_ROOT가 설정되어 있지 않습니다")
	}
	if python == "" {
		return fmt.Errorf("환경변수 COLLABVIEW_PYTHON_PATH가 설정되어 있지 않습니다")
	}

	script := filepath.Join(publicRoot, "public", "web", "convert.py")
	args := []string{script, inputPath, "--gotenberg", outputHash}
	cmd := exec.Command(python, args...)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("convert.py 실행 실패: %v\n 출력:\n%s", err, string(output))
	}

	fmt.Printf("파일 변환 완료\n 출력:\n%s\n", string(output))
	return nil
}
