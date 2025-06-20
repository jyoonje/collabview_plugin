package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
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

	adminSettingsCache *AdminPluginOptions
	adminSettingsLock  sync.RWMutex

	adminSettingsJob *cluster.Job
}

type AdminPluginOptions struct {
	Webapp WebappSection `json:"webapp"`
	Server ServerSection `json:"server"`
}

type WebappSection struct {
	FileDownloadRoles []string `json:"file_download_roles"`
}

type ServerSection struct {
	TeamSettings map[string]*TeamSetting `json:"team_settings"`
}

type TeamSetting struct {
	ChannelSettings map[string]ChannelSetting `json:"channel_settings"`
}

type ChannelSetting struct {
	SearchablePDF bool     `json:"searchablePDF"`
	UseAnnotation []string `json:"use_annotation,omitempty"`
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

	adminJob, err := cluster.Schedule(
		p.MattermostPlugin.API,
		"AdminSettingsJob",
		cluster.MakeWaitForRoundedInterval(5*time.Minute),
		p.refreshAdminSettingsCache,
	)
	if err != nil {
		return errors.Wrap(err, "failed to schedule admin settings job")
	}
	p.adminSettingsJob = adminJob

	// 최초 1회 즉시 갱신
	p.refreshAdminSettingsCache()

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

func (p *Plugin) sendWebSocketEvent(userID string, event string) {
	p.API.PublishWebSocketEvent(event, map[string]interface{}{}, &model.WebsocketBroadcast{UserId: userID})
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

func (p *Plugin) GetMarkupOptionsFromCache() map[string]bool {
	// 모든 주석 옵션 기본 false
	options := map[string]bool{
		"view_markup_button":               false,
		"view_markup_color_toolbar":        false,
		"view_export_pdf_button":           false,
		"view_check_button":                false,
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

	p.adminSettingsLock.RLock()
	defer p.adminSettingsLock.RUnlock()

	if p.adminSettingsCache == nil {
		p.API.LogWarn("adminSettingsCache is nil, using defaults")
		return options
	}

	// 첫 번째 팀의 첫 번째 채널만 가져옴
	for _, team := range p.adminSettingsCache.Server.TeamSettings {
		for _, channel := range team.ChannelSettings {
			for _, key := range channel.UseAnnotation {
				options[key] = true
			}
			// 첫 채널만 보고 끝내기
			return options
		}
		break
	}

	return options
}

func (p *Plugin) handleGetMarkupOptions(w http.ResponseWriter, r *http.Request) {
	options := p.GetMarkupOptionsFromCache()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(options)
}

func (p *Plugin) handleSavePluginSettings(w http.ResponseWriter, r *http.Request) {
	p.API.LogInfo("[INFO] /save-plugin-settings called")

	defer func() {
		if err := recover(); err != nil {
			p.API.LogError("[FATAL] Panic in handleSavePluginSettings", "error", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
		}
	}()

	var pluginOptions AdminPluginOptions

	if err := json.NewDecoder(r.Body).Decode(&pluginOptions); err != nil {
		p.API.LogError("Failed to decode JSON body", "error", err.Error())
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	dump, _ := json.MarshalIndent(pluginOptions, "", "  ")
	p.API.LogInfo("[DEBUG] Full pluginOptions", "json", string(dump))

	p.API.LogInfo("[DEBUG] Parsed PluginConfiguration",
		"file_download_roles", fmt.Sprintf("%v", pluginOptions.Webapp.FileDownloadRoles),
	)

	if pluginOptions.Server.TeamSettings != nil {
		for teamName, team := range pluginOptions.Server.TeamSettings {
			if team == nil {
				p.API.LogWarn("Team is nil", "team", teamName)
				continue
			}
			if team.ChannelSettings == nil {
				p.API.LogWarn("ChannelSettings is nil for team", "team", teamName)
				continue
			}
			for channelName, channel := range team.ChannelSettings {
				p.API.LogInfo("[DEBUG] Channel setting",
					"team", teamName,
					"channel", channelName,
					"searchablePDF", channel.SearchablePDF,
					"use_annotation", fmt.Sprintf("%v", channel.UseAnnotation),
				)
			}
		}
	} else {
		p.API.LogWarn("TeamSettings is nil")
	}

	bytes, err := json.Marshal(pluginOptions)
	if err != nil {
		p.API.LogError("Failed to serialize config", "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if err := p.API.KVSet("admin_settings", bytes); err != nil {
		p.API.LogError("Failed to save config to KVStore", "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// KVSet 성공 이후 캐시 갱신
	p.refreshAdminSettingsCache()

	p.sendWebSocketEvent("", "file_download_permission_updated")

	p.logCurrentPluginConfigFromKVStore()
	w.WriteHeader(http.StatusOK)
}

func (p *Plugin) refreshAdminSettingsCache() {
	raw, appErr := p.API.KVGet("admin_settings")
	if appErr != nil {
		p.API.LogError("Failed to KVGet admin_settings", "error", appErr.Error())
		return
	}
	if raw == nil {
		p.API.LogWarn("admin_settings not found in KVStore")
		return
	}

	var opts AdminPluginOptions
	if err := json.Unmarshal(raw, &opts); err != nil {
		p.API.LogError("Failed to unmarshal admin_settings", "error", err.Error())
		return
	}

	p.adminSettingsLock.Lock()
	p.adminSettingsCache = &opts
	p.adminSettingsLock.Unlock()

	p.API.LogInfo("[INFO] Refreshed admin_settings cache from KVStore")
}

func (p *Plugin) handleGetPluginOptions(w http.ResponseWriter, r *http.Request) {
	p.adminSettingsLock.RLock()
	defer p.adminSettingsLock.RUnlock()

	if p.adminSettingsCache == nil {
		p.API.LogInfo("[INFO] Plugin Admin settings not found")
	}

	w.Header().Set("Content-Type", "application/json")
	err := json.NewEncoder(w).Encode(p.adminSettingsCache)
	if err != nil {
		http.Error(w, "Failed to encode", http.StatusInternalServerError)
	}
}

func (p *Plugin) handleFileDownloadPermission(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-Id")
	if userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	user, appErr := p.API.GetUser(userID)
	if appErr != nil {
		http.Error(w, appErr.Error(), http.StatusInternalServerError)
		return
	}

	// 캐시에서 가져오기
	p.adminSettingsLock.RLock()
	allowedRoles := []string{}
	if p.adminSettingsCache != nil {
		allowedRoles = p.adminSettingsCache.Webapp.FileDownloadRoles
	}
	p.adminSettingsLock.RUnlock()

	userRoles := strings.Fields(user.Roles)

	// 직접 비교
	canDownload := false
	for _, role := range userRoles {
		for _, allowed := range allowedRoles {
			if role == allowed {
				canDownload = true
				break
			}
		}
		if canDownload {
			break
		}
	}

	// 응답
	resp := map[string]bool{"canDownload": canDownload}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func (p *Plugin) logCurrentPluginConfigFromKVStore() {
	raw, appErr := p.API.KVGet("admin_settings")
	if appErr != nil || raw == nil {
		p.API.LogError("Failed to fetch config from KVStore", "error", appErr)
		return
	}

	p.API.LogInfo("[DEBUG] Raw admin_settings from KVStore", "json", string(raw))
}
