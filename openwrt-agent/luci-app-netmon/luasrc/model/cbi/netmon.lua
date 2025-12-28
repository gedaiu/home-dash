-- Copyright (C) 2024 Network Monitor
-- Licensed under the Apache License, Version 2.0

local m, s, o

m = Map("netmon", translate("Network Monitor Settings"),
    translate("Configure the network monitoring agent that sends data to your dashboard server."))

s = m:section(TypedSection, "netmon", translate("Agent Configuration"))
s.anonymous = true
s.addremove = false

-- Enable/Disable
o = s:option(Flag, "enabled", translate("Enable Agent"))
o.rmempty = false
o.default = "1"

-- Server URL
o = s:option(Value, "server_url", translate("Server WebSocket URL"))
o.placeholder = "ws://192.168.1.100:3000/ws/agent"
o.datatype = "string"
o.rmempty = false
o.description = translate("WebSocket URL of your dashboard server (e.g., ws://192.168.1.100:3000/ws/agent)")

-- Router ID
o = s:option(Value, "router_id", translate("Router ID"))
o.placeholder = "main"
o.datatype = "string"
o.rmempty = false
o.description = translate("Unique identifier for this router (e.g., 'main', 'ap1', 'upstairs')")

-- Router Name
o = s:option(Value, "router_name", translate("Router Name"))
o.placeholder = "Main Router"
o.datatype = "string"
o.description = translate("Friendly name displayed in the dashboard")

-- Role
o = s:option(ListValue, "role", translate("Router Role"))
o:value("main", translate("Main Router (Full monitoring)"))
o:value("ap", translate("Access Point (Low resource mode)"))
o.default = "main"
o.description = translate("Access Point mode uses less resources by disabling heavy features")

-- Divider for advanced settings
s2 = m:section(TypedSection, "netmon", translate("Advanced Settings"),
    translate("Fine-tune performance settings. Default values work for most setups."))
s2.anonymous = true
s2.addremove = false

-- Batch interval
o = s2:option(Value, "batch_interval", translate("Batch Interval (ms)"))
o.placeholder = "100"
o.datatype = "uinteger"
o.default = "100"
o.description = translate("How often to send batched events (100-1000ms). Higher = less traffic, more delay.")

-- Stats interval
o = s2:option(Value, "stats_interval", translate("Stats Interval (ms)"))
o.placeholder = "10000"
o.datatype = "uinteger"
o.default = "10000"
o.description = translate("How often to send system stats (5000-60000ms)")

-- Enable conntrack
o = s2:option(Flag, "conntrack_enabled", translate("Connection Tracking"))
o.rmempty = false
o.default = "1"
o.description = translate("Stream real-time connection events. Disable on low-resource devices.")

-- Enable traffic stats
o = s2:option(Flag, "traffic_enabled", translate("Traffic Statistics"))
o.rmempty = false
o.default = "1"
o.description = translate("Collect per-device bandwidth data from nlbwmon")

-- Max connections
o = s2:option(Value, "max_connections", translate("Max Tracked Connections"))
o.placeholder = "1000"
o.datatype = "uinteger"
o.default = "1000"
o.description = translate("Limit tracked connections to reduce memory usage (100-5000)")

return m
