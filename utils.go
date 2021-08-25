package main

import (
	"fmt"
	"io"
	"os"
	"time"
)

func envString(key string, def string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return def
}

func envDuration(key string, def time.Duration) time.Duration {
	if val, ok := os.LookupEnv(key); ok {
		ret, err := time.ParseDuration(val)
		if err != nil {
			panic(fmt.Sprintf("Environment variable '%s' contains invalid value '%s': %v", key, val, err))
		}
		return ret
	}
	return def
}

func closeSilently(target io.Closer) {
	_ = target.Close()
}
