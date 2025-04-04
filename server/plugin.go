package main

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/mattermost/mattermost/server/public/pluginapi/cluster"
	"github.com/pkg/errors"

	"github.com/jyoonje/collabview_plugin/server/command"
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
}

func (p *Plugin) OnActivate() error {
	p.client = pluginapi.NewClient(p.MattermostPlugin.API, p.MattermostPlugin.Driver)
	p.kvstore = kvstore.NewKVStore(p.client)
	p.commandClient = command.NewCommandHandler(p.client)

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
		return nil, model.NewAppError("ExecuteCommand", "plugin.command.execute_command.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return response, nil
}

func (p *Plugin) getCollabviewRoot() string {
	// Mattermost가 plugin 실행 시 기준이 되는 경로
	bundlePath, err := p.API.GetBundlePath()
	if err != nil {
		p.API.LogError("현재 작업 디렉토리 가져오기 실패", "error", err.Error())
		return ""
	}

	// 상대 경로 기준으로 config 위치 추정
	configPath := filepath.Join(bundlePath, "config", "plugin_config.json")

	file, err := os.Open(configPath)
	if err != nil {
		p.API.LogError("plugin_config.json 파일 열기 실패", "path", configPath, "error", err.Error())
		return ""
	}
	defer file.Close()

	var config map[string]string
	if err := json.NewDecoder(file).Decode(&config); err != nil {
		p.API.LogError("plugin_config.json 디코딩 실패", "error", err.Error())
		return ""
	}

	root, ok := config["COLLABVIEW_PUBLIC_ROOT"]
	if !ok || root == "" {
		p.API.LogError("plugin_config.json 내에 COLLABVIEW_PUBLIC_ROOT 키가 존재하지 않거나 비어있음")
		return ""
	}

	p.API.LogInfo("COLLABVIEW_PUBLIC_ROOT 로딩 성공", "path", root)
	return root
}

func (p *Plugin) getPythonPath() string {
	bundlePath, err := p.API.GetBundlePath()
	if err != nil {
		p.API.LogError("플러그인 번들 경로 가져오기 실패", "error", err.Error())
		return ""
	}

	configPath := filepath.Join(bundlePath, "config", "plugin_config.json")

	file, err := os.Open(configPath)
	if err != nil {
		p.API.LogError("plugin_config.json 파일 열기 실패", "path", configPath, "error", err.Error())
		return ""
	}
	defer file.Close()

	var config map[string]string
	if err := json.NewDecoder(file).Decode(&config); err != nil {
		p.API.LogError("plugin_config.json 디코딩 실패", "error", err.Error())
		return ""
	}

	python, ok := config["PYTHON_PATH"]
	if !ok || python == "" {
		p.API.LogError("plugin_config.json 내에 PYTHON_PATH 키가 존재하지 않거나 비어있음")
		return ""
	}

	p.API.LogInfo("PYTHON_PATH 로딩 성공", "path", python)
	return python
}

func (p *Plugin) getMattermostDataRoot() string {
	bundlePath, err := p.API.GetBundlePath()
	if err != nil {
		p.API.LogError("플러그인 번들 경로 가져오기 실패", "error", err.Error())
		return ""
	}

	configPath := filepath.Join(bundlePath, "config", "plugin_config.json")

	file, err := os.Open(configPath)
	if err != nil {
		p.API.LogError("plugin_config.json 파일 열기 실패", "path", configPath, "error", err.Error())
		return ""
	}
	defer file.Close()

	var config map[string]string
	if err := json.NewDecoder(file).Decode(&config); err != nil {
		p.API.LogError("plugin_config.json 디코딩 실패", "error", err.Error())
		return ""
	}

	root, ok := config["MATTERMOST_DATA_ROOT"]
	if !ok || root == "" {
		p.API.LogError("plugin_config.json 내에 MATTERMOST_DATA_ROOT 키가 존재하지 않거나 비어있음")
		return ""
	}

	p.API.LogInfo("MATTERMOST_DATA_ROOT 로딩 성공", "path", root)
	return root
}

func (p *Plugin) getMattermostOutputRoot() string {
	bundlePath, err := p.API.GetBundlePath()
	if err != nil {
		p.API.LogError("플러그인 번들 경로 가져오기 실패", "error", err.Error())
		return ""
	}

	configPath := filepath.Join(bundlePath, "config", "plugin_config.json")

	file, err := os.Open(configPath)
	if err != nil {
		p.API.LogError("plugin_config.json 파일 열기 실패", "path", configPath, "error", err.Error())
		return ""
	}
	defer file.Close()

	var config map[string]string
	if err := json.NewDecoder(file).Decode(&config); err != nil {
		p.API.LogError("plugin_config.json 디코딩 실패", "error", err.Error())
		return ""
	}

	root, ok := config["MATTERMOST_OUTPUT_ROOT"]
	if !ok || root == "" {
		p.API.LogError("plugin_config.json 내에 MATTERMOST_OUTPUT_ROOT 키가 존재하지 않거나 비어있음")
		return ""
	}

	p.API.LogInfo("MATTERMOST_OUTPUT_ROOT 로딩 성공", "path", root)
	return root
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
	if err != nil {
		return err
	}

	return nil
}

func (p *Plugin) MessageHasBeenPosted(c *plugin.Context, post *model.Post) {
	if len(post.FileIds) == 0 {
		return
	}

	p.client.Log.Info("MessageHasBeenPosted: 첨부 파일이 있는 게시글 감지", "postID", post.Id)

	collabviewRoot := p.getCollabviewRoot()
	pythonPath := p.getPythonPath()
	mattermostDataRoot := p.getMattermostDataRoot()
	outputRoot := p.getMattermostOutputRoot()

	if collabviewRoot == "" || pythonPath == "" || mattermostDataRoot == "" || outputRoot == "" {
		p.API.LogError("COLLABVIEW_PUBLIC_ROOT 또는 PYTHON_PATH 경로가 비어있음. 변환 작업 중단")
		return
	}

	_ = os.Setenv("COLLABVIEW_PUBLIC_ROOT", collabviewRoot)
	_ = os.Setenv("PYTHON_PATH", pythonPath)
	_ = os.Setenv("MATTERMOST_DATA_ROOT", mattermostDataRoot)

	go func(post *model.Post) {
		for _, fileID := range post.FileIds {
			fileInfo, appErr := p.API.GetFileInfo(fileID)
			if appErr != nil {
				p.API.LogError("파일 정보 조회 실패", "fileID", fileID, "error", appErr.Error())
				continue
			}

			p.API.LogInfo("첨부된 파일 정보", "fileID", fileInfo.Id, "이름", fileInfo.Name, "저장 위치", fileInfo.Path)

			filePath := filepath.Join(mattermostDataRoot, fileInfo.Path)

			err := fileconverter.ConvertToEsob(filePath, post.Id)
			if err != nil {
				p.API.LogError("파일 변환 실패", "fileID", fileID, "error", err.Error())
				continue
			}

			p.API.LogInfo("파일 변환 성공 및 저장 완료", "fileID", fileID)

			filename := fileInfo.Name
			esobName := filename[:len(filename)-len(filepath.Ext(filename))] + ".esob"

			destDir := filepath.Join(collabviewRoot, "public", "web", "output", post.Id)
			sourceDir := filepath.Join(outputRoot, post.Id)
			sourceFile := filepath.Join(sourceDir, esobName)
			destFile := filepath.Join(destDir, esobName)

			err = os.MkdirAll(destDir, os.ModePerm)
			if err != nil {
				p.API.LogError("변환 파일 대상 디렉토리 생성 실패", "path", destDir, "error", err.Error())
				return
			}

			err = copyFile(sourceFile, destFile)
			if err != nil {
				p.API.LogError(".esob 파일 복사 실패", "from", sourceFile, "to", destFile, "error", err.Error())
				return
			}
			p.API.LogInfo(".esob 파일 복사 성공", "from", sourceFile, "to", destFile)

			// 복사 후 원본 삭제
			if err := os.Remove(sourceFile); err != nil {
				p.API.LogError("원본 .esob 파일 삭제 실패", "path", sourceFile, "error", err.Error())
			} else {
				p.API.LogInfo("원본 .esob 파일 삭제 완료", "path", sourceFile)
			}

			p.API.LogInfo(".esob 파일 이동 성공", "from", sourceFile, "to", destFile)

			if _, err := os.Stat(sourceFile); err == nil {
				_ = os.Remove(sourceFile)
				p.API.LogInfo("원본 .esob 파일 삭제 완료", "path", sourceFile)
			}
		}
	}(post)
}

// See https://developers.mattermost.com/extend/plugins/server/reference/
