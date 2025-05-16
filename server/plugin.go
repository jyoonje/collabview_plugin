// plugin.go
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
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
	_ = os.Setenv("PYTHON_DIR_PATH", p.cfg.PythonDirPath)
	_ = os.Setenv("MATTERMOST_DATA_ROOT", p.cfg.MattermostDataRoot)
	_ = os.Setenv("SEARCHABLE_PDF_IP_PORT", p.cfg.SearchablePdfIpport)

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
			p.processFile(post, fileID)
		}
	}(post)
}

func (p *Plugin) processFile(post *model.Post, fileID string) {
	fileInfo, appErr := p.API.GetFileInfo(fileID)
	if appErr != nil {
		p.API.LogError("파일 정보 조회 실패", "fileID", fileID, "error", appErr.Error())
		return
	}

	p.API.LogInfo("첨부된 파일 정보", "fileID", fileInfo.Id, "이름", fileInfo.Name, "저장 위치", fileInfo.Path)

	sourceFile := config.GetConvertedFilePath(fileInfo.Id, fileInfo.Name)
	destFile := config.GetFinalOutputPath(fileInfo.Id, fileInfo.Name)

	if _, err := os.Stat(destFile); err == nil {
		p.API.LogInfo("이미 변환된 파일이 존재하므로 건너뜁니다.", "fileID", fileInfo.Id, "path", destFile)
		return
	}

	filePath := filepath.Join(p.cfg.MattermostDataRoot, fileInfo.Path)
	if err := fileconverter.ConvertToEsob(filePath, fileInfo.Id); err != nil {
		p.API.LogError("파일 변환 실패", "fileID", fileID, "error", err.Error())
		return
	}

	p.API.LogInfo("파일 변환 성공 및 저장 완료", "fileID", fileID)

	convertedEsobFile := sourceFile
	convertedPdfFile := strings.TrimSuffix(convertedEsobFile, ".esob") + ".pdf"

	p.handleSearchablePDF(post, convertedEsobFile, convertedPdfFile)
	p.finalizeFile(convertedEsobFile, destFile)
}

func (p *Plugin) handleSearchablePDF(post *model.Post, convertedEsobFile, convertedPdfFile string) {
	if err := copyFile(convertedEsobFile, convertedPdfFile); err != nil {
		p.API.LogError(".esob 파일 복사 실패", "from", convertedEsobFile, "to", convertedPdfFile, "error", err.Error())
		return
	}

	p.API.LogInfo("Sending websocket event: searchable_pdf_converting", "userID", post.UserId)
	p.sendWebSocketEvent(post.UserId, "searchable_pdf_converting")

	if err := fileconverter.SearchablePDF(convertedPdfFile, filepath.Base(convertedPdfFile)); err != nil {
		p.API.LogError("Searchable PDF 변환 실패", "error", err.Error())
		p.sendWebSocketEvent(post.UserId, "searchable_pdf_failed")
		p.safeRemoveFile(convertedPdfFile)
		return
	}

	if isFileEmpty(convertedPdfFile) {
		p.API.LogError("Searchable PDF 변환 실패: 파일 크기 0바이트", "path", convertedPdfFile)
		p.safeRemoveFile(convertedPdfFile)
		return
	}

	p.API.LogInfo("Searchable PDF 변환 성공", "path", convertedPdfFile)

	if err := os.Rename(convertedPdfFile, convertedEsobFile); err != nil {
		p.API.LogError(".pdf -> .esob 덮어쓰기 실패", "from", convertedPdfFile, "to", convertedEsobFile, "error", err.Error())
	} else {
		p.API.LogInfo(".pdf -> .esob 덮어쓰기 성공", "from", convertedPdfFile, "to", convertedEsobFile)
	}
}

func (p *Plugin) finalizeFile(sourceFile, destFile string) {
	if err := config.EnsureDir(filepath.Dir(destFile)); err != nil {
		p.API.LogError("대상 디렉토리 생성 실패", "path", filepath.Dir(destFile), "error", err.Error())
		return
	}

	if err := copyFile(sourceFile, destFile); err != nil {
		p.API.LogError(".esob 파일 복사 실패", "from", sourceFile, "to", destFile, "error", err.Error())
		return
	}

	p.API.LogInfo(".esob 파일 복사 성공", "from", sourceFile, "to", destFile)
	p.safeRemoveFile(sourceFile)
}

func (p *Plugin) safeRemoveFile(filePath string) {
	if err := os.Remove(filePath); err != nil {
		p.API.LogError("파일 삭제 실패", "path", filePath, "error", err.Error())
	} else {
		p.API.LogInfo("파일 삭제 성공", "path", filePath)
	}
}

func (p *Plugin) sendWebSocketEvent(userID string, event string) {
	p.API.PublishWebSocketEvent(event, map[string]interface{}{}, &model.WebsocketBroadcast{UserId: userID})
}

func isFileEmpty(filePath string) bool {
	info, err := os.Stat(filePath)
	return err != nil || info.Size() == 0
}

func (p *Plugin) FetchFileRedirect(w http.ResponseWriter, r *http.Request) {
	fileID := r.URL.Query().Get("file_id")
	if fileID == "" {
		http.Error(w, "file_id is required", http.StatusBadRequest)
		return
	}

	userID := r.URL.Query().Get("user_id")
	userName := r.URL.Query().Get("user_name")
	if userID == "" || userName == "" {
		http.Error(w, "Missing required parameters", http.StatusBadRequest)
		return
	}

	fileInfo, appErr := p.API.GetFileInfo(fileID)
	if appErr != nil {
		p.API.LogError("Failed to get file info", "file_id", fileID, "err", appErr.Error())
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}

	relPath := config.GetRelativeFilePath(fileID, fileInfo.Name)
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

	// 응답을 JSON으로 반환
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"finalURL": finalViewerURL})
}

func (p *Plugin) GetMarkupOptionsFromSystemConsole() map[string]bool {
	options := map[string]bool{
		"view_markup_button":               false,
		"view_markup_color_toolbar":        false,
		"view_export_pdf_button":           false,
		"view_speech_bubble_button":        false,
		"view_speech_bubble_color_toolbar": false,
		"view_first_markup":                false,
		"view_first_speechbubble":          false,
		"allow_markup_creation":            false,
		"allow_markup_move":                false,
		"allow_speech_bubble_creation":     false,
		"allow_speech_bubble_move":         false,
		"allow_view_chatting":              false,
		"allow_use_chatting":               false,
	}

	plugins := p.API.GetUnsanitizedConfig().PluginSettings.Plugins

	raw, ok := any(plugins["kr.esob.collabview-plugin"]).(map[string]any)
	if !ok {
		p.API.LogError("Invalid type: expected map[string]any")
		return options
	}

	p.API.LogInfo("[DEBUG] Dumping all plugin settings from System Console")
	for k, v := range raw {
		p.API.LogInfo("[DEBUG] Plugin setting", "key", k, "value", fmt.Sprintf("%v", v), "type", fmt.Sprintf("%T", v))
	}

	getBool := func(key string) bool {
		val, ok := raw[key]
		if !ok {
			return false
		}
		switch v := val.(type) {
		case string:
			return strings.ToLower(v) == "true"
		case bool:
			return v
		default:
			return false
		}
	}

	options["view_markup_button"] = getBool("view_markup_button")
	options["view_markup_color_toolbar"] = getBool("view_markup_color_toolbar")
	options["view_export_pdf_button"] = getBool("view_export_pdf_button")
	options["view_speech_bubble_button"] = getBool("view_speech_bubble_button")
	options["view_speech_bubble_color_toolbar"] = getBool("view_speech_bubble_color_toolbar")
	options["view_first_markup"] = getBool("view_first_markup")
	options["view_first_speechbubble"] = getBool("view_first_speechbubble")
	options["allow_markup_creation"] = getBool("allow_markup_creation")
	options["allow_markup_move"] = getBool("allow_markup_move")
	options["allow_speech_bubble_creation"] = getBool("allow_speech_bubble_creation")
	options["allow_speech_bubble_move"] = getBool("allow_speech_bubble_move")
	options["allow_view_chatting"] = getBool("allow_view_chatting")
	options["allow_use_chatting"] = getBool("allow_use_chatting")

	p.API.LogInfo("[DEBUG] All raw keys", "keys", reflect.ValueOf(raw).MapKeys())
	p.API.LogInfo("Final markup options", "options", options)
	return options
}

func (p *Plugin) handleGetMarkupOptions(w http.ResponseWriter, r *http.Request) {
	options := p.GetMarkupOptionsFromSystemConsole()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(options)
}
