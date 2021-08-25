package main

import (
	"regexp"
	"strconv"
	"time"
)

var (
	numberPattern = regexp.MustCompile("[0-9]+")
)

type version struct {
	Name         string
	Url          string
	Latest       bool
	LastModified time.Time
}

func (instance version) parts() []int64 {
	plains := numberPattern.FindAllString(instance.Name, -1)
	result := make([]int64, len(plains))
	for i, plain := range plains {
		result[i], _ = strconv.ParseInt(plain, 10, 64)
	}
	return result
}

func (instance version) CompareTo(other version) int64 {
	ips := instance.parts()
	ops := other.parts()
	for i, ip := range ips {
		if len(ops) < i+1 {
			return 1
		}
		op := ops[i]
		if ip != op {
			return int64(ip) - int64(op)
		}
	}
	return 0
}

type versions []version

func (instance versions) Len() int {
	return len(instance)
}

func (instance versions) Swap(i, j int) {
	instance[i], instance[j] = instance[j], instance[i]
}

func (instance versions) Less(i, j int) bool {
	return instance[i].CompareTo(instance[j]) < 0
}
