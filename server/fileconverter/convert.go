package fileconverter

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

// ConvertToEsob converts the input file using convert.py script and stores it based on the outputHash.
func ConvertToEsob(inputPath string, outputHash string) error {
	pythonRoot := os.Getenv("PYTHON_DIR_PATH")
	python := os.Getenv("PYTHON_PATH")

	if pythonRoot == "" {
		return fmt.Errorf("환경변수 PYTHON_DIR_PATH가 설정되어 있지 않습니다")
	}
	if python == "" {
		return fmt.Errorf("환경변수 COLLABVIEW_PYTHON_PATH가 설정되어 있지 않습니다")
	}

	backupPath, err := BackupOriginalFile(inputPath)
	if err != nil {
		return fmt.Errorf("원본 백업 실패: %w", err)
	}
	defer func() {
		if err := RestoreOriginalFile(backupPath, inputPath); err != nil {
			fmt.Fprintf(os.Stderr, "⚠️ 원본 복원 실패: %v\n", err)
		}
	}()

	script := filepath.Join(pythonRoot, "mm_convert.py")
	args := []string{script, inputPath, "--gotenberg", outputHash}
	cmd := exec.Command(python, args...)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("convert.py 실행 실패: %v\n 출력:\n%s", err, string(output))
	}

	fmt.Printf("파일 변환 완료\n 출력:\n%s\n", string(output))
	return nil
}

func SearchablePDF(filePath, fileName string) error {
	imagesecureIpport := os.Getenv("SEARCHABLE_PDF_IP_PORT")

	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("파일 열기 실패: %w", err)
	}
	defer file.Close()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("files", filepath.Base(filePath))
	if err != nil {
		return fmt.Errorf("멀티파트 생성 실패: %w", err)
	}
	if _, err := io.Copy(part, file); err != nil {
		return fmt.Errorf("파일 복사 실패: %w", err)
	}
	writer.Close()

	req, err := http.NewRequest("POST", "http://"+imagesecureIpport+"/api/images/async/searchable", body)
	if err != nil {
		return fmt.Errorf("API 요청 생성 실패: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("API 요청 실패: %w", err)
	}
	defer resp.Body.Close()

	var resData map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&resData); err != nil {
		return fmt.Errorf("응답 파싱 실패: %w", err)
	}

	if resData["result"] != "ok" {
		return fmt.Errorf("API 호출 실패: %v", resData)
	}

	taskID := resData["files"].(map[string]interface{})[fileName].(string)
	fmt.Printf("Searchable PDF 요청 성공. Task ID: %s\n", taskID)

	const maxAttempts = 200
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		time.Sleep(3 * time.Second)

		resultURL := fmt.Sprintf("http://%s/api/images/results/searchable/%s", imagesecureIpport, taskID)

		resultResp, err := http.Get(resultURL)
		if err != nil {
			return fmt.Errorf("결과 요청 실패: %w", err)
		}
		defer resultResp.Body.Close()

		bodyBytes, err := io.ReadAll(resultResp.Body)
		if err != nil {
			return fmt.Errorf("응답 body 읽기 실패: %w", err)
		}

		// JSON 파싱 시도
		var resultData map[string]interface{}
		if err := json.Unmarshal(bodyBytes, &resultData); err == nil {
			if resultData["result"] == "waiting" {
				fmt.Printf("처리 대기 중... (%d/%d)\n", attempt, maxAttempts)
				continue
			}
		}

		// 파일 덮어쓰기
		outFile, err := os.Create(filePath)
		if err != nil {
			return fmt.Errorf("파일 생성 실패: %w", err)
		}
		defer outFile.Close()

		if _, err := outFile.Write(bodyBytes); err != nil {
			return fmt.Errorf("파일 쓰기 실패: %w", err)
		}

		fmt.Printf("SearchablePDF 저장 완료: %s\n", filePath)

		return nil
	}

	return fmt.Errorf("최대 %d회 시도했지만 완료되지 않았습니다", maxAttempts)
}
