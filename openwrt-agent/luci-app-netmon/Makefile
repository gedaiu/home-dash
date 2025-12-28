# Copyright (C) 2024 Network Monitor
# This is free software, licensed under the Apache License, Version 2.0

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-netmon
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Network Monitor <admin@example.com>

LUCI_TITLE:=LuCI Network Monitor
LUCI_DESCRIPTION:=Real-time network monitoring with connection tracking and device presence detection
LUCI_DEPENDS:=+luci-base +netmon-agent
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildance
