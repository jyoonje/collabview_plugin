package main

func (p *Plugin) MarkAsSearchable(fileID string) {
	key := "searchable:" + fileID
	err := p.API.KVSet(key, []byte("true"))
	if err != nil {
		p.API.LogError("KVStore 저장 실패", "key", key, "error", err.Error())
		return
	}

	// 저장된 값 확인용 로그 출력
	val, _ := p.API.KVGet(key)
	p.API.LogInfo("KVStore 저장 확인", "key", key, "value", string(val))
}

func (p *Plugin) ShouldApplySearchable(fileID string) bool {
	key := "searchable:" + fileID
	val, err := p.API.KVGet(key)
	if err != nil {
		p.API.LogError("KVStore 조회 실패", "key", key, "error", err.Error())
		return false
	}

	p.API.LogInfo("KVStore 조회 결과", "key", key, "value", string(val))

	if string(val) == "true" {
		_ = p.API.KVDelete(key)
		return true
	}
	return false
}
