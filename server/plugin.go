// plugin.go
package main

import (
	"io"
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

			if err := fileconverter.ConvertToEsob(filePath, post.Id); err != nil {
				p.API.LogError("파일 변환 실패", "fileID", fileID, "error", err.Error())
				continue
			}

			p.API.LogInfo("파일 변환 성공 및 저장 완료", "fileID", fileID)

			sourceFile := config.GetConvertedFilePath(post.Id, fileInfo.Name)
			destFile := config.GetFinalOutputPath(post.Id, fileInfo.Name)
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
