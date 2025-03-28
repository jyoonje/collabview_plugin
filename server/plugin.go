package main

import (
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/mattermost/mattermost/server/public/pluginapi/cluster"
	"github.com/pkg/errors"

	"github.com/jyoonje/collabview_plugin/server/command"
	"github.com/jyoonje/collabview_plugin/server/store/kvstore"
)

// Plugin implements the interface expected by the Mattermost server to communicate between the server and plugin processes.
type Plugin struct {
	plugin.MattermostPlugin

	// kvstore is the client used to read/write KV records for this plugin.
	kvstore kvstore.KVStore

	// client is the Mattermost server API client.
	client *pluginapi.Client

	// commandClient is the client used to register and execute slash commands.
	commandClient command.Command

	backgroundJob *cluster.Job

	// configurationLock synchronizes access to the configuration.
	configurationLock sync.RWMutex

	// configuration is the active plugin configuration. Consult getConfiguration and
	// setConfiguration for usage.
	configuration *configuration
}

// OnActivate is invoked when the plugin is activated. If an error is returned, the plugin will be deactivated.
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

// This will execute the commands that were registered in the NewCommandHandler function.
func (p *Plugin) ExecuteCommand(c *plugin.Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	response, err := p.commandClient.Handle(args)
	if err != nil {
		return nil, model.NewAppError("ExecuteCommand", "plugin.command.execute_command.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return response, nil
}

func (p *Plugin) FileWillBeUploaded(c *plugin.Context, info *model.FileInfo, file io.Reader, output io.Writer) (*model.FileInfo, string) {
	// 예시: .exe 확장자의 파일은 업로드를 거부합니다.
	if info.Extension == "exe" {
		return nil, "Executable files are not allowed"
	}

	p.client.Log.Info("####################################################################################################################")
	p.client.Log.Info("FileWillBeUploaded override succeeded in collabview_plugin")
	p.client.Log.Info("####################################################################################################################")

	// 비동기 작업 실행: 파일 업로드 후 추가 처리가 필요한 작업을 고루틴을 사용해 비동기적으로 처리합니다.
	go func(fileInfo *model.FileInfo) {
		// 예: 파일에 대한 추가 처리 작업(바이러스 검사, 메타데이터 업데이트 등)
		p.client.Log.Info("비동기 작업 시작: 파일 ID " + fileInfo.Id)
		// 여기서 필요한 작업을 수행합니다.
		// 예를 들어, 시간이 걸리는 작업이나 외부 API 호출 등이 있을 수 있습니다.
	}(info)

	// 파일을 변경하지 않고 그대로 업로드할 경우:
	// output에 아무것도 쓰지 않고, nil과 빈 문자열("")을 반환
	return nil, ""
}

// See https://developers.mattermost.com/extend/plugins/server/reference/
