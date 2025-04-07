package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"github.com/mattermost/mattermost/server/public/plugin"
)

type Config struct {
	CollabviewRoot     string `json:"COLLABVIEW_PUBLIC_ROOT"`
	PythonPath         string `json:"PYTHON_PATH"`
	MattermostDataRoot string `json:"MATTERMOST_DATA_ROOT"`
	MattermostOutput   string `json:"MATTERMOST_OUTPUT_ROOT"`
}

var (
	cfg        *Config
	configOnce sync.Once
)

// Load reads and caches the plugin configuration from plugin_config.json.
func Load(pluginAPI plugin.API) *Config {
	configOnce.Do(func() {
		bundlePath, err := pluginAPI.GetBundlePath()
		if err != nil {
			pluginAPI.LogError("Failed to get plugin bundle path", "error", err.Error())
			return
		}

		configPath := filepath.Join(bundlePath, "config", "plugin_config.json")
		file, err := os.Open(configPath)
		if err != nil {
			pluginAPI.LogError("Failed to open plugin_config.json", "path", configPath, "error", err.Error())
			return
		}
		defer file.Close()

		decoder := json.NewDecoder(file)
		loaded := &Config{}
		if err := decoder.Decode(loaded); err != nil {
			pluginAPI.LogError("Failed to decode plugin_config.json", "error", err.Error())
			return
		}

		cfg = loaded
		pluginAPI.LogInfo("Config loaded successfully", "config", *cfg)
	})
	return cfg
}

// GetConvertedFilePath returns the full path to the source .esob file.
func GetConvertedFilePath(postID, filename string) string {
	if cfg == nil {
		return ""
	}
	esobName := changeExtensionToEsob(filename)
	return filepath.Join(cfg.MattermostOutput, postID, esobName)
}

// GetFinalOutputPath returns the full destination path for the .esob file.
func GetFinalOutputPath(filename string) string {
	if cfg == nil {
		return ""
	}
	esobName := changeExtensionToEsob(filename)
	return filepath.Join(cfg.CollabviewRoot, "public", "OUT", "destFile", esobName)
}

// EnsureDir ensures that the given directory exists.
func EnsureDir(path string) error {
	return os.MkdirAll(path, os.ModePerm)
}

// changeExtensionToEsob converts the given filename to .esob extension.
func changeExtensionToEsob(filename string) string {
	return filename[:len(filename)-len(filepath.Ext(filename))] + ".esob"
}
