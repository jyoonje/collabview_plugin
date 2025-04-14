// plugin.go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/mattermost/mattermost/server/public/pluginapi/cluster"
	"github.com/pkg/errors"

	"github.com/jyoonje/collabview_plugin/server/command"
	"github.com/jyoonje/collabview_plugin/server/config"
	"github.com/jyoonje/collabview_plugin/server/fileconverter"
	"github.com/jyoonje/collabview_plugin/server/store/kvstore"
)

type Plugin struct {
	plugin.MattermostPlugin
	kvstore           kvstore.KVStore
	client            *pluginapi.Client
	commandClient     command.Command
	backgroundJob     *cluster.Job
	configuration     *configuration
	configurationLock sync.RWMutex
	cfg               *config.Config
}

func (p *Plugin) OnActivate() error {
	p.client = pluginapi.NewClient(p.MattermostPlugin.API, p.MattermostPlugin.Driver)
	p.kvstore = kvstore.NewKVStore(p.client)
	p.commandClient = command.NewCommandHandler(p.client)

	p.cfg = config.Load(p.API)
	if p.cfg == nil {
		return errors.New("failed to load plugin configuration")
	}

	_ = os.Setenv("COLLABVIEW_PUBLIC_ROOT", p.cfg.CollabviewRoot)
	_ = os.Setenv("PYTHON_PATH", p.cfg.PythonPath)
	_ = os.Setenv("MATTERMOST_DATA_ROOT", p.cfg.MattermostDataRoot)

	job, err := cluster.Schedule(
		p.MattermostPlugin.API,
		"BackgroundJob",
		cluster.MakeWaitForRoundedInterval(1*time.Hour),
		p.runJob,
	)
	if err != nil {
		return errors.Wrap(err, "failed to schedule background job")
	}
	p.backgroundJob = job
	return nil
}

func (p *Plugin) OnDeactivate() error {
	if p.backgroundJob != nil {
		if err := p.backgroundJob.Close(); err != nil {
			p.client.Log.Error("Failed to close background job", "err", err)
		}
	}
	return nil
}

func (p *Plugin) ExecuteCommand(c *plugin.Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	response, err := p.commandClient.Handle(args)
	if err != nil {
		return nil, model.NewAppError("ExecuteCommand", "plugin.command.execute_command.app_error", nil, err.Error(), 500)
	}
	return response, nil
}

func copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()
	destFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destFile.Close()
	_, err = io.Copy(destFile, sourceFile)
	return err
}

func (p *Plugin) MessageHasBeenPosted(c *plugin.Context, post *model.Post) {
	if len(post.FileIds) == 0 || p.cfg == nil {
		return
	}

	p.client.Log.Info("MessageHasBeenPosted: 첨부 파일이 있는 게시글 감지", "postID", post.Id)

	go func(post *model.Post) {
		for _, fileID := range post.FileIds {
			fileInfo, appErr := p.API.GetFileInfo(fileID)
			if appErr != nil {
				p.API.LogError("파일 정보 조회 실패", "fileID", fileID, "error", appErr.Error())
				continue
			}

			p.API.LogInfo("첨부된 파일 정보", "fileID", fileInfo.Id, "이름", fileInfo.Name, "저장 위치", fileInfo.Path)

			filePath := filepath.Join(p.cfg.MattermostDataRoot, fileInfo.Path)

			if err := fileconverter.ConvertToEsob(filePath, fileInfo.Id); err != nil {
				p.API.LogError("파일 변환 실패", "fileID", fileID, "error", err.Error())
				continue
			}

			p.API.LogInfo("파일 변환 성공 및 저장 완료", "fileID", fileID)

			sourceFile := config.GetConvertedFilePath(fileInfo.Id, fileInfo.Name)
			destFile := config.GetFinalOutputPath(fileInfo.Name)
			destDir := filepath.Dir(destFile)

			if err := config.EnsureDir(destDir); err != nil {
				p.API.LogError("변환 파일 대상 디렉토리 생성 실패", "path", destDir, "error", err.Error())
				return
			}

			if err := copyFile(sourceFile, destFile); err != nil {
				p.API.LogError(".esob 파일 복사 실패", "from", sourceFile, "to", destFile, "error", err.Error())
				return
			}

			p.API.LogInfo(".esob 파일 복사 성공", "from", sourceFile, "to", destFile)

			if err := os.Remove(sourceFile); err != nil {
				p.API.LogError("원본 .esob 파일 삭제 실패", "path", sourceFile, "error", err.Error())
			} else {
				p.API.LogInfo("원본 .esob 파일 삭제 완료", "path", sourceFile)
			}
		}
	}(post)
}

func (p *Plugin) FetchFileRedirect(w http.ResponseWriter, r *http.Request) {
	fileID := r.URL.Query().Get("file_id")
	if fileID == "" {
		http.Error(w, "file_id is required", http.StatusBadRequest)
		return
	}

	userID := r.URL.Query().Get("user_id")
	userName := r.URL.Query().Get("user_name")
	authority := r.URL.Query().Get("authority")
	if userID == "" || userName == "" || authority == "" {
		http.Error(w, "Missing required parameters", http.StatusBadRequest)
		return
	}

	fileInfo, appErr := p.API.GetFileInfo(fileID)
	if appErr != nil {
		p.API.LogError("Failed to get file info", "file_id", fileID, "err", appErr.Error())
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}

	relPath := config.GetRelativeFilePath(fileInfo.Name)
	if relPath == "" {
		http.Error(w, "failed to generate file path", http.StatusInternalServerError)
		return
	}

	collabviewURL := config.GetCollabviewURL()
	if collabviewURL == "" {
		http.Error(w, "collabview url not set", http.StatusInternalServerError)
		return
	}

	disposableKey := config.GetDisposableKey()
	if disposableKey == "" {
		p.API.LogError("Disposable key not found in config")
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	insertDt := time.Now().Format("06.01.02")

	finalViewerURL := fmt.Sprintf(
		"%s/web/viewer.html?file=/%s&user_name=%s&disposable_key=%s&object_ID=%s&insert_dt=%s",
		collabviewURL,
		strings.TrimPrefix(relPath, "public/"),
		url.QueryEscape(userName),
		disposableKey,
		url.QueryEscape(fileID),
		insertDt,
	)

	finalViewerURL = strings.ReplaceAll(finalViewerURL, "+", "%2B")

	requestBody := map[string]string{
		"objectID": fileID,
		"finalURL": finalViewerURL,
	}
	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		p.API.LogError("Failed to marshal JSON", "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	cvPostURL := fmt.Sprintf("%s/cv_post", collabviewURL)

	// #nosec G107
	resp, err := http.Post(cvPostURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		p.API.LogError("Failed to POST to cv_post", "error", err.Error())
		http.Error(w, "failed to contact viewer server", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	http.Redirect(w, r, finalViewerURL, http.StatusFound)
}
