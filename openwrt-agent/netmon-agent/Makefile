# Copyright (C) 2024 Network Monitor
# This is free software, licensed under the Apache License, Version 2.0

include $(TOPDIR)/rules.mk

PKG_NAME:=netmon-agent
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Network Monitor <admin@example.com>

PKG_BUILD_DEPENDS:=golang/host
PKG_BUILD_PARALLEL:=1
PKG_USE_MIPS16:=0

GO_PKG:=netmon-agent

include $(INCLUDE_DIR)/package.mk
include $(TOPDIR)/feeds/packages/lang/golang/golang-package.mk

define Package/netmon-agent
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Network Monitor Agent
  DEPENDS:=$(GO_ARCH_DEPENDS) +conntrack
  URL:=https://github.com/example/netmon
endef

define Package/netmon-agent/description
  A lightweight agent that streams network connection data, device presence,
  and system stats to a central dashboard server via WebSocket.
endef

define Package/netmon-agent/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(GO_PKG_BUILD_BIN_DIR)/netmon-agent $(1)/usr/bin/netmon-agent
endef

$(eval $(call GoBinPackage,netmon-agent))
$(eval $(call BuildPackage,netmon-agent))
