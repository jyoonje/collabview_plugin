package main

import (
	"github.com/jyoonje/collabview_plugin/server/config"
	"github.com/jyoonje/collabview_plugin/server/fileconverter"
	"github.com/mattermost/mattermost/server/public/model"
	"os"
	"path/filepath"
	"strings"
)

func (p *Plugin) processFile(post *model.Post, fileID string) {
	fileInfo, appErr := p.API.GetFileInfo(fileID)
	if appErr != nil {
		p.API.LogError("파일 정보 조회 실패", "fileID", fileID, "error", appErr.Error())
		return
	}

	channel, appErr := p.API.GetChannel(post.ChannelId)
	if appErr != nil || channel == nil {
		p.API.LogError("채널 정보 조회 실패", "channelID", post.ChannelId, "error", appErr.Error())
		return
	}

	searchablePDFEnabledChannel := p.IsSearchablePDFEnabledChannel(channel.TeamId, post.ChannelId)

	p.API.LogInfo("첨부된 파일 정보", "fileID", fileInfo.Id, "이름", fileInfo.Name, "저장 위치", fileInfo.Path)

	sourceFile := config.GetConvertedFilePath(fileInfo.Id, fileInfo.Name)
	destFile := config.GetFinalOutputPath(fileInfo.Id, fileInfo.Name)

	if _, err := os.Stat(destFile); err == nil {
		p.API.LogInfo("이미 변환된 파일이 존재하므로 건너뜁니다.", "fileID", fileInfo.Id, "path", destFile)
		return
	}

	// 이미지 파일이면 KVStore에 저장
	if IsImageExtension(fileInfo.Name) {
		p.API.LogInfo("이미지 파일입니다.")
		p.MarkAsSearchable(fileInfo.Id)
	}

	filePath := filepath.Join(p.cfg.MattermostDataRoot, fileInfo.Path)
	if err := fileconverter.ConvertToEsob(filePath, fileInfo.Id); err != nil {
		p.API.LogError("파일 변환 실패", "fileID", fileID, "error", err.Error())
		return
	}

	p.API.LogInfo("파일 변환 성공 및 저장 완료", "fileID", fileID)

	convertedEsobFile := sourceFile
	convertedPdfFile := strings.TrimSuffix(convertedEsobFile, ".esob") + ".pdf"

	if searchablePDFEnabledChannel && p.ShouldApplySearchable(fileInfo.Id) {
		p.API.LogInfo("SearchablePDF 적용 대상입니다", "fileID", fileInfo.Id)
		p.handleSearchablePDF(post, convertedEsobFile, convertedPdfFile)
		p.finalizeFile(convertedPdfFile, destFile)
		p.sendWebSocketEvent(post.UserId, "searchable_pdf_success")
	} else {
		p.API.LogInfo("SearchablePDF 제외 대상입니다", "fileID", fileInfo.Id)
		p.finalizeFile(convertedEsobFile, destFile)
	}
}

func (p *Plugin) handleSearchablePDF(post *model.Post, convertedEsobFile, convertedPdfFile string) {
	if err := copyFile(convertedEsobFile, convertedPdfFile); err != nil {
		p.API.LogError(".esob 파일 복사 실패", "from", convertedEsobFile, "to", convertedPdfFile, "error", err.Error())
		return
	}
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

func isFileEmpty(filePath string) bool {
	info, err := os.Stat(filePath)
	return err != nil || info.Size() == 0
}
