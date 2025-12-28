# OpenWrt Network Monitor Agent - Build Configuration

BINARY_NAME=netmon-agent
VERSION=1.0.0
BUILD_DIR=build

# Go build flags
LDFLAGS=-ldflags "-s -w -X main.Version=$(VERSION)"

# Target platforms for OpenWrt routers
PLATFORMS=linux/amd64 linux/mips linux/mipsle linux/arm linux/arm64

.PHONY: all clean deps build-all build-linux-amd64 build-linux-mips build-linux-mipsle build-linux-arm build-linux-arm64

all: deps build-all

deps:
	go mod download

# Build for current platform (development)
build:
	go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME) .

# Build for all target platforms
build-all: build-linux-amd64 build-linux-mips build-linux-mipsle build-linux-arm build-linux-arm64
	@echo "All builds complete!"
	@ls -la $(BUILD_DIR)/

# Linux AMD64 (Intel/AMD routers, x86 VMs)
build-linux-amd64:
	@mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64 .
	@echo "Built: $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64"

# Linux MIPS (Big Endian - older TP-Link, Netgear, etc.)
build-linux-mips:
	@mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=mips GOMIPS=softfloat go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-mips .
	@echo "Built: $(BUILD_DIR)/$(BINARY_NAME)-linux-mips"

# Linux MIPSLE (Little Endian - some MediaTek routers)
build-linux-mipsle:
	@mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=mipsle GOMIPS=softfloat go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-mipsle .
	@echo "Built: $(BUILD_DIR)/$(BINARY_NAME)-linux-mipsle"

# Linux ARM (32-bit ARM - Raspberry Pi, some routers)
build-linux-arm:
	@mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=arm GOARM=7 go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-arm .
	@echo "Built: $(BUILD_DIR)/$(BINARY_NAME)-linux-arm"

# Linux ARM64 (64-bit ARM - newer routers, RPi 4)
build-linux-arm64:
	@mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=arm64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-arm64 .
	@echo "Built: $(BUILD_DIR)/$(BINARY_NAME)-linux-arm64"

# Run locally for testing
run:
	go run . -server ws://localhost:3000/ws/agent -id test-router -name "Test Router" -debug

# Test
test:
	go test -v ./...

# Clean build artifacts
clean:
	rm -rf $(BUILD_DIR)
	go clean

# Initialize go module
init:
	go mod init netmon-agent
	go mod tidy

# Show binary sizes
sizes:
	@echo "Binary sizes:"
	@ls -lh $(BUILD_DIR)/$(BINARY_NAME)-* 2>/dev/null || echo "No binaries found. Run 'make build-all' first."

# Install to OpenWrt router (requires SSH access)
# Usage: make install-router ROUTER=192.168.1.1 ARCH=mips
install-router:
ifndef ROUTER
	$(error ROUTER is not set. Usage: make install-router ROUTER=192.168.1.1 ARCH=mips)
endif
ifndef ARCH
	$(error ARCH is not set. Use: amd64, mips, mipsle, arm, or arm64)
endif
	scp $(BUILD_DIR)/$(BINARY_NAME)-linux-$(ARCH) root@$(ROUTER):/usr/bin/$(BINARY_NAME)
	ssh root@$(ROUTER) "chmod +x /usr/bin/$(BINARY_NAME)"
	@echo "Installed to $(ROUTER)"

# Help
help:
	@echo "OpenWrt Network Monitor Agent Build System"
	@echo ""
	@echo "Usage:"
	@echo "  make              - Build for all platforms"
	@echo "  make build        - Build for current platform"
	@echo "  make build-all    - Build for all OpenWrt platforms"
	@echo "  make run          - Run locally for testing"
	@echo "  make clean        - Remove build artifacts"
	@echo "  make sizes        - Show binary sizes"
	@echo ""
	@echo "Platform-specific builds:"
	@echo "  make build-linux-amd64   - Intel/AMD (x86_64)"
	@echo "  make build-linux-mips    - MIPS big-endian (older TP-Link, Netgear)"
	@echo "  make build-linux-mipsle  - MIPS little-endian (MediaTek)"
	@echo "  make build-linux-arm     - ARM 32-bit"
	@echo "  make build-linux-arm64   - ARM 64-bit"
	@echo ""
	@echo "Deployment:"
	@echo "  make install-router ROUTER=192.168.1.1 ARCH=mips"
