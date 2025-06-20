package main

func (p *Plugin) IsSearchablePDFEnabledChannel(teamID, channelID string) bool {
	p.adminSettingsLock.RLock()
	defer p.adminSettingsLock.RUnlock()

	if p.adminSettingsCache == nil {
		p.API.LogWarn("adminSettingsCache is nil")
		return false
	}

	t, ok := p.adminSettingsCache.Server.TeamSettings[teamID]
	if !ok {
		p.API.LogWarn("해당 팀 설정 없음", "team", teamID)
		return false
	}

	c, ok := t.ChannelSettings[channelID]
	if !ok {
		p.API.LogWarn("해당 채널 설정 없음", "channel", channelID)
		return false
	}

	return c.SearchablePDF
}
